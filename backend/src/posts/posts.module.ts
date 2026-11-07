import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../integrations/cloudinary/cloudinary.module';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { PostsController } from './posts.controller';
import { MediaModule } from '../media/media.module';
import { PostsQueryService } from './posts-query.service';
import { PublishMediaPostService } from './publish-media-post.service';
import { DeletePostService } from './delete-post.service';
import { MediaPublicationController } from './media-publication.controller';
import { PostsService } from './posts.service';
import { LikesService } from './likes.service';
import { CommentsService } from './comments.service';
import { InteractionsController } from './interactions.controller';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [CloudinaryModule, MediaModule],
  controllers: [
    PostsController,
    InteractionsController,
    MediaPublicationController,
  ],
  providers: [
    PostsService,
    PostsQueryService,
    PublishMediaPostService,
    DeletePostService,
    LikesService,
    CommentsService,
    RolesGuard,
    OptionalJwtAuthGuard,
  ],
})
export class PostsModule {}
