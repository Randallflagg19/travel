import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Sql } from 'postgres';
import { DbService } from '../db/db.service';
import type { JwtUser } from '../auth/jwt-user.type';
import { MediaCleanupService } from '../media/media-cleanup.service';
import { MediaEnvironmentService } from '../media/media-environment.service';
import type { MediaDeletion } from '../media/media-session.types';

@Injectable()
export class DeletePostService {
  private readonly logger = new Logger(DeletePostService.name);

  constructor(
    private readonly db: DbService,
    private readonly cleanup: MediaCleanupService,
    private readonly environment: MediaEnvironmentService,
  ) {}

  private sql(): Sql {
    if (!this.db.client)
      throw new BadRequestException('Database is not configured');
    return this.db.client;
  }

  async deletePost(id: string, actor?: JwtUser) {
    this.environment.current();
    const sql = this.sql();
    await sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      const [post] = await tx<
        {
          user_id: string;
          media_type: string;
          cloudinary_public_id: string | null;
          media_url: string;
        }[]
      >`
        SELECT user_id, media_type, cloudinary_public_id, media_url FROM posts WHERE id = ${id}::uuid FOR UPDATE
      `;
      if (!post) return;
      if (actor?.role === 'AUTHOR' && actor.sub !== post.user_id)
        throw new ForbiddenException('You can only delete your own post');
      const resources = await tx<
        {
          cloud_name: string | null;
          public_id: string;
          resource_type: MediaDeletion['resource_type'];
          media_url: string;
        }[]
      >`
        SELECT cloud_name, cloudinary_public_id AS public_id, resource_type, media_url FROM post_media
        WHERE post_id = ${id}::uuid AND cloudinary_public_id IS NOT NULL
      `;
      if (
        post.cloudinary_public_id &&
        !resources.some(
          (resource) => resource.public_id === post.cloudinary_public_id,
        )
      ) {
        resources.push({
          cloud_name: null,
          public_id: post.cloudinary_public_id,
          resource_type: post.media_type === 'PHOTO' ? 'image' : 'video',
          media_url: post.media_url,
        });
      }
      for (const resource of resources) {
        await this.cleanup.queueResource(tx, resource);
      }
      await tx`DELETE FROM posts WHERE id = ${id}::uuid`;
    });
    await this.cleanup
      .retryCleanup()
      .catch(() =>
        this.logger.warn('Deletion is queued; immediate media cleanup failed'),
      );
    return { pendingMediaDeletions: await this.cleanup.pendingCount() };
  }
}
