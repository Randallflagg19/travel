import {
  Body,
  Controller,
  Delete,
  Get,
  ParseUUIDPipe,
  Param,
  Post,
  ForbiddenException,
} from '@nestjs/common';
import { AuthRoles } from '../auth/auth-roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt-user.type';
import { PostsService } from './posts.service';
import { LikesService } from './likes.service';
import { CommentsService } from './comments.service';

@Controller('posts')
export class InteractionsController {
  constructor(
    private readonly posts: PostsService,
    private readonly likes: LikesService,
    private readonly comments: CommentsService,
  ) {}

  @Post(':id/like')
  @AuthRoles('USER', 'AUTHOR', 'ADMIN', 'SUPERADMIN')
  async like(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.posts.getOrThrow(id);
    await this.likes.like(id, user.sub);
    return { ok: true };
  }

  @Delete(':id/like')
  @AuthRoles('USER', 'AUTHOR', 'ADMIN', 'SUPERADMIN')
  async unlike(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.posts.getOrThrow(id);
    await this.likes.unlike(id, user.sub);
    return { ok: true };
  }

  @Get(':id/comments')
  async listComments(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.posts.getOrThrow(id);
    return { items: await this.comments.list(id) };
  }

  @Post(':id/comments')
  @AuthRoles('AUTHOR', 'ADMIN', 'SUPERADMIN')
  async addComment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
    @Body() body: { text?: string },
  ) {
    const post = await this.posts.getOrThrow(id);
    if (user.role === 'AUTHOR' && post.user_id !== user.sub) {
      throw new ForbiddenException('You can only comment on your own post');
    }
    const comment = await this.comments.create(id, user.sub, body.text ?? '');
    return { comment };
  }

  @Delete(':id/comments/:commentId')
  @AuthRoles('USER', 'AUTHOR', 'ADMIN', 'SUPERADMIN')
  async deleteComment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('commentId', new ParseUUIDPipe()) commentId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.posts.getOrThrow(id);
    await this.comments.delete(commentId, user.sub, id);
    return { ok: true };
  }
}
