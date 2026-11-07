import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthRoles } from '../../auth/auth-roles.decorator';
import { CloudinaryService } from './cloudinary.service';
import { CloudinaryCatalogService } from './cloudinary-catalog.service';

@Controller('admin/cloudinary')
export class CloudinaryController {
  constructor(
    private readonly cloud: CloudinaryService,
    private readonly catalog: CloudinaryCatalogService,
  ) {}

  @Get('config')
  @AuthRoles('ADMIN', 'SUPERADMIN')
  config() {
    return this.cloud.getClientConfig();
  }

  @Post('sign-upload')
  @AuthRoles('ADMIN', 'SUPERADMIN')
  signUpload(@Body() body: { paramsToSign?: Record<string, unknown> }) {
    return this.cloud.signUpload(body.paramsToSign);
  }

  @Post('probe')
  @AuthRoles('ADMIN', 'SUPERADMIN')
  async probe(@Body() body: { prefix?: string }) {
    return await this.catalog.probePrefix({ prefix: body.prefix ?? 'tapir/' });
  }
}
