import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DbService } from '../db/db.service';

export type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  text: string;
  created_at: string;
};

@Injectable()
export class CommentsService {
  constructor(private readonly db: DbService) {}

  async list(postId: string, limit = 100): Promise<CommentRow[]> {
    if (!this.db.client) return [];
    const safeLimit = Math.max(1, Math.min(200, limit));
    const rows = await this.db.client<CommentRow[]>`
      SELECT id, post_id, user_id, text, created_at
      FROM comments
      WHERE post_id = ${postId}::uuid
      ORDER BY created_at ASC
      LIMIT ${safeLimit}
    `;
    return rows;
  }

  async create(
    postId: string,
    userId: string,
    text: string,
  ): Promise<CommentRow> {
    if (!this.db.client)
      throw new BadRequestException('Database is not configured');
    const trimmed = text.trim();
    if (!trimmed) throw new BadRequestException('text required');
    const rows = await this.db.client<CommentRow[]>`
      INSERT INTO comments (post_id, user_id, text)
      VALUES (${postId}::uuid, ${userId}::uuid, ${trimmed})
      RETURNING id, post_id, user_id, text, created_at
    `;
    return rows[0];
  }

  async delete(commentId: string, userId: string): Promise<void> {
    if (!this.db.client)
      throw new BadRequestException('Database is not configured');
    const rows = await this.db.client<CommentRow[]>`
      SELECT user_id FROM comments WHERE id = ${commentId}::uuid
    `;
    const comment = rows[0];
    if (!comment)
      throw new BadRequestException('Comment not found');
    if (comment.user_id !== userId)
      throw new ForbiddenException('You can only delete your own comment');
    await this.db.client`
      DELETE FROM comments WHERE id = ${commentId}::uuid
    `;
  }
}
