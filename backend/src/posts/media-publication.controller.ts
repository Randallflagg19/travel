import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { AuthRoles } from '../auth/auth-roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt-user.type';
import { PublishMediaPostService } from './publish-media-post.service';

@Controller('media')
@AuthRoles('ADMIN', 'SUPERADMIN')
export class MediaPublicationController {
  constructor(private readonly publication: PublishMediaPostService) {}

  @Post('sessions/:id/publish')
  publish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
    @Body() body: unknown,
  ) {
    return this.publication.publish(id, user.sub, body);
  }
}
