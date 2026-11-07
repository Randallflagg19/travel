import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { CloudinaryCatalogService } from './cloudinary-catalog.service';
import { CloudinaryController } from './cloudinary.controller';

@Module({
  controllers: [CloudinaryController],
  providers: [CloudinaryService, CloudinaryCatalogService],
  exports: [CloudinaryService, CloudinaryCatalogService],
})
export class CloudinaryModule {}
