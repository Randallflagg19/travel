/// <reference types="jest" />
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import postgres, { type Sql } from 'postgres';
import { DbService } from '../src/db/db.service';
import { runMigrations } from '../src/db/migrations';
import { runVersionedMigrations } from '../src/db/versioned-migrations';
import { CloudinaryService } from '../src/cloudinary/cloudinary.service';
import { MediaService } from '../src/cloudinary/media.service';
import { PostsService } from '../src/posts/posts.service';
import { PlacesService } from '../src/places/places.service';

// Opt-in only. Never uses DATABASE_URL or the application's .env file.
const url = process.env.MEDIA_TEST_DATABASE_URL;
const databaseTest = url ? describe : describe.skip;

databaseTest(
  'Media migration and lifecycle on an isolated PostgreSQL schema',
  () => {
    let sql: Sql;
    const schema = `media_test_${randomUUID().replaceAll('-', '')}`;
    let created = false;

    beforeAll(async () => {
      sql = postgres(url!, {
        max: 1,
        prepare: false,
        ssl: process.env.MEDIA_TEST_DB_SSL === 'disable' ? false : 'require',
      });
      await sql`CREATE SCHEMA ${sql(schema)}`;
      created = true;
      await sql`SET search_path TO ${sql(schema)}, public`;
    });

    afterAll(async () => {
      if (!sql) return;
      try {
        if (created) await sql`DROP SCHEMA ${sql(schema)} CASCADE`;
      } finally {
        await sql.end();
      }
    });

    it('preserves old posts and reactions, runs twice, publishes once and retries all deletions', async () => {
      await runMigrations(sql);
      const userId = randomUUID();
      const oldId = randomUUID();
      const storyId = randomUUID();
      await sql`INSERT INTO users (id, username, password_hash, role) VALUES (${userId}, 'fixture', 'unused', 'ADMIN')`;
      await sql`
      INSERT INTO posts (id, user_id, media_type, media_url, cloudinary_public_id, title, text, country, pinned_at)
      VALUES (${oldId}, ${userId}, 'PHOTO', 'https://res.cloudinary.com/demo/image/upload/old.jpg', 'old', 'Old', 'Caption', 'Thailand', now()),
        (${storyId}, ${userId}, 'STORY', '', NULL, 'Story', 'Body', 'Thailand', NULL)
    `;
      await sql`INSERT INTO likes (post_id, user_id) VALUES (${oldId}, ${userId})`;
      await sql`INSERT INTO comments (post_id, user_id, text) VALUES (${oldId}, ${userId}, 'Comment')`;
      await runVersionedMigrations(sql);
      await runVersionedMigrations(sql);
      const versions = await sql`SELECT version FROM schema_migrations`;
      expect(versions).toHaveLength(2);
      expect(
        await sql`SELECT * FROM post_media WHERE post_id = ${oldId}`,
      ).toHaveLength(1);
      expect(
        await sql`SELECT * FROM post_media WHERE post_id = ${storyId}`,
      ).toHaveLength(0);
      expect(
        await sql`SELECT * FROM likes WHERE post_id = ${oldId}`,
      ).toHaveLength(1);
      expect(
        await sql`SELECT * FROM comments WHERE post_id = ${oldId}`,
      ).toHaveLength(1);
      const [old] = await sql`SELECT pinned_at FROM posts WHERE id = ${oldId}`;
      expect(old.pinned_at).not.toBeNull();

      const cloud = {
        getClientConfig: () => ({ cloudName: 'demo', apiKey: 'unused' }),
        signUpload: () => ({ signature: 'unused', timestamp: 1 }),
        getUploadResource: jest.fn((id: string, type: string) =>
          Promise.resolve({
            public_id: id,
            resource_type: type,
            format: type === 'image' ? 'jpg' : 'mp4',
            bytes: 1024,
            width: 1200,
            height: 800,
            duration: 2,
            secure_url: `https://res.cloudinary.com/demo/${type}/upload/${id}`,
          }),
        ),
        destroy: jest.fn().mockResolvedValue(undefined),
      };
      const db = { client: sql } as unknown as DbService;
      const config = { get: () => 'test' } as unknown as ConfigService;
      const media = new MediaService(
        db,
        cloud as unknown as CloudinaryService,
        config,
      );
      const posts = new PostsService(
        db,
        cloud as unknown as CloudinaryService,
        media,
      );
      const session = randomUUID();
      const photo = randomUUID();
      const video = randomUUID();
      await media.open(session, userId);
      await media.reserve(session, photo, userId, {
        mediaType: 'PHOTO',
        bytes: 1024,
      });
      await media.reserve(session, video, userId, {
        mediaType: 'VIDEO',
        bytes: 1024,
      });
      await media.complete(session, photo, userId);
      await expect(
        media.publish(session, userId, { uploadIds: [photo, video] }),
      ).rejects.toThrow();
      expect(await sql`SELECT id FROM posts`).toHaveLength(2);
      await media.complete(session, video, userId);
      const input = {
        uploadIds: [video, photo],
        title: 'Carousel',
        country: 'Thailand',
      };
      const first = await media.publish(session, userId, input);
      const repeated = await media.publish(session, userId, input);
      expect(repeated).toEqual(first);
      expect(await sql`SELECT id FROM posts`).toHaveLength(3);
      const publication = await posts.getOrThrow(first.postId);
      expect(publication.media_type).toBe('VIDEO');
      expect(publication.attachments?.map((item) => item.id)).toEqual([
        video,
        photo,
      ]);
      const places = await new PlacesService(db).listPlaces(userId);
      expect(places.countries[0].stats).toEqual({
        posts: 3,
        photos: 2,
        videos: 1,
        stories: 1,
      });
      const saved = await posts.updateMetadata(
        oldId,
        { title: 'Updated' },
        { sub: userId, role: 'ADMIN' },
      );
      expect(saved).toMatchObject({
        like_count: 1,
        comment_count: 1,
        liked_by_me: true,
      });

      cloud.destroy.mockRejectedValueOnce(new Error('Temporary cloud failure'));
      await media.deletePost(first.postId, { sub: userId, role: 'ADMIN' });
      expect(
        await sql`SELECT id FROM posts WHERE id = ${first.postId}`,
      ).toHaveLength(0);
      expect(
        await sql`SELECT id FROM post_media WHERE post_id = ${first.postId}`,
      ).toHaveLength(0);
      const jobs = await sql`SELECT * FROM media_deletions`;
      expect(jobs).toHaveLength(2);
      expect(
        jobs.some((job) => job.last_error === 'Temporary cloud failure'),
      ).toBe(true);
      // Advance only these fixture jobs past the signature safety interval.
      await sql`UPDATE media_deletions SET next_attempt_at = now(), retain_until = now()`;
      await media.retryCleanup();
      expect(await sql`SELECT id FROM media_deletions`).toHaveLength(0);
      expect(cloud.destroy).toHaveBeenCalledWith(
        expect.stringContaining(video),
        'video',
      );
      expect(cloud.destroy).toHaveBeenCalledWith(
        expect.stringContaining(photo),
        'image',
      );
    }, 30000);
  },
);
