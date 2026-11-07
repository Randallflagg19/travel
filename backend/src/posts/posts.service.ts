import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { CloudinaryService } from '../integrations/cloudinary/cloudinary.service';
import type { JwtUser } from '../auth/jwt-user.type';
import { objectBody } from '../media/media-contract';
import {
  normalizePost,
  type PostRow,
  type MediaType,
  type PostLayout,
} from './post.types';
import { PostsQueryService } from './posts-query.service';
import { DeletePostService } from './delete-post.service';

function mediaTypeToCloudinaryResource(
  mediaType: MediaType,
): 'image' | 'video' | 'raw' {
  if (mediaType === 'PHOTO') return 'image';
  if (mediaType === 'VIDEO' || mediaType === 'AUDIO') return 'video';
  return 'image';
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
    private readonly queries: PostsQueryService,
    private readonly deletion: DeletePostService,
  ) {}

  listPage(params?: Parameters<PostsQueryService['listPage']>[0]) {
    return this.queries.listPage(params);
  }

  getOrThrow(id: string) {
    return this.queries.getOrThrow(id);
  }

  async create(input: {
    userId: string;
    actorRole?: JwtUser['role'];
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
    if (input.actorRole === 'AUTHOR' && input.mediaType !== 'STORY') {
      throw new ForbiddenException(
        'Media upload is not available for authors yet',
      );
    }
    if (
      input.actorRole === 'AUTHOR' &&
      (input.mediaUrl || input.cloudinaryPublicId || input.folder)
    ) {
      throw new ForbiddenException(
        'Cloudinary is not connected for authors yet',
      );
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
    actor?: JwtUser,
  ): Promise<PostRow> {
    if (!this.db.client) {
      throw new BadRequestException('Database is not configured');
    }
    objectBody(input);
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

    if (
      (input.title != null && typeof input.title !== 'string') ||
      (input.text != null && typeof input.text !== 'string')
    ) {
      throw new BadRequestException('title and text must be strings or null');
    }
    const title = input.title?.trim() || null;
    const text = input.text?.trim() || null;
    if (title && title.length > 140)
      throw new BadRequestException('title is too long');
    if (text && text.length > 12000)
      throw new BadRequestException('text is too long');

    const existingRows = await this.db.client<
      {
        user_id: string;
        media_type: string;
        title: string | null;
        text: string | null;
      }[]
    >`
      SELECT user_id, media_type, title, text
      FROM posts
      WHERE id = ${postId}::uuid
    `;
    const existing = existingRows[0];
    if (!existing) throw new BadRequestException('Post was not found');
    if (actor?.role === 'AUTHOR' && existing.user_id !== actor.sub) {
      throw new ForbiddenException('You can only change your own post');
    }

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
          AND (${actor?.role !== 'AUTHOR'}::boolean OR user_id = ${actor?.sub ?? null}::uuid)
        RETURNING *
      `;
    } else if (updatesTitle && updatesText) {
      rows = await this.db.client<PostRow[]>`
        UPDATE posts
        SET title = ${title}, text = ${text}
        WHERE id = ${postId}::uuid AND media_type IN ('PHOTO', 'VIDEO', 'AUDIO', 'STORY')
          AND (${actor?.role !== 'AUTHOR'}::boolean OR user_id = ${actor?.sub ?? null}::uuid)
        RETURNING *
      `;
    } else if (updatesTitle) {
      rows = await this.db.client<PostRow[]>`
        UPDATE posts
        SET title = ${title}
        WHERE id = ${postId}::uuid AND media_type IN ('PHOTO', 'VIDEO', 'AUDIO', 'STORY')
          AND (${actor?.role !== 'AUTHOR'}::boolean OR user_id = ${actor?.sub ?? null}::uuid)
        RETURNING *
      `;
    } else {
      rows = await this.db.client<PostRow[]>`
        UPDATE posts
        SET text = ${text}
        WHERE id = ${postId}::uuid AND media_type IN ('PHOTO', 'VIDEO', 'AUDIO', 'STORY')
          AND (${actor?.role !== 'AUTHOR'}::boolean OR user_id = ${actor?.sub ?? null}::uuid)
        RETURNING *
      `;
    }
    const post = rows[0] ? normalizePost(rows[0]) : undefined;
    if (!post) throw new BadRequestException('Post was not found');
    return this.queries.forViewer(postId, actor?.sub);
  }

  async setPinned(
    postId: string,
    pinned: boolean,
    actor?: JwtUser,
  ): Promise<PostRow> {
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
        AND (${actor?.role !== 'AUTHOR'}::boolean OR user_id = ${actor?.sub ?? null}::uuid)
      RETURNING *
    `;
    const post = rows[0] ? normalizePost(rows[0]) : undefined;
    if (!post) throw new NotFoundException('Post not found');
    return this.queries.forViewer(postId, actor?.sub);
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

  async delete(id: string, actor?: JwtUser) {
    return this.deletion.deletePost(id, actor);
  }
}
