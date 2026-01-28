import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';

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

@Injectable()
export class PostsService {
  constructor(private readonly db: DbService) {}

  async list(limit = 50): Promise<PostRow[]> {
    if (!this.db.client) return [];
    const safeLimit = Math.max(1, Math.min(200, limit));
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
      ORDER BY p.created_at DESC
      LIMIT ${safeLimit}
    `;
    return rows;
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
    return rows[0];
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
}
