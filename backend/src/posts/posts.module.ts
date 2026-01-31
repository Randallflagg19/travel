import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { LikesService } from './likes.service';
import { CommentsService } from './comments.service';
import { InteractionsController } from './interactions.controller';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [CloudinaryModule],
  controllers: [PostsController, InteractionsController],
  providers: [
    PostsService,
    LikesService,
    CommentsService,
    RolesGuard,
    OptionalJwtAuthGuard,
  ],
})
export class PostsModule {}
