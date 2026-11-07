import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../integrations/cloudinary/cloudinary.module';
import { MediaEnvironmentService } from './media-environment.service';
import { MediaSessionsService } from './media-sessions.service';
import { MediaCleanupService } from './media-cleanup.service';
import { MediaCleanupWorker } from './media-cleanup.worker';
import { MediaController } from './media.controller';

@Module({
  imports: [CloudinaryModule],
  controllers: [MediaController],
  providers: [
    MediaEnvironmentService,
    MediaSessionsService,
    MediaCleanupService,
    MediaCleanupWorker,
  ],
  exports: [MediaSessionsService, MediaCleanupService, MediaEnvironmentService],
})
export class MediaModule {}
