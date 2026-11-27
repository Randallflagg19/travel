/// <reference types="jest" />
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import postgres, { type Sql } from 'postgres';
import { DbService } from '../src/db/db.service';
import { runMigrations } from '../src/db/migrations';
import { runVersionedMigrations } from '../src/db/versioned-migrations';
import { CloudinaryService } from '../src/integrations/cloudinary/cloudinary.service';
import { MediaSessionsService } from '../src/media/media-sessions.service';
import { MediaCleanupService } from '../src/media/media-cleanup.service';
import { MediaEnvironmentService } from '../src/media/media-environment.service';
import { PublishMediaPostService } from '../src/posts/publish-media-post.service';
import { DeletePostService } from '../src/posts/delete-post.service';
import { PostsQueryService } from '../src/posts/posts-query.service';
import { PostsService } from '../src/posts/posts.service';
import { PlacesService } from '../src/places/places.service';
import { AuthorCloudinaryService } from '../src/users/author-cloudinary.service';

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
      const versions = await sql<{ version: string }[]>`
        SELECT version FROM schema_migrations ORDER BY version
      `;
      expect(versions.map(({ version }) => version)).toEqual([
        '001_legacy',
        '002_media_posts',
        '003_author_cloudinary_connections',
        '004_author_cloudinary_sessions',
        '005_author_media',
        '006_albums',
        '007_album_media',
        '008_album_folder_paths',
        '009_media_session_country',
      ]);
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
        getFolderMode: () => Promise.resolve('fixed'),
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
      const environment = new MediaEnvironmentService(config);
      const storage = cloud as unknown as CloudinaryService;
      const authorCloud = new AuthorCloudinaryService(db, config);
      const cleanup = new MediaCleanupService(
        db,
        storage,
        environment,
        authorCloud,
      );
      const media = new MediaSessionsService(
        db,
        storage,
        environment,
        cleanup,
        authorCloud,
      );
      const publisher = new PublishMediaPostService(db, media, cleanup);
      const deletion = new DeletePostService(db, cleanup, environment);
      const posts = new PostsService(
        db,
        storage,
        new PostsQueryService(db),
        deletion,
      );
      const session = randomUUID();
      const photo = randomUUID();
      const video = randomUUID();
      await media.open(session, { sub: userId, role: 'ADMIN' });
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
        publisher.publish(session, userId, { uploadIds: [photo, video] }),
      ).rejects.toThrow();
      expect(await sql`SELECT id FROM posts`).toHaveLength(2);
      await media.complete(session, video, userId);
      const input = {
        uploadIds: [video, photo],
        title: 'Carousel',
        country: 'Thailand',
      };
      // Fail after the post and first attachment have already been inserted.
      // Splitting services must not split this transaction into partial commits.
      await sql`ALTER TABLE post_media ADD CONSTRAINT fixture_reject_second_attachment CHECK (position <> 1) NOT VALID`;
      await expect(
        publisher.publish(session, userId, input),
      ).rejects.toMatchObject({ code: '23514' });
      expect(await sql`SELECT id FROM posts`).toHaveLength(2);
      expect(
        await sql`SELECT id FROM post_media WHERE upload_id IN (${photo}::uuid, ${video}::uuid)`,
      ).toHaveLength(0);
      const [unpublished] =
        await sql`SELECT state, post_id, publication_hash FROM media_sessions WHERE id = ${session}::uuid`;
      expect(unpublished).toMatchObject({
        state: 'OPEN',
        post_id: null,
        publication_hash: null,
      });
      await sql`ALTER TABLE post_media DROP CONSTRAINT fixture_reject_second_attachment`;
      const first = await publisher.publish(session, userId, input);
      const repeated = await publisher.publish(session, userId, input);
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
      await deletion.deletePost(first.postId, { sub: userId, role: 'ADMIN' });
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
      await cleanup.retryCleanup();
      expect(await sql`SELECT id FROM media_deletions`).toHaveLength(0);
      expect(cloud.destroy).toHaveBeenCalledWith(
        expect.stringContaining(video),
        'video',
        undefined,
      );
      expect(cloud.destroy).toHaveBeenCalledWith(
        expect.stringContaining(photo),
        'image',
        undefined,
      );
    }, 30000);

    it('publishes one attachment into an author album and the matching place feeds', async () => {
      const userId = randomUUID();
      const otherId = randomUUID();
      const albumId = randomUUID();
      await sql`
        INSERT INTO users (id, username, password_hash, role)
        VALUES (${userId}, 'album-author', 'unused', 'AUTHOR'),
               (${otherId}, 'other-album-author', 'unused', 'ADMIN')
      `;
      await sql`
        INSERT INTO posts (user_id, media_type, media_url, title, text, country, city)
        VALUES (${userId}, 'STORY', '', 'Existing story', 'Body', 'Thailand', 'Bangkok')
      `;
      await sql`
        INSERT INTO albums (id, user_id, country, title)
        VALUES (${albumId}, ${userId}, 'Thailand', 'Зимовка 26–27')
      `;
      const credentials = {
        cloudName: 'author-album',
        apiKey: 'key',
        apiSecret: 'secret',
      };
      await sql`
        INSERT INTO author_cloudinary_connections (user_id, cloud_name, api_key, api_secret_encrypted)
        VALUES (${userId}, ${credentials.cloudName}, ${credentials.apiKey}, 'stubbed')
      `;
      const cloud = {
        getClientConfig: jest.fn(() => ({
          cloudName: credentials.cloudName,
          apiKey: credentials.apiKey,
        })),
        getUploadSizeLimit: jest.fn().mockResolvedValue(20_000),
        getFolderMode: jest
          .fn()
          .mockResolvedValueOnce('dynamic')
          .mockResolvedValueOnce('fixed')
          .mockResolvedValue('dynamic'),
        signUpload: jest.fn(() => ({ signature: 'unused', timestamp: 1 })),
        getUploadResource: jest.fn((publicId: string) =>
          Promise.resolve({
            public_id: publicId,
            resource_type: 'image',
            format: 'jpg',
            bytes: 1024,
            width: 1200,
            height: 800,
            secure_url: `https://res.cloudinary.com/author-album/image/upload/${publicId}.jpg`,
          }),
        ),
      };
      const db = { client: sql } as unknown as DbService;
      const config = { get: () => 'development' } as unknown as ConfigService;
      const storage = cloud as unknown as CloudinaryService;
      const authorCloud = {
        credentialsFor: jest.fn().mockResolvedValue(credentials),
      } as unknown as AuthorCloudinaryService;
      const cleanup = new MediaCleanupService(
        db,
        storage,
        new MediaEnvironmentService(config),
        authorCloud,
      );
      const environment = new MediaEnvironmentService(config);
      const media = new MediaSessionsService(
        db,
        storage,
        environment,
        cleanup,
        authorCloud,
      );
      const publisher = new PublishMediaPostService(db, media, cleanup);
      const queries = new PostsQueryService(db);
      const actor = { sub: userId, role: 'AUTHOR' } as const;
      const session = randomUUID();
      const photo = randomUUID();
      const folder = 'TH/Зимовка 26–27';
      await expect(
        media.open(session, { sub: otherId, role: 'ADMIN' }, albumId),
      ).rejects.toThrow('Альбом недоступен');
      await expect(media.open(session, actor, albumId)).resolves.toMatchObject({
        album: {
          id: albumId,
          country: 'Thailand',
          countryLabel: 'Таиланд',
          cities: ['Bangkok'],
        },
      });
      await expect(media.open(session, actor)).rejects.toThrow('другой ленты');
      const upload = { mediaType: 'PHOTO', bytes: 1024 };
      const reservation = await media.reserve(session, photo, userId, upload);
      expect(reservation.params).toEqual({
        public_id: `travel/development/${userId}/${session}/${photo}`,
        asset_folder: `travel/album-author/${folder}`,
        overwrite: false,
      });
      expect(
        (await media.reserve(session, photo, userId, upload)).params,
      ).toEqual(reservation.params);
      expect(cloud.getFolderMode).toHaveBeenCalledTimes(1);
      expect(cloud.getFolderMode).toHaveBeenCalledWith(credentials);
      await media.complete(session, photo, userId);
      await expect(
        publisher.publish(session, userId, {
          uploadIds: [photo],
          country: 'Thailand',
          city: 'Paris',
        }),
      ).rejects.toThrow('Город не найден');
      const input = {
        uploadIds: [photo],
        country: 'Thailand',
        city: 'Bangkok',
      };
      const { postId } = await publisher.publish(session, userId, input);
      await expect(publisher.publish(session, userId, input)).resolves.toEqual({
        postId,
      });

      const fixedSession = randomUUID();
      const fixedPhoto = randomUUID();
      await sql`UPDATE albums SET title = 'Новое название' WHERE id = ${albumId}`;
      await media.open(fixedSession, actor, albumId);
      expect(
        (await media.reserve(fixedSession, fixedPhoto, userId, upload)).params,
      ).toEqual({
        public_id: `travel/development/${userId}/${folder}/${fixedPhoto}`,
        overwrite: false,
      });
      await media.complete(fixedSession, fixedPhoto, userId);
      const { postId: noCityPost } = await publisher.publish(
        fixedSession,
        userId,
        { uploadIds: [fixedPhoto] },
      );
      for (const order of ['asc', 'desc'] as const) {
        const album = await queries.listPage({
          authorId: userId,
          albumId,
          order,
        });
        expect(album.items.map((post) => post.id).sort()).toEqual(
          [postId, noCityPost].sort(),
        );
        expect(album.items.map((post) => post.attachments?.length)).toEqual([
          1, 1,
        ]);
      }
      const country = await queries.listPage({
        authorId: userId,
        country: 'Thailand',
      });
      expect(country.items.map((post) => post.id)).toEqual(
        expect.arrayContaining([postId, noCityPost]),
      );
      const city = await queries.listPage({
        authorId: userId,
        country: 'Thailand',
        city: 'Bangkok',
      });
      expect(city.items.map((post) => post.id)).toContain(postId);
      expect(city.items.map((post) => post.id)).not.toContain(noCityPost);
      await expect(
        queries.listPage({ authorId: otherId, albumId }),
      ).resolves.toMatchObject({ items: [] });

      const duplicateAlbum = randomUUID();
      await sql`
        INSERT INTO albums (id, user_id, country, title)
        VALUES (${duplicateAlbum}, ${userId}, 'Thailand', 'Зимовка 26–27')
      `;
      const duplicateSession = randomUUID();
      await media.open(duplicateSession, actor, duplicateAlbum);
      const duplicate = await media.reserve(
        duplicateSession,
        randomUUID(),
        userId,
        upload,
      );
      expect(duplicate.params.asset_folder).toBe(
        `travel/album-author/${folder} (2)`,
      );
    }, 30000);

    it('keeps a country with albums in the journal after its last post is deleted', async () => {
      await runVersionedMigrations(sql);
      const userId = randomUUID();
      const otherId = randomUUID();
      const postId = randomUUID();
      await sql`
        INSERT INTO users (id, username, password_hash, role)
        VALUES (${userId}, 'empty-album-owner', 'unused', 'AUTHOR'),
               (${otherId}, 'empty-album-other', 'unused', 'AUTHOR')
      `;
      await sql`
        INSERT INTO posts (id, user_id, media_type, media_url, country, city)
        VALUES (${postId}, ${userId}, 'STORY', '', 'Thailand', 'Pattaya')
      `;
      const places = new PlacesService({ client: sql } as unknown as DbService);
      const album = await places.createAlbum(userId, 'Thailand', 'Зимовка');
      await expect(places.listPlaces(userId)).resolves.toMatchObject({
        countries: [{ country: 'Thailand', count: 1 }],
        totals: { posts: 1, stories: 1 },
      });

      await sql`DELETE FROM posts WHERE id = ${postId}`;

      const zeroStats = { posts: 0, photos: 0, videos: 0, stories: 0 };
      await expect(places.listPlaces(userId)).resolves.toEqual({
        countries: [
          { country: 'Thailand', count: 0, cities: [], stats: zeroStats },
        ],
        totals: zeroStats,
      });
      await expect(places.listAlbums(userId, 'Thailand')).resolves.toEqual([
        album,
      ]);
      await expect(
        places.createAlbum(userId, 'Thailand', 'Второй альбом'),
      ).resolves.toMatchObject({
        country: 'Thailand',
        title: 'Второй альбом',
      });
      await expect(places.listPlaces(otherId)).resolves.toEqual({
        countries: [],
        totals: zeroStats,
      });
      await expect(
        places.createAlbum(otherId, 'Thailand', 'Чужой альбом'),
      ).rejects.toThrow('Страна не найдена');
    });
  },
);
