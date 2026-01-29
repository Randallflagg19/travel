import { Controller, Get } from '@nestjs/common';
import { PlacesService } from './places.service';

@Controller('places')
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  /**
   * Public endpoint for frontend navigation:
   * returns list of countries/cities available in DB.
   */
  @Get()
  async list() {
    return await this.places.listPlaces();
  }
}

