import { BadRequestException, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class LikesService {
  constructor(private readonly db: DbService) {}

  async like(postId: string, userId: string): Promise<void> {
    if (!this.db.client) throw new BadRequestException('Database is not configured');
    await this.db.client`
      INSERT INTO likes (user_id, post_id)
      VALUES (${userId}::uuid, ${postId}::uuid)
      ON CONFLICT DO NOTHING
    `;
  }

  async unlike(postId: string, userId: string): Promise<void> {
    if (!this.db.client) throw new BadRequestException('Database is not configured');
    await this.db.client`
      DELETE FROM likes
      WHERE user_id = ${userId}::uuid AND post_id = ${postId}::uuid
    `;
  }
}

