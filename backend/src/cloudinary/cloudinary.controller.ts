import { Body, Controller, Post } from '@nestjs/common';
import { AuthRoles } from '../auth/auth-roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt-user.type';
import { CloudinaryService } from './cloudinary.service';

@Controller('admin/cloudinary')
export class CloudinaryController {
  constructor(private readonly cloud: CloudinaryService) {}

  @Post('probe')
  @AuthRoles('ADMIN', 'SUPERADMIN')
  async probe(@Body() body: { prefix?: string }) {
    return await this.cloud.probePrefix({ prefix: body.prefix ?? 'tapir/' });
  }

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
    return await this.cloud.importPrefix({
      prefix,
      userId: user.sub,
      max: body.max,
    });
  }
}
