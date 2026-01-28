import { Body, Controller, Post } from '@nestjs/common';
import { AuthRoles } from '../auth/auth-roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt-user.type';
import { CloudinaryService } from './cloudinary.service';

@Controller('admin/cloudinary')
export class CloudinaryController {
  constructor(private readonly cloud: CloudinaryService) {}

  @Post('import')
  @AuthRoles('ADMIN', 'SUPERADMIN')
  async import(
    @CurrentUser() user: JwtUser,
    @Body() body: { prefix?: string; max?: number },
  ) {
    const prefix = body.prefix ?? `${user.email.split('@')[0]}/`;
    return await this.cloud.importPrefix({
      prefix,
      userId: user.sub,
      max: body.max,
    });
  }
}
