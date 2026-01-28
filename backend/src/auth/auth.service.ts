import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import { JwtUser } from './jwt-user.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: { email: string; password: string; name?: string }) {
    const passwordHash = await argon2.hash(input.password);
    const user = await this.users.createUser({
      email: input.email,
      passwordHash,
      name: input.name,
    });
    const accessToken = await this.signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return { accessToken, user };
  }

  async login(input: { email: string; password: string }) {
    const user = await this.users.findByEmail(input.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await argon2.verify(user.password_hash, input.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const accessToken = await this.signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    };
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return { user };
  }

  private async signToken(payload: JwtUser) {
    return await this.jwt.signAsync(payload);
  }
}
