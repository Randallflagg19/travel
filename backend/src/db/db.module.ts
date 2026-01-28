import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service';
import { DbMigrationsService } from './db-migrations.service';

@Global()
@Module({
  providers: [DbService, DbMigrationsService],
  exports: [DbService],
})
export class DbModule {}
