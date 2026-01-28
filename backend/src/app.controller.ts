import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service';
import { DbService } from './db/db.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly db: DbService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  health(): { ok: true } {
    return { ok: true };
  }

  @Get('health/db')
  async healthDb(): Promise<{ ok: true }> {
    if (!this.db.isConfigured) {
      throw new ServiceUnavailableException(
        'DATABASE_URL is not configured on the server',
      );
    }
    await this.db.ping();
    return { ok: true };
  }
}
