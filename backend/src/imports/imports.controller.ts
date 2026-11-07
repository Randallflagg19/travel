import { Body, Controller, Post } from '@nestjs/common';
import { AuthRoles } from '../auth/auth-roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt-user.type';
import { CloudinaryImportService } from './cloudinary-import.service';
import { MediaDimensionsBackfillService } from './media-dimensions-backfill.service';

@Controller('admin/cloudinary')
export class ImportsController {
  constructor(
    private readonly importer: CloudinaryImportService,
    private readonly dimensions: MediaDimensionsBackfillService,
  ) {}

  @Post('import')
  @AuthRoles('ADMIN', 'SUPERADMIN')
  async import(
    @CurrentUser() user: JwtUser,
    @Body() body: { prefix?: string; max?: number },
  ) {
    const fallbackPrefix =
      user.username ??
      (user.email ? user.email.split('@')[0] : null) ??
      `user_${user.sub}`;
    const prefix = body.prefix ?? `${fallbackPrefix}/`;
    return await this.importer.importPrefix({
      prefix,
      userId: user.sub,
      max: body.max,
    });
  }

  @Post('backfill-media-dimensions')
  @AuthRoles('ADMIN', 'SUPERADMIN')
  async backfillMediaDimensions(@Body() body: { max?: number }) {
    return await this.dimensions.backfillMediaDimensions({ max: body.max });
  }

  @Post('reset-media-dimensions-backfill')
  @AuthRoles('ADMIN', 'SUPERADMIN')
  async resetMediaDimensionsBackfill() {
    return await this.dimensions.resetMediaDimensionsBackfill();
  }
}
