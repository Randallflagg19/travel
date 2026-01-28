import { SetMetadata } from '@nestjs/common';
import { JwtUser } from './jwt-user.type';

export const ROLES_KEY = 'roles';
export type Role = JwtUser['role'];

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

