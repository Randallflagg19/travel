import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Sql } from 'postgres';
import type { JwtUser } from '../auth/jwt-user.type';
import { DbService } from '../db/db.service';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import { AuthorCloudinaryService } from '../users/author-cloudinary.service';
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
    private readonly authorCloud: AuthorCloudinaryService,
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

  async open(id: string, { sub: userId, role }: JwtUser) {
    const environment = this.environment.current();
    const needsAuthorCloud = role === 'AUTHOR';
    return this.sql().begin(async (transaction) => {
      const sql = transaction as unknown as Sql;
      const [created] = await sql<Pick<MediaSession, 'author_cloud_name'>[]>`
        INSERT INTO media_sessions (id, user_id, environment, author_cloud_name)
        VALUES (${id}::uuid, ${userId}::uuid, ${environment}, (
          SELECT cloud_name FROM author_cloudinary_connections
          WHERE ${needsAuthorCloud}::boolean AND user_id = ${userId}::uuid AND is_active
        ))
        ON CONFLICT (id) DO NOTHING
        RETURNING author_cloud_name
      `;
      if (needsAuthorCloud && created?.author_cloud_name === null) {
        throw new ForbiddenException(
          'Connect Cloudinary before opening an upload form',
        );
      }
      const session = await this.lockForUser(sql, id, userId);
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
    const resourceType = mediaType === 'PHOTO' ? 'image' : 'video';
    const environment = this.environment.current();
    const db = this.sql();
    const { authorUserId, credentials, reservedLimit } = await db.begin(
      async (transaction) => {
        const sql = transaction as unknown as Sql;
        const session = await this.lockForUser(sql, sessionId, userId);
        this.assertOpen(session);
        const [existing] = await sql<MediaUpload[]>`
          SELECT * FROM media_uploads WHERE id = ${id}::uuid
        `;
        if (
          existing &&
          (existing.session_id !== sessionId ||
            existing.media_type !== mediaType ||
            Number(existing.declared_bytes) !== bytes)
        ) {
          throw new ConflictException('Upload identifier is already in use');
        }
        // A reservation made by an earlier release still uses its original credentials.
        const authorUserId = existing
          ? existing.author_user_id
          : session.author_cloud_name && userId;
        const cloudName = existing
          ? existing.cloud_name
          : session.author_cloud_name;
        const credentials =
          authorUserId && cloudName
            ? await this.authorCloud.credentialsFor(
                sql,
                authorUserId,
                cloudName,
              )
            : undefined;
        return {
          authorUserId,
          credentials,
          reservedLimit: existing?.size_limit_bytes,
        };
      },
    );
    const client = this.cloud.getClientConfig(credentials);
    // Keep the provider request outside the transaction and enforce the same limit on completion.
    const sizeLimit =
      reservedLimit ??
      (credentials
        ? Math.min(
            max,
            await this.cloud.getUploadSizeLimit(resourceType, credentials),
          )
        : max);
    if (bytes > sizeLimit)
      throw new BadRequestException(`File exceeds the ${sizeLimit} byte limit`);

    return db.begin(async (transaction) => {
      const sql = transaction as unknown as Sql;
      this.assertOpen(await this.lockForUser(sql, sessionId, userId));
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
        INSERT INTO media_uploads (id, session_id, media_type, cloud_name, public_id, resource_type, declared_bytes, author_user_id, size_limit_bytes)
        VALUES (${id}::uuid, ${sessionId}::uuid, ${mediaType}, ${client.cloudName}, ${publicId}, ${resourceType}, ${bytes}, ${authorUserId}, ${sizeLimit})
        ON CONFLICT (id) DO NOTHING
      `;
      const [upload] = await sql<
        MediaUpload[]
      >`SELECT * FROM media_uploads WHERE id = ${id}::uuid`;
      if (
        upload.session_id !== sessionId ||
        upload.media_type !== mediaType ||
        Number(upload.declared_bytes) !== bytes ||
        upload.cloud_name !== client.cloudName ||
        upload.author_user_id !== authorUserId
      ) {
        throw new ConflictException('Upload identifier is already in use');
      }
      if (upload.size_limit_bytes !== null && bytes > upload.size_limit_bytes) {
        throw new BadRequestException(
          `File exceeds the ${upload.size_limit_bytes} byte limit`,
        );
      }
      // Cloudinary signatures live for an hour; keep a safety margin for late requests.
      await sql`UPDATE media_uploads SET signature_expires_at = now() + interval '2 hours' WHERE id = ${id}::uuid`;
      const params = { public_id: publicId, overwrite: false };
      const signed = this.cloud.signUpload(params, credentials);
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
    const credentials = upload.author_user_id
      ? await this.authorCloud.credentialsFor(
          sql,
          upload.author_user_id,
          upload.cloud_name,
        )
      : undefined;
    if (
      upload.cloud_name !== this.cloud.getClientConfig(credentials).cloudName
    ) {
      throw new ConflictException('Cloudinary account has changed');
    }
    // Read authoritative metadata; never trust a client-supplied URL or dimensions.
    const resource = await this.cloud.getUploadResource(
      upload.public_id,
      upload.resource_type,
      credentials,
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
    const max =
      upload.size_limit_bytes ??
      (photo ? MEDIA_LIMITS.photoBytes : MEDIA_LIMITS.videoBytes);
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
