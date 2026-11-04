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
import { MediaService } from './media.service';

@Controller('media')
@AuthRoles('ADMIN', 'SUPERADMIN')
export class MediaController {
  constructor(private readonly media: MediaService) {}

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

  @Post('sessions/:id/publish')
  publish(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtUser,
    @Body() body: unknown,
  ) {
    return this.media.publish(id, user.sub, body);
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
    return this.media.cleanupStatus();
  }

  @Post('cleanup/retry')
  async retry() {
    return this.media.retryFailedCleanup();
  }
}
