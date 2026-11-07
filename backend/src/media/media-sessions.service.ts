import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Sql } from 'postgres';
import { DbService } from '../db/db.service';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import { MEDIA_LIMITS, objectBody } from './media-contract';
import { MediaEnvironmentService } from './media-environment.service';
import { MediaCleanupService } from './media-cleanup.service';
import type { MediaSession, MediaUpload } from './media-session.types';

@Injectable()
export class MediaSessionsService {
  constructor(
    private readonly db: DbService,
    private readonly cloud: CloudinaryService,
    private readonly environment: MediaEnvironmentService,
    private readonly cleanup: MediaCleanupService,
  ) {}

  private sql(): Sql {
    if (!this.db.client)
      throw new BadRequestException('Database is not configured');
    return this.db.client;
  }

  async lockForUser(
    sql: Sql,
    id: string,
    userId: string,
  ): Promise<MediaSession> {
    const [session] = await sql<MediaSession[]>`
      SELECT *, expires_at <= now() AS expired FROM media_sessions WHERE id = ${id}::uuid FOR UPDATE
    `;
    if (!session) throw new NotFoundException('Upload form was not found');
    if (
      session.user_id !== userId ||
      session.environment !== this.environment.current()
    ) {
      throw new ForbiddenException(
        'This upload form belongs to another user or environment',
      );
    }
    return session;
  }

  assertOpen(session: MediaSession) {
    if (session.state !== 'OPEN' || session.expired) {
      throw new ConflictException('This upload form is closed or expired');
    }
  }

  async open(id: string, userId: string) {
    const sql = this.sql();
    const environment = this.environment.current();
    await sql`
      INSERT INTO media_sessions (id, user_id, environment) VALUES (${id}::uuid, ${userId}::uuid, ${environment})
      ON CONFLICT (id) DO NOTHING
    `;
    return sql.begin(async (transaction) => {
      const session = await this.lockForUser(
        transaction as unknown as Sql,
        id,
        userId,
      );
      this.assertOpen(session);
      return { id, limits: MEDIA_LIMITS };
    });
  }

  async reserve(sessionId: string, id: string, userId: string, value: unknown) {
    const body = objectBody(value);
    if (body.mediaType !== 'PHOTO' && body.mediaType !== 'VIDEO') {
      throw new BadRequestException('Only photos and videos are supported');
    }
    const mediaType = body.mediaType;
    const max =
      mediaType === 'PHOTO' ? MEDIA_LIMITS.photoBytes : MEDIA_LIMITS.videoBytes;
    if (
      typeof body.bytes !== 'number' ||
      !Number.isSafeInteger(body.bytes) ||
      body.bytes < 1 ||
      body.bytes > max
    ) {
      throw new BadRequestException(`File exceeds the ${max} byte limit`);
    }
    const bytes = body.bytes;
    const client = this.cloud.getClientConfig();
    const environment = this.environment.current();
    return this.sql().begin(async (transaction) => {
      const sql = transaction as unknown as Sql;
      this.assertOpen(await this.lockForUser(sql, sessionId, userId));
      const resourceType = mediaType === 'PHOTO' ? 'image' : 'video';
      const publicId = `travel/${environment}/${userId}/${sessionId}/${id}`;
      const [count] = await sql<
        { count: number }[]
      >`SELECT COUNT(*)::int AS count FROM media_uploads WHERE session_id = ${sessionId}::uuid`;
      if (count.count >= 50) {
        const existing =
          await sql`SELECT id FROM media_uploads WHERE id = ${id}::uuid AND session_id = ${sessionId}::uuid`;
        if (!existing.length)
          throw new BadRequestException(
            'Too many replacements; open a new upload form',
          );
      }
      await sql`
        INSERT INTO media_uploads (id, session_id, media_type, cloud_name, public_id, resource_type, declared_bytes)
        VALUES (${id}::uuid, ${sessionId}::uuid, ${mediaType}, ${client.cloudName}, ${publicId}, ${resourceType}, ${bytes})
        ON CONFLICT (id) DO NOTHING
      `;
      const [upload] = await sql<
        MediaUpload[]
      >`SELECT * FROM media_uploads WHERE id = ${id}::uuid`;
      if (
        upload.session_id !== sessionId ||
        upload.media_type !== mediaType ||
        Number(upload.declared_bytes) !== bytes ||
        upload.cloud_name !== client.cloudName
      ) {
        throw new ConflictException('Upload identifier is already in use');
      }
      // Cloudinary signatures live for an hour; keep a safety margin for late requests.
      await sql`UPDATE media_uploads SET signature_expires_at = now() + interval '2 hours' WHERE id = ${id}::uuid`;
      const params = { public_id: publicId, overwrite: false };
      const signed = this.cloud.signUpload(params);
      return {
        ...client,
        ...signed,
        params,
        resourceType,
        ready: upload.ready,
      };
    });
  }

  async complete(sessionId: string, id: string, userId: string) {
    const sql = this.sql();
    const upload = await sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      this.assertOpen(await this.lockForUser(tx, sessionId, userId));
      const [upload] = await tx<
        MediaUpload[]
      >`SELECT * FROM media_uploads WHERE id = ${id}::uuid AND session_id = ${sessionId}::uuid`;
      if (!upload) throw new NotFoundException('Upload was not reserved');
      return upload;
    });
    if (upload.ready) return { ready: true };
    if (upload.cloud_name !== this.cloud.getClientConfig().cloudName) {
      throw new ConflictException('Cloudinary account has changed');
    }
    // Read authoritative metadata; never trust a client-supplied URL or dimensions.
    const resource = await this.cloud.getUploadResource(
      upload.public_id,
      upload.resource_type,
    );
    if (!resource) return { ready: false };
    const photo = upload.media_type === 'PHOTO';
    const formats = photo
      ? ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif', 'gif']
      : [
          'mp4',
          'mov',
          'webm',
          'mkv',
          'avi',
          'm4v',
          'mpg',
          'mpeg',
          '3gp',
          'ogv',
        ];
    const max = photo ? MEDIA_LIMITS.photoBytes : MEDIA_LIMITS.videoBytes;
    if (
      resource.public_id !== upload.public_id ||
      resource.resource_type !== upload.resource_type ||
      !formats.includes(resource.format) ||
      !Number.isSafeInteger(resource.bytes) ||
      resource.bytes < 1 ||
      resource.bytes > max ||
      !Number.isSafeInteger(resource.width) ||
      resource.width < 1 ||
      resource.width > 100_000 ||
      !Number.isSafeInteger(resource.height) ||
      resource.height < 1 ||
      resource.height > 100_000 ||
      (!photo &&
        (!Number.isFinite(resource.duration) ||
          resource.duration <= 0 ||
          resource.duration > MEDIA_LIMITS.videoSeconds)) ||
      typeof resource.secure_url !== 'string' ||
      !resource.secure_url.startsWith(
        `https://res.cloudinary.com/${upload.cloud_name}/`,
      )
    ) {
      throw new BadRequestException(
        'Unsupported media or file size/duration limit exceeded',
      );
    }
    await sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      this.assertOpen(await this.lockForUser(tx, sessionId, userId));
      await tx`
        UPDATE media_uploads SET ready = true, media_url = ${resource.secure_url},
          media_width = ${resource.width}, media_height = ${resource.height}
        WHERE id = ${id}::uuid
      `;
    });
    return { ready: true };
  }

  async cancel(id: string, userId: string) {
    return this.sql().begin(async (transaction) => {
      const sql = transaction as unknown as Sql;
      const session = await this.lockForUser(sql, id, userId).catch(
        (error: unknown) => {
          if (error instanceof NotFoundException) return null;
          throw error;
        },
      );
      if (!session) return { postId: null };
      // A lost publish response must never turn Cancel into deletion of a published asset.
      if (session.state === 'PUBLISHED') return { postId: session.post_id };
      await sql`UPDATE media_sessions SET state = 'CANCELLED' WHERE id = ${id}::uuid`;
      await this.cleanup.queueUnused(sql, id);
      return { postId: null };
    });
  }
}
