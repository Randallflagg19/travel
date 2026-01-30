import {
  Body,
  Controller,
  Get,
  Post,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Auth, CurrentUser } from './current-user.decorator';
import { JwtUser } from './jwt-user.type';

function isValidEmail(email: string) {
  // Simple check (enough for MVP)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username: string) {
  // 3..32, letters/digits/._-
  return /^[a-zA-Z0-9._-]{3,32}$/.test(username);
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(
    @Body()
    body: {
      username?: string;
      email?: string;
      password?: string;
      name?: string;
    },
  ) {
    const username = body.username?.trim();
    const email = body.email?.trim();
    const password = body.password;
    const name = body.name?.trim();

    if (!username || !password) {
      throw new BadRequestException('username and password required');
    }
    if (!isValidUsername(username)) {
      throw new BadRequestException(
        'invalid username (3..32, letters/digits and . _ - only)',
      );
    }
    if (typeof password !== 'string' || password.length < 3) {
      throw new BadRequestException('password must be at least 3 characters');
    }
    if (email && !isValidEmail(email)) {
      throw new BadRequestException('invalid email');
    }

    return await this.auth.register({
      username,
      email: email || undefined,
      password,
      name: name || undefined,
    });
  }

  @Post('login')
  async login(@Body() body: { login?: string; password?: string }) {
    const login = body.login?.trim();
    const password = body.password;
    if (!login || !password)
      throw new BadRequestException('login and password required');
    if (typeof password !== 'string' || password.length < 3) {
      throw new BadRequestException('password must be at least 3 characters');
    }
    return await this.auth.login({ login, password });
  }

  @Get('me')
  @Auth()
  async me(@CurrentUser() user: JwtUser | null) {
    if (!user) throw new UnauthorizedException();
    return await this.auth.me(user.sub);
  }
}
