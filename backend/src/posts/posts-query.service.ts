import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import type { PostMediaRow } from '../media/media-contract';
import { normalizePost, type PostRow } from './post.types';

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

@Injectable()
export class PostsQueryService {
  constructor(private readonly db: DbService) {}

  async listPage(params?: {
    limit?: number;
    cursor?: string;
    country?: string;
    city?: string;
    unknown?: boolean;
    order?: 'asc' | 'desc';
    userId?: string;
    authorId?: string;
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
                (${params?.authorId ?? null}::uuid IS NULL OR p.user_id = ${params?.authorId ?? null}::uuid)
                AND
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
                (${params?.authorId ?? null}::uuid IS NULL OR p.user_id = ${params?.authorId ?? null}::uuid)
                AND
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

    await this.attachMedia(items);
    return { items, nextCursor, hasMore };
  }

  private async attachMedia(posts: PostRow[]) {
    if (!this.db.client || !posts.length) return;
    const media = await this.db.client<
      (PostMediaRow & { upload_id: string | null })[]
    >`
      SELECT id, post_id, upload_id, position, media_type, media_url, cloudinary_public_id, media_width, media_height
      FROM post_media WHERE post_id = ANY(${this.db.client.array(posts.map((post) => post.id))}::uuid[])
      ORDER BY post_id, position
    `;
    for (const post of posts) {
      post.attachments = media
        .filter((item) => item.post_id === post.id)
        .map(({ upload_id, ...item }) =>
          upload_id
            ? item
            : {
                ...item,
                media_width: post.media_width ?? item.media_width,
                media_height: post.media_height ?? item.media_height,
              },
        );
      // The previous release/importer can still create a legacy single-media row.
      if (
        !post.attachments.length &&
        post.media_type !== 'STORY' &&
        post.media_url
      ) {
        post.attachments = [
          {
            id: post.id,
            post_id: post.id,
            position: 0,
            media_type: post.media_type,
            media_url: post.media_url,
            cloudinary_public_id: post.cloudinary_public_id,
            media_width: post.media_width,
            media_height: post.media_height,
          },
        ];
      }
    }
  }

  async forViewer(id: string, userId?: string): Promise<PostRow> {
    const post = await this.getOrThrow(id);
    const rows =
      userId && this.db.client
        ? await this.db.client`
      SELECT 1 FROM likes WHERE post_id = ${id}::uuid AND user_id = ${userId}::uuid LIMIT 1
    `
        : [];
    return { ...post, liked_by_me: rows.length > 0 };
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
    const post = rows[0] ? normalizePost(rows[0]) : undefined;
    if (!post) throw new NotFoundException('Post not found');
    await this.attachMedia([post]);
    return post;
  }
}
