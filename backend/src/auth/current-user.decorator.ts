import {
  createParamDecorator,
  ExecutionContext,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtUser } from './jwt-user.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser | null => {
    const req = ctx.switchToHttp().getRequest<{ user?: JwtUser }>();
    return req.user ?? null;
  },
);

// Helper decorator: @Auth() to require JWT on route
export const Auth = () => UseGuards(JwtAuthGuard);
