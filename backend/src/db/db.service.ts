import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import postgres, { Sql } from 'postgres';

@Injectable()
export class DbService {
  private readonly sql: Sql | null;

  constructor(config: ConfigService) {
    const databaseUrl = config.get<string>('DATABASE_URL');
    if (!databaseUrl) {
      this.sql = null;
      return;
    }

    this.sql = postgres(databaseUrl, {
      // Neon requires TLS.
      ssl: 'require',
      max: 1,
    });
  }

  get isConfigured() {
    return Boolean(this.sql);
  }

  async ping(): Promise<void> {
    if (!this.sql) return;
    await this.sql`SELECT 1`;
  }
}
