import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../integrations/cloudinary/cloudinary.module';
import { CloudinaryImportService } from './cloudinary-import.service';
import { MediaDimensionsBackfillService } from './media-dimensions-backfill.service';
import { ImportsController } from './imports.controller';

@Module({
  imports: [CloudinaryModule],
  controllers: [ImportsController],
  providers: [CloudinaryImportService, MediaDimensionsBackfillService],
})
export class ImportsModule {}
