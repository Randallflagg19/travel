import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

export type MediaType = 'PHOTO' | 'VIDEO' | 'AUDIO' | 'STORY';
export type PostLayout = 'STANDARD' | 'FEATURED';

export type PostRow = {
  id: string;
  user_id: string;
  media_type: MediaType;
  media_url: string | null;
  cloudinary_public_id: string | null;
  folder: string | null;
  text: string | null;
  title: string | null;
  layout: PostLayout;
  media_width: number | null;
  media_height: number | null;
  country: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  pinned_at: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  liked_by_me?: boolean;
};

type PostsCursor = {
  pinned_at: string | null;
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
  if (
    obj.pinned_at !== undefined &&
    obj.pinned_at !== null &&
    typeof obj.pinned_at !== 'string'
  ) {
    throw new BadRequestException('Invalid cursor');
  }
  return {
    pinned_at: obj.pinned_at ?? null,
    created_at: obj.created_at,
    id: obj.id,
  };
}

function mediaTypeToCloudinaryResource(
  mediaType: MediaType,
): 'image' | 'video' | 'raw' {
  if (mediaType === 'PHOTO') return 'image';
  if (mediaType === 'VIDEO' || mediaType === 'AUDIO') return 'video';
  return 'image';
}

function normalizePost(row: PostRow): PostRow {
  if (row.media_type === 'STORY' && !row.media_url) {
    return { ...row, media_url: null };
  }
  return row;
}

function normalizeMediaDimensions(
  width: number | undefined,
  height: number | undefined,
): { width: number | null; height: number | null } {
  if (width === undefined && height === undefined) {
    return { width: null, height: null };
  }
  if (
    width === undefined ||
    height === undefined ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > 100_000 ||
    height > 100_000
  ) {
    throw new BadRequestException('invalid media dimensions');
  }
  return { width, height };
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
    userId?: string;
  }): Promise<{
    items: PostRow[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    if (!this.db.client) return { items: [], nextCursor: null, hasMore: false };
    const safeLimit = Math.max(1, Math.min(50, params?.limit ?? 12));
    const limitPlusOne = safeLimit + 1;

    const decoded = params?.cursor ? decodeCursor(params.cursor) : null;

    const order: 'asc' | 'desc' = params?.order === 'asc' ? 'asc' : 'desc';
    const wantUnknown = Boolean(params?.unknown);
    const country = params?.country?.trim() ? params.country.trim() : undefined;
    const city = params?.city?.trim() ? params.city.trim() : undefined;
    const cursorCreatedAt = decoded?.created_at ?? null;
    const cursorId = decoded?.id ?? null;
    const cursorPinnedAt = decoded?.pinned_at ?? null;

    const rows =
      order === 'asc'
        ? await this.db.client<PostRow[]>`
            WITH page AS (
              SELECT p.*
              FROM posts p
              WHERE
                (
                  ${wantUnknown}::boolean = false
                  OR p.country IS NULL
                  OR TRIM(p.country) = ''
                  OR p.city IS NULL
                  OR TRIM(p.city) = ''
                )
                AND (
                  ${wantUnknown}::boolean = true
                  OR ${country ?? null}::text IS NULL
                  OR (
                    ${city ?? null}::text IS NULL
                    AND p.country = ${country ?? null}
                    AND (p.city IS NULL OR TRIM(p.city) = '')
                  )
                  OR (p.country = ${country ?? null} AND p.city = ${city ?? null})
                )
                AND (
                  ${cursorId}::uuid IS NULL
                  OR (
                    ${cursorPinnedAt}::timestamptz IS NOT NULL
                    AND (
                      p.pinned_at IS NULL
                      OR p.pinned_at < ${cursorPinnedAt}::timestamptz
                      OR (
                        p.pinned_at = ${cursorPinnedAt}::timestamptz
                        AND (
                          p.created_at > ${cursorCreatedAt}::timestamptz
                          OR (
                            p.created_at = ${cursorCreatedAt}::timestamptz
                            AND p.id > ${cursorId}::uuid
                          )
                        )
                      )
                    )
                  )
                  OR (
                    ${cursorPinnedAt}::timestamptz IS NULL
                    AND p.pinned_at IS NULL
                    AND (
                      p.created_at > ${cursorCreatedAt}::timestamptz
                      OR (
                        p.created_at = ${cursorCreatedAt}::timestamptz
                        AND p.id > ${cursorId}::uuid
                      )
                    )
                  )
                )
              ORDER BY
                (p.pinned_at IS NULL) ASC,
                p.pinned_at DESC NULLS LAST,
                p.created_at ASC,
                p.id ASC
              LIMIT ${limitPlusOne}
            )
            SELECT
              page.*,
              COALESCE(l.like_count, 0)::int AS like_count,
              COALESCE(c.comment_count, 0)::int AS comment_count
            FROM page
            LEFT JOIN LATERAL (
              SELECT COUNT(*) AS like_count
              FROM likes
              WHERE likes.post_id = page.id
            ) l ON true
            LEFT JOIN LATERAL (
              SELECT COUNT(*) AS comment_count
              FROM comments
              WHERE comments.post_id = page.id
            ) c ON true
            ORDER BY
              (page.pinned_at IS NULL) ASC,
              page.pinned_at DESC NULLS LAST,
              page.created_at ASC,
              page.id ASC
          `
        : await this.db.client<PostRow[]>`
            WITH page AS (
              SELECT p.*
              FROM posts p
              WHERE
                (
                  ${wantUnknown}::boolean = false
                  OR p.country IS NULL
                  OR TRIM(p.country) = ''
                  OR p.city IS NULL
                  OR TRIM(p.city) = ''
                )
                AND (
                  ${wantUnknown}::boolean = true
                  OR ${country ?? null}::text IS NULL
                  OR (
                    ${city ?? null}::text IS NULL
                    AND p.country = ${country ?? null}
                    AND (p.city IS NULL OR TRIM(p.city) = '')
                  )
                  OR (p.country = ${country ?? null} AND p.city = ${city ?? null})
                )
                AND (
                  ${cursorId}::uuid IS NULL
                  OR (
                    ${cursorPinnedAt}::timestamptz IS NOT NULL
                    AND (
                      p.pinned_at IS NULL
                      OR p.pinned_at < ${cursorPinnedAt}::timestamptz
                      OR (
                        p.pinned_at = ${cursorPinnedAt}::timestamptz
                        AND (
                          p.created_at < ${cursorCreatedAt}::timestamptz
                          OR (
                            p.created_at = ${cursorCreatedAt}::timestamptz
                            AND p.id < ${cursorId}::uuid
                          )
                        )
                      )
                    )
                  )
                  OR (
                    ${cursorPinnedAt}::timestamptz IS NULL
                    AND p.pinned_at IS NULL
                    AND (
                      p.created_at < ${cursorCreatedAt}::timestamptz
                      OR (
                        p.created_at = ${cursorCreatedAt}::timestamptz
                        AND p.id < ${cursorId}::uuid
                      )
                    )
                  )
                )
              ORDER BY
                (p.pinned_at IS NULL) ASC,
                p.pinned_at DESC NULLS LAST,
                p.created_at DESC,
                p.id DESC
              LIMIT ${limitPlusOne}
            )
            SELECT
              page.*,
              COALESCE(l.like_count, 0)::int AS like_count,
              COALESCE(c.comment_count, 0)::int AS comment_count
            FROM page
            LEFT JOIN LATERAL (
              SELECT COUNT(*) AS like_count
              FROM likes
              WHERE likes.post_id = page.id
            ) l ON true
            LEFT JOIN LATERAL (
              SELECT COUNT(*) AS comment_count
              FROM comments
              WHERE comments.post_id = page.id
            ) c ON true
            ORDER BY
              (page.pinned_at IS NULL) ASC,
              page.pinned_at DESC NULLS LAST,
              page.created_at DESC,
              page.id DESC
          `;

    const hasMore = rows.length > safeLimit;
    const items = (hasMore ? rows.slice(0, safeLimit) : rows).map(
      normalizePost,
    );
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            pinned_at: last.pinned_at,
            created_at: last.created_at,
            id: last.id,
          })
        : null;

    if (params?.userId?.trim() && items.length > 0 && this.db.client) {
      const postIds = items.map((p) => p.id);
      const likedRows = await this.db.client<{ post_id: string }[]>`
        SELECT post_id FROM likes
        WHERE user_id = ${params.userId.trim()}::uuid
          AND post_id = ANY(${this.db.client.array(postIds)}::uuid[])
      `;
      const likedSet = new Set(likedRows.map((r) => r.post_id));
      for (const p of items) {
        p.liked_by_me = likedSet.has(p.id);
      }
    } else {
      for (const p of items) {
        p.liked_by_me = false;
      }
    }

    return { items, nextCursor, hasMore };
  }

  async create(input: {
    userId: string;
    mediaType: MediaType;
    mediaUrl?: string;
    cloudinaryPublicId?: string;
    folder?: string;
    text?: string;
    title?: string;
    country?: string;
    city?: string;
    lat?: number;
    lng?: number;
    mediaWidth?: number;
    mediaHeight?: number;
  }): Promise<PostRow> {
    if (!this.db.client) {
      throw new BadRequestException('Database is not configured');
    }
    if (!['PHOTO', 'VIDEO', 'AUDIO', 'STORY'].includes(input.mediaType)) {
      throw new BadRequestException('Invalid mediaType');
    }
    if (input.mediaType === 'STORY') {
      if (!input.title?.trim()) throw new BadRequestException('title required');
      if (!input.text?.trim()) throw new BadRequestException('text required');
      if (input.title.trim().length > 140)
        throw new BadRequestException('title is too long');
      if (input.text.trim().length > 12000)
        throw new BadRequestException('text is too long');
    } else if (!input.mediaUrl) {
      throw new BadRequestException('mediaUrl required');
    }
    const dimensions = normalizeMediaDimensions(
      input.mediaWidth,
      input.mediaHeight,
    );

    const rows = await this.db.client<PostRow[]>`
      INSERT INTO posts (
        user_id, media_type, media_url, cloudinary_public_id, folder, text, title, country, city, lat, lng, media_width, media_height
      )
      VALUES (
        ${input.userId}::uuid,
        ${input.mediaType},
        ${input.mediaUrl ?? ''},
        ${input.cloudinaryPublicId ?? null},
        ${input.folder ?? null},
        ${input.text ?? null},
        ${input.title?.trim() || null},
        ${input.country ?? null},
        ${input.city ?? null},
        ${input.lat ?? null},
        ${input.lng ?? null},
        ${dimensions.width},
        ${dimensions.height}
      )
      RETURNING
        *,
        0::int as like_count,
        0::int as comment_count
    `;
    const post = rows[0] ? normalizePost(rows[0]) : undefined;
    if (!post) throw new BadRequestException('Post was not created');
    if (post && input.cloudinaryPublicId?.trim()) {
      this.updatePostMetadataFromCloudinary(
        post.id,
        input.cloudinaryPublicId.trim(),
        mediaTypeToCloudinaryResource(input.mediaType),
      ).catch(() => {
        // Best effort: не блокируем UI, метаданные подтянутся при следующем запросе или никогда
      });
    }
    return normalizePost(post);
  }

  async updateMetadata(
    postId: string,
    input: {
      title?: string | null;
      text?: string | null;
      layout?: PostLayout;
    },
  ): Promise<PostRow> {
    if (!this.db.client) {
      throw new BadRequestException('Database is not configured');
    }
    const updatesTitle = input.title !== undefined;
    const updatesText = input.text !== undefined;
    const layout = input.layout;
    const updatesLayout = layout !== undefined;
    if (!updatesTitle && !updatesText && !updatesLayout) {
      throw new BadRequestException('title, text or layout required');
    }

    if (updatesLayout && layout !== 'STANDARD' && layout !== 'FEATURED') {
      throw new BadRequestException('invalid layout');
    }
    if (updatesLayout && (updatesTitle || updatesText)) {
      throw new BadRequestException('layout must be updated separately');
    }

    const title = input.title?.trim() || null;
    const text = input.text?.trim() || null;
    if (title && title.length > 140)
      throw new BadRequestException('title is too long');
    if (text && text.length > 12000)
      throw new BadRequestException('text is too long');

    const existingRows = await this.db.client<
      { media_type: string; title: string | null; text: string | null }[]
    >`
      SELECT media_type, title, text
      FROM posts
      WHERE id = ${postId}::uuid
    `;
    const existing = existingRows[0];
    if (!existing) throw new BadRequestException('Post was not found');

    const nextTitle = updatesTitle ? title : existing.title;
    const nextText = updatesText ? text : existing.text;
    if (existing.media_type === 'STORY' && (!nextTitle || !nextText)) {
      throw new BadRequestException('Story title and text are required');
    }
    if (existing.media_type === 'STORY' && updatesLayout) {
      throw new BadRequestException('Story layout cannot be changed');
    }

    let rows: PostRow[];
    if (layout) {
      rows = await this.db.client<PostRow[]>`
        UPDATE posts
        SET layout = ${layout}
        WHERE id = ${postId}::uuid AND media_type IN ('PHOTO', 'VIDEO', 'AUDIO')
        RETURNING *, 0::int as like_count, 0::int as comment_count
      `;
    } else if (updatesTitle && updatesText) {
      rows = await this.db.client<PostRow[]>`
        UPDATE posts
        SET title = ${title}, text = ${text}
        WHERE id = ${postId}::uuid AND media_type IN ('PHOTO', 'VIDEO', 'AUDIO', 'STORY')
        RETURNING *, 0::int as like_count, 0::int as comment_count
      `;
    } else if (updatesTitle) {
      rows = await this.db.client<PostRow[]>`
        UPDATE posts
        SET title = ${title}
        WHERE id = ${postId}::uuid AND media_type IN ('PHOTO', 'VIDEO', 'AUDIO', 'STORY')
        RETURNING *, 0::int as like_count, 0::int as comment_count
      `;
    } else {
      rows = await this.db.client<PostRow[]>`
        UPDATE posts
        SET text = ${text}
        WHERE id = ${postId}::uuid AND media_type IN ('PHOTO', 'VIDEO', 'AUDIO', 'STORY')
        RETURNING *, 0::int as like_count, 0::int as comment_count
      `;
    }
    const post = rows[0] ? normalizePost(rows[0]) : undefined;
    if (!post) throw new BadRequestException('Post was not found');
    return post;
  }

  async setPinned(postId: string, pinned: boolean): Promise<PostRow> {
    if (!this.db.client) {
      throw new BadRequestException('Database is not configured');
    }
    if (typeof pinned !== 'boolean') {
      throw new BadRequestException('pinned must be a boolean');
    }

    const rows = await this.db.client<PostRow[]>`
      UPDATE posts
      SET pinned_at = CASE WHEN ${pinned}::boolean THEN now() ELSE NULL END
      WHERE id = ${postId}::uuid
      RETURNING *, 0::int AS like_count, 0::int AS comment_count
    `;
    const post = rows[0] ? normalizePost(rows[0]) : undefined;
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  /** Фоновая подтяжка метаданных (EXIF) из Cloudinary; не блокирует create(). */
  private async updatePostMetadataFromCloudinary(
    postId: string,
    cloudinaryPublicId: string,
    resourceType: 'image' | 'video' | 'raw',
  ): Promise<void> {
    if (!this.db.client) return;
    const meta = await this.cloud.getResourceMetadata(
      cloudinaryPublicId,
      resourceType,
    );
    const lat = meta.lat ?? null;
    const lng = meta.lng ?? null;
    const created_at = meta.shotAt?.toISOString() ?? null;
    const dimensions =
      meta.width != null && meta.height != null
        ? { width: meta.width, height: meta.height }
        : null;
    if (
      lat != null ||
      lng != null ||
      created_at != null ||
      dimensions != null
    ) {
      await this.db.client`
        UPDATE posts
        SET
          lat = COALESCE(${lat}, lat),
          lng = COALESCE(${lng}, lng),
          created_at = COALESCE(${created_at}::timestamptz, created_at),
          media_width = COALESCE(${dimensions?.width ?? null}, media_width),
          media_height = COALESCE(${dimensions?.height ?? null}, media_height)
        WHERE id = ${postId}::uuid
      `;
    }
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
