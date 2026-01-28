import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Auth, CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { JwtUser } from '../auth/jwt-user.type';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  async list() {
    return { items: await this.posts.list() };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return { post: await this.posts.getOrThrow(id) };
  }

  @Post()
  @Auth()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
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

