import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { LikesService } from './likes.service';
import { CommentsService } from './comments.service';
import { InteractionsController } from './interactions.controller';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  controllers: [PostsController, InteractionsController],
  providers: [PostsService, LikesService, CommentsService, RolesGuard],
})
export class PostsModule {}

