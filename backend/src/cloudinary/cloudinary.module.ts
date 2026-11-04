import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { CloudinaryController } from './cloudinary.controller';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  controllers: [CloudinaryController, MediaController],
  providers: [CloudinaryService, MediaService],
  exports: [CloudinaryService, MediaService],
})
export class CloudinaryModule {}
