import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import type { Sql } from 'postgres';
import { DbService } from '../db/db.service';
import type { JwtUser } from '../auth/jwt-user.type';
import { CloudinaryService } from './cloudinary.service';
import { MEDIA_LIMITS, objectBody, publicationBody } from './media-contract';

type Session = {
  id: string;
  user_id: string;
  environment: string;
  state: string;
  post_id: string | null;
  publication_hash: string | null;
  expired: boolean;
};
type Upload = {
  id: string;
  session_id: string;
  media_type: 'PHOTO' | 'VIDEO';
  cloud_name: string;
  public_id: string;
  resource_type: 'image' | 'video';
  declared_bytes: number;
  ready: boolean;
  media_url: string | null;
  media_width: number | null;
  media_height: number | null;
};
type Deletion = {
  id: string;
  cloud_name: string;
  public_id: string;
  resource_type: 'image' | 'video' | 'raw';
  attempts: number;
};

@Injectable()
export class MediaService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MediaService.name);
  private timer?: ReturnType<typeof setInterval>;
  private working = false;

  constructor(
    private readonly db: DbService,
    private readonly cloud: CloudinaryService,
    private readonly config: ConfigService,
  ) {}

  private sql(): Sql {
    if (!this.db.client)
      throw new BadRequestException('Database is not configured');
    return this.db.client;
  }

  private environment(): string {
    const value =
      this.config.get<string>('MEDIA_ENVIRONMENT') ||
      (this.config.get<string>('NODE_ENV') === 'production'
        ? ''
        : 'development');
    if (!['production', 'staging', 'development', 'test'].includes(value)) {
      throw new BadRequestException(
        'Set MEDIA_ENVIRONMENT to production, staging, development or test',
      );
    }
    return value;
  }

  private async session(
    sql: Sql,
    id: string,
    userId: string,
  ): Promise<Session> {
    const [session] = await sql<Session[]>`
      SELECT *, expires_at <= now() AS expired FROM media_sessions WHERE id = ${id}::uuid FOR UPDATE
    `;
    if (!session) throw new NotFoundException('Upload form was not found');
    if (
      session.user_id !== userId ||
      session.environment !== this.environment()
    ) {
      throw new ForbiddenException(
        'This upload form belongs to another user or environment',
      );
    }
    return session;
  }

  private assertOpen(session: Session) {
    if (session.state !== 'OPEN' || session.expired) {
      throw new ConflictException('This upload form is closed or expired');
    }
  }

  async open(id: string, userId: string) {
    const sql = this.sql();
    const environment = this.environment();
    await sql`
      INSERT INTO media_sessions (id, user_id, environment) VALUES (${id}::uuid, ${userId}::uuid, ${environment})
      ON CONFLICT (id) DO NOTHING
    `;
    return sql.begin(async (transaction) => {
      const session = await this.session(
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
    const environment = this.environment();
    return this.sql().begin(async (transaction) => {
      const sql = transaction as unknown as Sql;
      this.assertOpen(await this.session(sql, sessionId, userId));
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
        Upload[]
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
      this.assertOpen(await this.session(tx, sessionId, userId));
      const [upload] = await tx<
        Upload[]
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
      this.assertOpen(await this.session(tx, sessionId, userId));
      await tx`
        UPDATE media_uploads SET ready = true, media_url = ${resource.secure_url},
          media_width = ${resource.width}, media_height = ${resource.height}
        WHERE id = ${id}::uuid
      `;
    });
    return { ready: true };
  }

  private async queueUnused(sql: Sql, sessionId: string) {
    await sql`
      INSERT INTO media_deletions (environment, cloud_name, public_id, resource_type, next_attempt_at, retain_until)
      SELECT s.environment, u.cloud_name, u.public_id, u.resource_type,
        GREATEST(now(), u.signature_expires_at), u.signature_expires_at
      FROM media_uploads u JOIN media_sessions s ON s.id = u.session_id
      WHERE u.session_id = ${sessionId}::uuid AND NOT EXISTS (SELECT 1 FROM post_media m WHERE m.upload_id = u.id)
      ON CONFLICT (cloud_name, resource_type, public_id) DO NOTHING
    `;
  }

  async publish(id: string, userId: string, value: unknown) {
    const body = publicationBody(value);
    const hash = createHash('sha256')
      .update(JSON.stringify(body))
      .digest('hex');
    return this.sql().begin(async (transaction) => {
      const sql = transaction as unknown as Sql;
      const session = await this.session(sql, id, userId);
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
      this.assertOpen(session);
      const uploads = await sql<
        Upload[]
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
      await this.queueUnused(sql, id);
      return { postId: post.id };
    });
  }

  async cancel(id: string, userId: string) {
    return this.sql().begin(async (transaction) => {
      const sql = transaction as unknown as Sql;
      const session = await this.session(sql, id, userId).catch(
        (error: unknown) => {
          if (error instanceof NotFoundException) return null;
          throw error;
        },
      );
      if (!session) return { postId: null };
      // A lost publish response must never turn Cancel into deletion of a published asset.
      if (session.state === 'PUBLISHED') return { postId: session.post_id };
      await sql`UPDATE media_sessions SET state = 'CANCELLED' WHERE id = ${id}::uuid`;
      await this.queueUnused(sql, id);
      return { postId: null };
    });
  }

  async deletePost(id: string, actor?: JwtUser) {
    const environment = this.environment();
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
          resource_type: Deletion['resource_type'];
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
        const cloudName = this.cloud.getClientConfig().cloudName;
        const storedCloud =
          resource.cloud_name ||
          resource.media_url.match(
            /^https:\/\/res\.cloudinary\.com\/([^/]+)\//,
          )?.[1];
        const namespaced =
          /^travel\/(production|staging|development|test)\//.test(
            resource.public_id,
          );
        const ownedEnvironment = resource.public_id.startsWith(
          `travel/${environment}/`,
        );
        const legacyProduction = !namespaced && environment === 'production';
        if (
          storedCloud !== cloudName ||
          (!ownedEnvironment && !legacyProduction)
        ) {
          throw new ConflictException(
            'Media belongs to another Cloudinary account or environment; deletion is blocked',
          );
        }
        await tx`
          INSERT INTO media_deletions (environment, cloud_name, public_id, resource_type, retain_until)
          VALUES (${environment}, ${storedCloud}, ${resource.public_id}, ${resource.resource_type},
            COALESCE((SELECT MAX(signature_expires_at) FROM media_uploads WHERE cloud_name = ${storedCloud} AND public_id = ${resource.public_id}), now()))
          ON CONFLICT (cloud_name, resource_type, public_id) DO UPDATE SET next_attempt_at = now()
        `;
      }
      await tx`DELETE FROM posts WHERE id = ${id}::uuid`;
    });
    await this.retryCleanup().catch(() =>
      this.logger.warn('Deletion is queued; immediate media cleanup failed'),
    );
    const [result] = await sql<
      { count: number }[]
    >`SELECT COUNT(*)::int AS count FROM media_deletions WHERE environment = ${environment}`;
    return { pendingMediaDeletions: result.count };
  }

  async cleanupStatus() {
    const environment = this.environment();
    const jobs = await this.sql()`
      SELECT id, attempts, last_error, next_attempt_at FROM media_deletions
      WHERE environment = ${environment} ORDER BY created_at LIMIT 100
    `;
    return { jobs };
  }

  async retryFailedCleanup() {
    const environment = this.environment();
    // Force failed jobs only; retain the safety delay for cancelled uploads.
    await this.sql()`UPDATE media_deletions SET next_attempt_at = now()
      WHERE environment = ${environment} AND last_error IS NOT NULL`;
    await this.retryCleanup();
    return this.cleanupStatus();
  }

  async retryCleanup() {
    if (this.working || !this.db.client) return;
    this.working = true;
    try {
      const sql = this.sql();
      const environment = this.environment();
      await sql.begin(async (transaction) => {
        const tx = transaction as unknown as Sql;
        const expired = await tx<{ id: string }[]>`
          UPDATE media_sessions SET state = 'CANCELLED' WHERE state = 'OPEN' AND expires_at <= now()
            AND environment = ${environment} RETURNING id
        `;
        for (const session of expired) await this.queueUnused(tx, session.id);
      });
      const jobs = await sql<Deletion[]>`
        UPDATE media_deletions SET next_attempt_at = now() + interval '5 minutes'
        WHERE id IN (SELECT id FROM media_deletions WHERE environment = ${environment} AND next_attempt_at <= now()
          ORDER BY next_attempt_at LIMIT 10 FOR UPDATE SKIP LOCKED)
        RETURNING id, cloud_name, public_id, resource_type, attempts
      `;
      for (const job of jobs) {
        try {
          const referenced = await sql`
            SELECT 1 FROM post_media WHERE cloudinary_public_id = ${job.public_id} AND (cloud_name = ${job.cloud_name} OR cloud_name IS NULL)
            UNION ALL SELECT 1 FROM posts WHERE cloudinary_public_id = ${job.public_id}
            UNION ALL SELECT 1 FROM media_uploads u JOIN media_sessions s ON s.id = u.session_id
              WHERE u.public_id = ${job.public_id} AND u.cloud_name = ${job.cloud_name} AND s.state = 'OPEN' LIMIT 1
          `;
          if (referenced.length)
            throw new Error('Resource is still referenced; deletion postponed');
          if (this.cloud.getClientConfig().cloudName !== job.cloud_name)
            throw new Error('Cloudinary account does not match deletion job');
          await this.cloud.destroy(job.public_id, job.resource_type);
          await sql`DELETE FROM media_deletions WHERE id = ${job.id}::uuid AND retain_until <= now()`;
          await sql`UPDATE media_deletions SET next_attempt_at = retain_until, last_error = NULL WHERE id = ${job.id}::uuid`;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Cloudinary deletion failed';
          const seconds = Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7));
          await sql`UPDATE media_deletions SET attempts = attempts + 1, last_error = ${message.slice(0, 500)},
            next_attempt_at = now() + ${seconds} * interval '1 second' WHERE id = ${job.id}::uuid`;
        }
      }
    } finally {
      this.working = false;
    }
  }

  onApplicationBootstrap() {
    if (!this.db.client) return;
    const run = () => {
      void this.retryCleanup().catch(() =>
        this.logger.warn('Media cleanup failed; it will retry automatically'),
      );
    };
    this.timer = setInterval(run, 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
