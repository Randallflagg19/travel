import {
  BadRequestException,
  Body,
  Controller,
  Get,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { AuthRoles } from '../auth/auth-roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt-user.type';
import { PlacesService } from './places.service';

@Controller('places')
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  /**
   * Public endpoint for frontend navigation:
   * returns list of countries/cities available in DB.
   */
  @Get()
  async list(
    @Query('authorId', new ParseUUIDPipe({ optional: true })) authorId?: string,
  ) {
    return await this.places.listPlaces(authorId);
  }

  @Get('albums')
  async listAlbums(
    @Query('authorId', new ParseUUIDPipe()) authorId: string,
    @Query('country') value: unknown,
  ) {
    const country = typeof value === 'string' ? value.trim() : '';
    if (!country) {
      throw new BadRequestException('Укажите страну');
    }

    return { albums: await this.places.listAlbums(authorId, country) };
  }

  @Post('albums')
  @AuthRoles('AUTHOR', 'ADMIN', 'SUPERADMIN')
  async createAlbum(
    @CurrentUser() user: JwtUser,
    @Body() body: { country?: unknown; title?: unknown },
  ) {
    const country =
      typeof body?.country === 'string' ? body.country.trim() : '';
    const title = typeof body?.title === 'string' ? body.title.trim() : '';

    if (!country || !title) {
      throw new BadRequestException('Укажите страну и название альбома');
    }

    return { album: await this.places.createAlbum(user.sub, country, title) };
  }
}
