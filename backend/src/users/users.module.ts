import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthorsController } from './authors.controller';

@Module({
  providers: [UsersService],
  controllers: [UsersController, AuthorsController],
  exports: [UsersService],
})
export class UsersModule {}
