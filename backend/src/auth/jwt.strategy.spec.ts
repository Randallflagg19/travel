/// <reference types="jest" />

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const config = {
    getOrThrow: jest.fn(() => 'test-secret-long-enough'),
  } as unknown as ConfigService;

  it('uses the current database role rather than a stale token role', async () => {
    const users = {
      findById: jest.fn().mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000001',
        username: 'friend',
        email: null,
        role: 'USER',
      }),
    } as unknown as UsersService;
    const strategy = new JwtStrategy(config, users);

    await expect(
      strategy.validate({
        sub: '00000000-0000-4000-8000-000000000001',
        role: 'AUTHOR',
      }),
    ).resolves.toMatchObject({ role: 'USER' });
  });

  it('rejects tokens for deleted users', async () => {
    const users = {
      findById: jest.fn().mockResolvedValue(null),
    } as unknown as UsersService;
    const strategy = new JwtStrategy(config, users);
    await expect(
      strategy.validate({
        sub: '00000000-0000-4000-8000-000000000001',
        role: 'AUTHOR',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
