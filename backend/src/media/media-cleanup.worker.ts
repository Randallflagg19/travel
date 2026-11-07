import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { MediaCleanupService } from './media-cleanup.service';

@Injectable()
export class MediaCleanupWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(MediaCleanupWorker.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly db: DbService,
    private readonly cleanup: MediaCleanupService,
  ) {}

  onApplicationBootstrap() {
    if (!this.db.client) return;
    const run = () => {
      void this.cleanup
        .retryCleanup()
        .catch(() =>
          this.logger.warn('Media cleanup failed; it will retry automatically'),
        );
    };
    this.timer = setInterval(run, 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
