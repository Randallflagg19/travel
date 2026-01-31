import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT: if Bearer token present and valid, sets req.user.
 * If no token or invalid, request continues without user (no 401).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return (await super.canActivate(context)) as boolean;
    } catch {
      return true;
    }
  }
}
