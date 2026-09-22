import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtUser } from './jwt-user.type';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtUser): Promise<JwtUser> {
    if (!payload?.sub) throw new UnauthorizedException();
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };
  }
}
