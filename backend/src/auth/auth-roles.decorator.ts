import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles, Role } from './roles.decorator';
import { RolesGuard } from './roles.guard';

// Ensures JwtAuthGuard runs before RolesGuard.
export const AuthRoles = (...roles: Role[]) =>
  applyDecorators(Roles(...roles), UseGuards(JwtAuthGuard, RolesGuard));
