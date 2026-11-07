import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { AuthRoles } from '../auth/auth-roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt-user.type';
import { MediaSessionsService } from './media-sessions.service';
import { MediaCleanupService } from './media-cleanup.service';

@Controller('media')
@AuthRoles('ADMIN', 'SUPERADMIN')
export class MediaController {
  constructor(
    private readonly media: MediaSessionsService,
    private readonly cleanup: MediaCleanupService,
  ) {}

  @Put('sessions/:id')
  open(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.media.open(id, user.sub);
  }

  @Put('sessions/:id/uploads/:uploadId')
  reserve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('uploadId', new ParseUUIDPipe()) uploadId: string,
    @CurrentUser() user: JwtUser,
    @Body() body: unknown,
  ) {
    return this.media.reserve(id, uploadId, user.sub, body);
  }

  @Post('sessions/:id/uploads/:uploadId/complete')
  complete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('uploadId', new ParseUUIDPipe()) uploadId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.media.complete(id, uploadId, user.sub);
  }

  @Delete('sessions/:id')
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.media.cancel(id, user.sub);
  }

  @Get('cleanup')
  status() {
    return this.cleanup.cleanupStatus();
  }

  @Post('cleanup/retry')
  async retry() {
    return this.cleanup.retryFailedCleanup();
  }
}
