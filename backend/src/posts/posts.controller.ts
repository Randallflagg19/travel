import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthRoles } from '../auth/auth-roles.decorator';
import type { JwtUser } from '../auth/jwt-user.type';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  async list(
    @Query('limit', new DefaultValuePipe(50), new ParseIntPipe()) limit: number,
    @Query('cursor') cursor?: string,
    @Query('country') country?: string,
    @Query('city') city?: string,
    @Query('unknown') unknown?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    return await this.posts.listPage({
      limit,
      cursor,
      country,
      city,
      unknown: unknown === 'true',
      order,
    });
  }

  @Get(':id')
  async get(@Param('id', new ParseUUIDPipe()) id: string) {
    return { post: await this.posts.getOrThrow(id) };
  }

  @Post()
  @AuthRoles('ADMIN', 'SUPERADMIN')
  async create(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      mediaType: 'PHOTO' | 'VIDEO' | 'AUDIO';
      mediaUrl: string;
      cloudinaryPublicId?: string;
      folder?: string;
      text?: string;
      country?: string;
      city?: string;
      lat?: number;
      lng?: number;
    },
  ) {
    const post = await this.posts.create({
      userId: user.sub,
      mediaType: body.mediaType,
      mediaUrl: body.mediaUrl,
      cloudinaryPublicId: body.cloudinaryPublicId,
      folder: body.folder,
      text: body.text,
      country: body.country,
      city: body.city,
      lat: body.lat,
      lng: body.lng,
    });
    return { post };
  }
}
