import { BadRequestException, Body, Controller, Patch } from '@nestjs/common';
import { Auth, CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt-user.type';
import { UsersService } from './users.service';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

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
