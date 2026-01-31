import {
  Body,
  Controller,
  Delete,
  Get,
  ParseUUIDPipe,
  Param,
  Post,
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
  @AuthRoles('USER', 'ADMIN', 'SUPERADMIN')
  async like(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.posts.getOrThrow(id);
    await this.likes.like(id, user.sub);
    return { ok: true };
  }

  @Delete(':id/like')
  @AuthRoles('USER', 'ADMIN', 'SUPERADMIN')
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
  @AuthRoles('USER', 'ADMIN', 'SUPERADMIN')
  async addComment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
    @Body() body: { text?: string },
  ) {
    await this.posts.getOrThrow(id);
    const comment = await this.comments.create(id, user.sub, body.text ?? '');
    return { comment };
  }
}
