import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

export type MediaType = 'PHOTO' | 'VIDEO' | 'AUDIO';

export type PostRow = {
  id: string;
  user_id: string;
  media_type: MediaType;
  media_url: string;
  cloudinary_public_id: string | null;
  folder: string | null;
  text: string | null;
  country: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  like_count: number;
  comment_count: number;
};

type PostsCursor = {
  created_at: string;
  id: string;
};

function encodeCursor(cursor: PostsCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): PostsCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as unknown;
  } catch {
    throw new BadRequestException('Invalid cursor');
  }
  const obj = parsed as Partial<PostsCursor> | null;
  if (!obj || typeof obj !== 'object')
    throw new BadRequestException('Invalid cursor');
  if (typeof obj.created_at !== 'string')
    throw new BadRequestException('Invalid cursor');
  if (typeof obj.id !== 'string')
    throw new BadRequestException('Invalid cursor');
  return { created_at: obj.created_at, id: obj.id };
}

function mediaTypeToCloudinaryResource(
  mediaType: MediaType,
): 'image' | 'video' | 'raw' {
  if (mediaType === 'PHOTO') return 'image';
  if (mediaType === 'VIDEO' || mediaType === 'AUDIO') return 'video';
  return 'image';
}

@Injectable()
export class PostsService {
  constructor(
    private readonly db: DbService,
    private readonly cloud: CloudinaryService,
  ) {}

  async listPage(params?: {
    limit?: number;
    cursor?: string;
    country?: string;
    city?: string;
    unknown?: boolean;
    order?: 'asc' | 'desc';
  }): Promise<{
    items: PostRow[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    if (!this.db.client) return { items: [], nextCursor: null, hasMore: false };
    const safeLimit = Math.max(1, Math.min(200, params?.limit ?? 50));
    const limitPlusOne = safeLimit + 1;

    const decoded = params?.cursor ? decodeCursor(params.cursor) : null;

    const order: 'asc' | 'desc' = params?.order === 'asc' ? 'asc' : 'desc';
    const wantUnknown = Boolean(params?.unknown);
    const country = params?.country?.trim() ? params.country.trim() : undefined;
    const city = params?.city?.trim() ? params.city.trim() : undefined;

    // We intentionally keep the SQL explicit (few branches) to avoid unsafe string building.
    const rows =
      order === 'asc'
        ? decoded
          ? wantUnknown
            ? await this.db.client<PostRow[]>`
                SELECT
                  p.*,
                  COALESCE(l.like_count, 0)::int AS like_count,
                  COALESCE(c.comment_count, 0)::int AS comment_count
                FROM posts p
                LEFT JOIN (
                  SELECT post_id, COUNT(*) AS like_count
                  FROM likes
                  GROUP BY post_id
                ) l ON l.post_id = p.id
                LEFT JOIN (
                  SELECT post_id, COUNT(*) AS comment_count
                  FROM comments
                  GROUP BY post_id
                ) c ON c.post_id = p.id
                WHERE
                  (p.country IS NULL OR TRIM(p.country) = '' OR p.city IS NULL OR TRIM(p.city) = '')
                  AND (
                    (p.created_at > ${decoded.created_at}::timestamptz)
                    OR (
                      p.created_at = ${decoded.created_at}::timestamptz
                      AND p.id > ${decoded.id}::uuid
                    )
                  )
                ORDER BY p.created_at ASC, p.id ASC
                LIMIT ${limitPlusOne}
              `
            : country && city
              ? await this.db.client<PostRow[]>`
                  SELECT
                    p.*,
                    COALESCE(l.like_count, 0)::int AS like_count,
                    COALESCE(c.comment_count, 0)::int AS comment_count
                  FROM posts p
                  LEFT JOIN (
                    SELECT post_id, COUNT(*) AS like_count
                    FROM likes
                    GROUP BY post_id
                  ) l ON l.post_id = p.id
                  LEFT JOIN (
                    SELECT post_id, COUNT(*) AS comment_count
                    FROM comments
                    GROUP BY post_id
                  ) c ON c.post_id = p.id
                  WHERE
                    p.country = ${country}
                    AND p.city = ${city}
                    AND (
                      (p.created_at > ${decoded.created_at}::timestamptz)
                      OR (
                        p.created_at = ${decoded.created_at}::timestamptz
                        AND p.id > ${decoded.id}::uuid
                      )
                    )
                  ORDER BY p.created_at ASC, p.id ASC
                  LIMIT ${limitPlusOne}
                `
              : await this.db.client<PostRow[]>`
                  SELECT
                    p.*,
                    COALESCE(l.like_count, 0)::int AS like_count,
                    COALESCE(c.comment_count, 0)::int AS comment_count
                  FROM posts p
                  LEFT JOIN (
                    SELECT post_id, COUNT(*) AS like_count
                    FROM likes
                    GROUP BY post_id
                  ) l ON l.post_id = p.id
                  LEFT JOIN (
                    SELECT post_id, COUNT(*) AS comment_count
                    FROM comments
                    GROUP BY post_id
                  ) c ON c.post_id = p.id
                  WHERE
                    (
                      (p.created_at > ${decoded.created_at}::timestamptz)
                      OR (
                        p.created_at = ${decoded.created_at}::timestamptz
                        AND p.id > ${decoded.id}::uuid
                      )
                    )
                  ORDER BY p.created_at ASC, p.id ASC
                  LIMIT ${limitPlusOne}
                `
          : wantUnknown
            ? await this.db.client<PostRow[]>`
                SELECT
                  p.*,
                  COALESCE(l.like_count, 0)::int AS like_count,
                  COALESCE(c.comment_count, 0)::int AS comment_count
                FROM posts p
                LEFT JOIN (
                  SELECT post_id, COUNT(*) AS like_count
                  FROM likes
                  GROUP BY post_id
                ) l ON l.post_id = p.id
                LEFT JOIN (
                  SELECT post_id, COUNT(*) AS comment_count
                  FROM comments
                  GROUP BY post_id
                ) c ON c.post_id = p.id
                WHERE
                  (p.country IS NULL OR TRIM(p.country) = '' OR p.city IS NULL OR TRIM(p.city) = '')
                ORDER BY p.created_at ASC, p.id ASC
                LIMIT ${limitPlusOne}
              `
            : country && city
              ? await this.db.client<PostRow[]>`
                  SELECT
                    p.*,
                    COALESCE(l.like_count, 0)::int AS like_count,
                    COALESCE(c.comment_count, 0)::int AS comment_count
                  FROM posts p
                  LEFT JOIN (
                    SELECT post_id, COUNT(*) AS like_count
                    FROM likes
                    GROUP BY post_id
                  ) l ON l.post_id = p.id
                  LEFT JOIN (
                    SELECT post_id, COUNT(*) AS comment_count
                    FROM comments
                    GROUP BY post_id
                  ) c ON c.post_id = p.id
                  WHERE
                    p.country = ${country}
                    AND p.city = ${city}
                  ORDER BY p.created_at ASC, p.id ASC
                  LIMIT ${limitPlusOne}
                `
              : await this.db.client<PostRow[]>`
                  SELECT
                    p.*,
                    COALESCE(l.like_count, 0)::int AS like_count,
                    COALESCE(c.comment_count, 0)::int AS comment_count
                  FROM posts p
                  LEFT JOIN (
                    SELECT post_id, COUNT(*) AS like_count
                    FROM likes
                    GROUP BY post_id
                  ) l ON l.post_id = p.id
                  LEFT JOIN (
                    SELECT post_id, COUNT(*) AS comment_count
                    FROM comments
                    GROUP BY post_id
                  ) c ON c.post_id = p.id
                  ORDER BY p.created_at ASC, p.id ASC
                  LIMIT ${limitPlusOne}
                `
        : decoded
          ? wantUnknown
            ? await this.db.client<PostRow[]>`
                SELECT
                  p.*,
                  COALESCE(l.like_count, 0)::int AS like_count,
                  COALESCE(c.comment_count, 0)::int AS comment_count
                FROM posts p
                LEFT JOIN (
                  SELECT post_id, COUNT(*) AS like_count
                  FROM likes
                  GROUP BY post_id
                ) l ON l.post_id = p.id
                LEFT JOIN (
                  SELECT post_id, COUNT(*) AS comment_count
                  FROM comments
                  GROUP BY post_id
                ) c ON c.post_id = p.id
                WHERE
                  (p.country IS NULL OR TRIM(p.country) = '' OR p.city IS NULL OR TRIM(p.city) = '')
                  AND (
                    (p.created_at < ${decoded.created_at}::timestamptz)
                    OR (
                      p.created_at = ${decoded.created_at}::timestamptz
                      AND p.id < ${decoded.id}::uuid
                    )
                  )
                ORDER BY p.created_at DESC, p.id DESC
                LIMIT ${limitPlusOne}
              `
            : country && city
              ? await this.db.client<PostRow[]>`
                  SELECT
                    p.*,
                    COALESCE(l.like_count, 0)::int AS like_count,
                    COALESCE(c.comment_count, 0)::int AS comment_count
                  FROM posts p
                  LEFT JOIN (
                    SELECT post_id, COUNT(*) AS like_count
                    FROM likes
                    GROUP BY post_id
                  ) l ON l.post_id = p.id
                  LEFT JOIN (
                    SELECT post_id, COUNT(*) AS comment_count
                    FROM comments
                    GROUP BY post_id
                  ) c ON c.post_id = p.id
                  WHERE
                    p.country = ${country}
                    AND p.city = ${city}
                    AND (
                      (p.created_at < ${decoded.created_at}::timestamptz)
                      OR (
                        p.created_at = ${decoded.created_at}::timestamptz
                        AND p.id < ${decoded.id}::uuid
                      )
                    )
                  ORDER BY p.created_at DESC, p.id DESC
                  LIMIT ${limitPlusOne}
                `
              : await this.db.client<PostRow[]>`
                  SELECT
                    p.*,
                    COALESCE(l.like_count, 0)::int AS like_count,
                    COALESCE(c.comment_count, 0)::int AS comment_count
                  FROM posts p
                  LEFT JOIN (
                    SELECT post_id, COUNT(*) AS like_count
                    FROM likes
                    GROUP BY post_id
                  ) l ON l.post_id = p.id
                  LEFT JOIN (
                    SELECT post_id, COUNT(*) AS comment_count
                    FROM comments
                    GROUP BY post_id
                  ) c ON c.post_id = p.id
                  WHERE
                    (
                      (p.created_at < ${decoded.created_at}::timestamptz)
                      OR (
                        p.created_at = ${decoded.created_at}::timestamptz
                        AND p.id < ${decoded.id}::uuid
                      )
                    )
                  ORDER BY p.created_at DESC, p.id DESC
                  LIMIT ${limitPlusOne}
                `
          : wantUnknown
            ? await this.db.client<PostRow[]>`
                SELECT
                  p.*,
                  COALESCE(l.like_count, 0)::int AS like_count,
                  COALESCE(c.comment_count, 0)::int AS comment_count
                FROM posts p
                LEFT JOIN (
                  SELECT post_id, COUNT(*) AS like_count
                  FROM likes
                  GROUP BY post_id
                ) l ON l.post_id = p.id
                LEFT JOIN (
                  SELECT post_id, COUNT(*) AS comment_count
                  FROM comments
                  GROUP BY post_id
                ) c ON c.post_id = p.id
                WHERE
                  (p.country IS NULL OR TRIM(p.country) = '' OR p.city IS NULL OR TRIM(p.city) = '')
                ORDER BY p.created_at DESC, p.id DESC
                LIMIT ${limitPlusOne}
              `
            : country && city
              ? await this.db.client<PostRow[]>`
                  SELECT
                    p.*,
                    COALESCE(l.like_count, 0)::int AS like_count,
                    COALESCE(c.comment_count, 0)::int AS comment_count
                  FROM posts p
                  LEFT JOIN (
                    SELECT post_id, COUNT(*) AS like_count
                    FROM likes
                    GROUP BY post_id
                  ) l ON l.post_id = p.id
                  LEFT JOIN (
                    SELECT post_id, COUNT(*) AS comment_count
                    FROM comments
                    GROUP BY post_id
                  ) c ON c.post_id = p.id
                  WHERE
                    p.country = ${country}
                    AND p.city = ${city}
                  ORDER BY p.created_at DESC, p.id DESC
                  LIMIT ${limitPlusOne}
                `
              : await this.db.client<PostRow[]>`
                  SELECT
                    p.*,
                    COALESCE(l.like_count, 0)::int AS like_count,
                    COALESCE(c.comment_count, 0)::int AS comment_count
                  FROM posts p
                  LEFT JOIN (
                    SELECT post_id, COUNT(*) AS like_count
                    FROM likes
                    GROUP BY post_id
                  ) l ON l.post_id = p.id
                  LEFT JOIN (
                    SELECT post_id, COUNT(*) AS comment_count
                    FROM comments
                    GROUP BY post_id
                  ) c ON c.post_id = p.id
                  ORDER BY p.created_at DESC, p.id DESC
                  LIMIT ${limitPlusOne}
                `;

    const hasMore = rows.length > safeLimit;
    const items = hasMore ? rows.slice(0, safeLimit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ created_at: last.created_at, id: last.id })
        : null;

    return { items, nextCursor, hasMore };
  }

  async create(input: {
    userId: string;
    mediaType: MediaType;
    mediaUrl: string;
    cloudinaryPublicId?: string;
    folder?: string;
    text?: string;
    country?: string;
    city?: string;
    lat?: number;
    lng?: number;
  }): Promise<PostRow> {
    if (!this.db.client) {
      throw new BadRequestException('Database is not configured');
    }
    if (!['PHOTO', 'VIDEO', 'AUDIO'].includes(input.mediaType)) {
      throw new BadRequestException('Invalid mediaType');
    }
    if (!input.mediaUrl) throw new BadRequestException('mediaUrl required');

    const rows = await this.db.client<PostRow[]>`
      INSERT INTO posts (
        user_id, media_type, media_url, cloudinary_public_id, folder, text, country, city, lat, lng
      )
      VALUES (
        ${input.userId}::uuid,
        ${input.mediaType},
        ${input.mediaUrl},
        ${input.cloudinaryPublicId ?? null},
        ${input.folder ?? null},
        ${input.text ?? null},
        ${input.country ?? null},
        ${input.city ?? null},
        ${input.lat ?? null},
        ${input.lng ?? null}
      )
      RETURNING
        *,
        0::int as like_count,
        0::int as comment_count
    `;
    const post = rows[0];
    if (post && input.cloudinaryPublicId?.trim()) {
      try {
        const meta = await this.cloud.getResourceMetadata(
          input.cloudinaryPublicId.trim(),
          mediaTypeToCloudinaryResource(input.mediaType),
        );
        const lat = meta.lat ?? post.lat;
        const lng = meta.lng ?? post.lng;
        const created_at = meta.shotAt
          ? meta.shotAt.toISOString()
          : post.created_at;
        await this.db.client`
          UPDATE posts
          SET lat = ${lat}, lng = ${lng}, created_at = ${created_at}::timestamptz
          WHERE id = ${post.id}::uuid
        `;
        return await this.getOrThrow(post.id);
      } catch {
        // Метаданные не получили — возвращаем пост как есть
      }
    }
    return post;
  }

  async getOrThrow(id: string) {
    if (!this.db.client) throw new NotFoundException();
    const rows = await this.db.client<PostRow[]>`
      SELECT
        p.*,
        COALESCE(l.like_count, 0)::int AS like_count,
        COALESCE(c.comment_count, 0)::int AS comment_count
      FROM posts p
      LEFT JOIN (
        SELECT post_id, COUNT(*) AS like_count
        FROM likes
        GROUP BY post_id
      ) l ON l.post_id = p.id
      LEFT JOIN (
        SELECT post_id, COUNT(*) AS comment_count
        FROM comments
        GROUP BY post_id
      ) c ON c.post_id = p.id
      WHERE p.id = ${id}::uuid
      LIMIT 1
    `;
    const post = rows[0];
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async delete(id: string): Promise<void> {
    if (!this.db.client) throw new NotFoundException();
    const post = await this.getOrThrow(id);
    if (post.cloudinary_public_id?.trim()) {
      try {
        await this.cloud.destroy(
          post.cloudinary_public_id.trim(),
          mediaTypeToCloudinaryResource(post.media_type),
        );
      } catch {
        // Proceed to delete from DB even if Cloudinary fails (e.g. already deleted).
      }
    }
    const deleted = await this.db.client`
      DELETE FROM posts WHERE id = ${id}::uuid
    `;
    if (deleted.count === 0) throw new NotFoundException('Post not found');
  }
}
