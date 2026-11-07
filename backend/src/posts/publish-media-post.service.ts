import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'crypto';
import type { Sql } from 'postgres';
import { DbService } from '../db/db.service';
import { MediaSessionsService } from '../media/media-sessions.service';
import { MediaCleanupService } from '../media/media-cleanup.service';
import type { MediaUpload } from '../media/media-session.types';
import { publicationBody } from './media-publication.input';

@Injectable()
export class PublishMediaPostService {
  constructor(
    private readonly db: DbService,
    private readonly sessions: MediaSessionsService,
    private readonly cleanup: MediaCleanupService,
  ) {}

  private sql(): Sql {
    if (!this.db.client)
      throw new BadRequestException('Database is not configured');
    return this.db.client;
  }

  async publish(id: string, userId: string, value: unknown) {
    const body = publicationBody(value);
    const hash = createHash('sha256')
      .update(JSON.stringify(body))
      .digest('hex');
    return this.sql().begin(async (transaction) => {
      const sql = transaction as unknown as Sql;
      const session = await this.sessions.lockForUser(sql, id, userId);
      if (session.state === 'PUBLISHED') {
        if (session.publication_hash !== hash)
          throw new ConflictException(
            'This form already published different content',
          );
        const exists =
          await sql`SELECT id FROM posts WHERE id = ${session.post_id}::uuid`;
        if (!exists.length)
          throw new GoneException('This publication has already been deleted');
        return { postId: session.post_id! };
      }
      this.sessions.assertOpen(session);
      const uploads = await sql<
        MediaUpload[]
      >`SELECT * FROM media_uploads WHERE session_id = ${id}::uuid AND id = ANY(${sql.array(body.uploadIds)}::uuid[])`;
      if (
        uploads.length !== body.uploadIds.length ||
        uploads.some((upload) => !upload.ready || !upload.media_url)
      ) {
        throw new BadRequestException(
          'Every selected file must finish uploading first',
        );
      }
      const ordered = body.uploadIds.map(
        (id) => uploads.find((upload) => upload.id === id)!,
      );
      const cover = ordered[0];
      const [post] = await sql<{ id: string }[]>`
        INSERT INTO posts (user_id, media_type, media_url, cloudinary_public_id, folder,
          media_width, media_height, title, text, country, city)
        VALUES (${userId}::uuid, ${cover.media_type}, ${cover.media_url}, ${cover.public_id},
          ${cover.public_id.slice(0, cover.public_id.lastIndexOf('/'))}, ${cover.media_width}, ${cover.media_height},
          ${body.title}, ${body.text}, ${body.country}, ${body.city}) RETURNING id
      `;
      for (const [position, upload] of ordered.entries()) {
        await sql`
          INSERT INTO post_media (id, post_id, upload_id, position, media_type, media_url,
            cloudinary_public_id, cloud_name, resource_type, media_width, media_height)
          VALUES (${upload.id}::uuid, ${post.id}::uuid, ${upload.id}::uuid, ${position}, ${upload.media_type},
            ${upload.media_url}, ${upload.public_id}, ${upload.cloud_name}, ${upload.resource_type}, ${upload.media_width}, ${upload.media_height})
        `;
      }
      await sql`UPDATE media_sessions SET state = 'PUBLISHED', post_id = ${post.id}::uuid, publication_hash = ${hash} WHERE id = ${id}::uuid`;
      await this.cleanup.queueUnused(sql, id);
      return { postId: post.id };
    });
  }
}
