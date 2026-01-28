import {
  Body,
  Controller,
  Get,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Auth, CurrentUser } from './current-user.decorator';
import { JwtUser } from './jwt-user.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(
    @Body() body: { email?: string; password?: string; name?: string },
  ) {
    const email = body.email?.trim();
    const password = body.password;
    if (!email || !password)
      throw new UnauthorizedException('email and password required');
    return await this.auth.register({ email, password, name: body.name });
  }

  @Post('login')
  async login(@Body() body: { email?: string; password?: string }) {
    const email = body.email?.trim();
    const password = body.password;
    if (!email || !password)
      throw new UnauthorizedException('email and password required');
    return await this.auth.login({ email, password });
  }

  @Get('me')
  @Auth()
  async me(@CurrentUser() user: JwtUser | null) {
    if (!user) throw new UnauthorizedException();
    return await this.auth.me(user.sub);
  }
}
