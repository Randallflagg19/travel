import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Patch,
  Put,
} from '@nestjs/common';
import { AuthRoles } from '../auth/auth-roles.decorator';
import { Auth, CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt-user.type';
import { AuthorCloudinaryService } from './author-cloudinary.service';
import { UsersService } from './users.service';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly authorCloudinary: AuthorCloudinaryService,
  ) {}

  @Put('me/cloudinary')
  @AuthRoles('AUTHOR')
  saveCloudinary(@CurrentUser() user: JwtUser, @Body() body: unknown) {
    return this.authorCloudinary.save(user.sub, body);
  }

  @Get('me/cloudinary')
  @AuthRoles('AUTHOR')
  @Header('Cache-Control', 'no-store')
  getCloudinaryStatus(@CurrentUser() user: JwtUser) {
    return this.authorCloudinary.getStatus(user.sub);
  }

  // Attach / update email for the currently authenticated user.
  @Patch('me')
  @Auth()
  async updateMe(
    @CurrentUser() user: JwtUser,
    @Body() body: { email?: string },
  ) {
    const email = body.email?.trim();
    if (!email) throw new BadRequestException('email required');
    if (!isValidEmail(email)) throw new BadRequestException('invalid email');

    const updated = await this.users.updateEmail(user.sub, email);
    return { user: updated };
  }
}
