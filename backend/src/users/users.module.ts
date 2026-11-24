import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthorsController } from './authors.controller';
import { AuthorCloudinaryService } from './author-cloudinary.service';

@Module({
  providers: [UsersService, AuthorCloudinaryService],
  controllers: [UsersController, AuthorsController],
  exports: [UsersService],
})
export class UsersModule {}
