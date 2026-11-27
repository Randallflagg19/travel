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
import { MEDIA_LIMITS, objectBody, optionalText, uuid } from './media-contract';
import {
  albumCountryLabel,
  albumFolderParts,
  mediaCountryFolder,
  mediaOwnerFolder,
  type MediaAlbum,
} from './media-album';
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
      SELECT s.*, s.expires_at <= now() AS expired, a.country AS album_country
      FROM media_sessions s
      LEFT JOIN albums a ON a.id = s.album_id
      WHERE s.id = ${id}::uuid FOR UPDATE OF s
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

  private async reserveAlbumFolder(
    sql: Sql,
    albumId: string,
    userId: string,
    environment: string,
  ) {
    const [album] = await sql<
      {
        folder_path: string | null;
        username: string;
        country: string;
        title: string;
      }[]
    >`
      SELECT a.folder_path, u.username, a.country, a.title
      FROM albums a JOIN users u ON u.id = a.user_id
      WHERE a.id = ${albumId}::uuid AND a.user_id = ${userId}::uuid
      FOR UPDATE OF a
    `;
    if (!album)
      throw new BadRequestException('Альбом недоступен в вашем журнале');
    if (album.folder_path) return album.folder_path;

    const { ownerFolder, countryCode, titleFolder } = albumFolderParts(
      album.username,
      userId,
      album.country,
      album.title,
      environment,
    );
    const parent = `${ownerFolder}/${countryCode}`;
    // Serialize allocations in the same directory, including simultaneous first uploads.
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(lower(${parent}), 0))`;
    const [available] = await sql<{ path: string }[]>`
      WITH RECURSIVE candidates(path, suffix) AS (
        SELECT ${`${parent}/${titleFolder}`}::text, 1
        UNION ALL
        SELECT ${`${parent}/${titleFolder}`}::text || ' (' || (c.suffix + 1) || ')', c.suffix + 1
        FROM candidates c
        WHERE EXISTS (SELECT 1 FROM albums WHERE lower(folder_path) = lower(c.path))
      )
      SELECT path FROM candidates ORDER BY suffix DESC LIMIT 1
    `;
    await sql`UPDATE albums SET folder_path = ${available.path} WHERE id = ${albumId}::uuid`;
    return available.path;
  }

  async open(
    id: string,
    { sub: userId, role }: JwtUser,
    requestedAlbum?: unknown,
    requestedCountry?: unknown,
  ) {
    const environment = this.environment.current();
    const needsAuthorCloud = role === 'AUTHOR';
    const albumId = requestedAlbum == null ? null : uuid(requestedAlbum);
    const country = albumId ? null : optionalText(requestedCountry, 200);
    return this.sql().begin(async (transaction) => {
      const sql = transaction as unknown as Sql;
      let album: MediaAlbum | undefined;
      if (albumId) {
        [album] = await sql<MediaAlbum[]>`
          SELECT a.id, a.title, a.country, ARRAY(
            SELECT DISTINCT btrim(p.city)
            FROM posts p
            WHERE p.user_id = a.user_id AND btrim(p.country) = a.country
              AND NULLIF(btrim(p.city), '') IS NOT NULL
            ORDER BY 1
          ) AS cities
          FROM albums a
          WHERE a.id = ${albumId}::uuid AND a.user_id = ${userId}::uuid
        `;
        if (!album)
          throw new BadRequestException('Альбом недоступен в вашем журнале');
      }
      const [created] = await sql<Pick<MediaSession, 'author_cloud_name'>[]>`
        INSERT INTO media_sessions (id, user_id, environment, album_id, country, author_cloud_name)
        VALUES (${id}::uuid, ${userId}::uuid, ${environment}, ${albumId}::uuid, ${country}, (
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
      if (
        (session.album_id ?? null) !== albumId ||
        (session.country ?? null) !== country
      ) {
        throw new ConflictException('Эта форма уже открыта для другой ленты');
      }
      return {
        id,
        limits: MEDIA_LIMITS,
        ...(album && {
          album: { ...album, countryLabel: albumCountryLabel(album.country) },
        }),
      };
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
    const { authorUserId, credentials, existing, albumId, country } =
      await db.begin(async (transaction) => {
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
          existing,
          albumId: session.album_id,
          country: session.country,
        };
      });
    const client = this.cloud.getClientConfig(credentials);
    // Keep the provider request outside the transaction and enforce the same limit on completion.
    const sizeLimit =
      existing?.size_limit_bytes ??
      (credentials
        ? Math.min(
            max,
            await this.cloud.getUploadSizeLimit(resourceType, credentials),
          )
        : max);
    if (bytes > sizeLimit)
      throw new BadRequestException(`File exceeds the ${sizeLimit} byte limit`);

    const mode = existing ? null : await this.cloud.getFolderMode(credentials);

    return db.begin(async (transaction) => {
      const sql = transaction as unknown as Sql;
      this.assertOpen(await this.lockForUser(sql, sessionId, userId));
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
      const albumFolder =
        mode && albumId
          ? await this.reserveAlbumFolder(sql, albumId, userId, environment)
          : null;
      const countryFolder = country ? mediaCountryFolder(country) : null;
      const fixedFolder = albumFolder
        ? albumFolder.slice(albumFolder.indexOf('/') + 1)
        : countryFolder;
      const publicId =
        existing?.public_id ??
        `travel/${environment}/${userId}/${mode === 'fixed' ? (fixedFolder ?? sessionId) : sessionId}/${id}`;
      let assetFolder = existing?.asset_folder ?? null;
      if (mode === 'dynamic') {
        if (albumFolder) {
          assetFolder = `travel/${albumFolder}`;
        } else {
          const [owner] = await sql<{ username: string }[]>`
            SELECT username FROM users WHERE id = ${userId}::uuid
          `;
          assetFolder = `travel/${mediaOwnerFolder(owner.username, userId, environment)}`;
          if (countryFolder) assetFolder += `/${countryFolder}`;
        }
      }
      await sql`
        INSERT INTO media_uploads (id, session_id, media_type, cloud_name, public_id, resource_type, declared_bytes, author_user_id, size_limit_bytes, asset_folder)
        VALUES (${id}::uuid, ${sessionId}::uuid, ${mediaType}, ${client.cloudName}, ${publicId}, ${resourceType}, ${bytes}, ${authorUserId}, ${sizeLimit}, ${assetFolder})
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
      const params = {
        public_id: upload.public_id,
        overwrite: false,
        ...(upload.asset_folder && { asset_folder: upload.asset_folder }),
      };
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
