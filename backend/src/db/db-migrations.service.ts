import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DbService } from './db.service';
import { runMigrations } from './migrations';

@Injectable()
export class DbMigrationsService implements OnModuleInit {
  private readonly logger = new Logger(DbMigrationsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly db: DbService,
  ) {}

  async onModuleInit() {
    const shouldMigrate =
      this.config.get<string>('DB_MIGRATE_ON_START') === 'true';
    if (!shouldMigrate) return;
    if (!this.db.client) {
      this.logger.warn(
        'DB_MIGRATE_ON_START=true but DATABASE_URL is not configured; skipping migrations',
      );
      return;
    }

    this.logger.log('Running DB migrations...');
    await runMigrations(this.db.client);
    this.logger.log('DB migrations done.');
  }
}
