import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  Patch,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthRoles } from '../auth/auth-roles.decorator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { JwtUser } from '../auth/jwt-user.type';
import { PostsService, type PostLayout } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async list(
    @CurrentUser() user: JwtUser | null,
    @Query('limit', new DefaultValuePipe(50), new ParseIntPipe()) limit: number,
    @Query('cursor') cursor?: string,
    @Query('country') country?: string,
    @Query('city') city?: string,
    @Query('unknown') unknown?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('authorId', new ParseUUIDPipe({ optional: true })) authorId?: string,
  ) {
    return await this.posts.listPage({
      limit,
      cursor,
      country,
      city,
      unknown: unknown === 'true',
      order,
      userId: user?.sub,
      authorId,
    });
  }

  @Get(':id')
  async get(@Param('id', new ParseUUIDPipe()) id: string) {
    return { post: await this.posts.getOrThrow(id) };
  }

  @Delete(':id')
  @AuthRoles('AUTHOR', 'ADMIN', 'SUPERADMIN')
  async delete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.posts.delete(id, user);
    return { ok: true };
  }

  @Post()
  @AuthRoles('AUTHOR', 'ADMIN', 'SUPERADMIN')
  async create(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      mediaType: 'PHOTO' | 'VIDEO' | 'AUDIO' | 'STORY';
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
    },
  ) {
    const post = await this.posts.create({
      userId: user.sub,
      actorRole: user.role,
      mediaType: body.mediaType,
      mediaUrl: body.mediaUrl,
      cloudinaryPublicId: body.cloudinaryPublicId,
      folder: body.folder,
      text: body.text,
      title: body.title,
      country: body.country,
      city: body.city,
      lat: body.lat,
      lng: body.lng,
      mediaWidth: body.mediaWidth,
      mediaHeight: body.mediaHeight,
    });
    return { post };
  }

  @Patch(':id')
  @AuthRoles('AUTHOR', 'ADMIN', 'SUPERADMIN')
  async updateMetadata(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      title?: string | null;
      text?: string | null;
      layout?: PostLayout;
    },
  ) {
    const post = await this.posts.updateMetadata(id, body, user);
    return { post };
  }

  @Patch(':id/pin')
  @AuthRoles('AUTHOR', 'ADMIN', 'SUPERADMIN')
  async setPinned(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
    @Body() body: { pinned?: boolean },
  ) {
    const post = await this.posts.setPinned(id, body.pinned as boolean, user);
    return { post };
  }
}
