import { Controller, Get, Query, ParseUUIDPipe } from '@nestjs/common';
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
}
