/// <reference types="jest" />

import { BadRequestException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController registration', () => {
  it('requires at least eight password characters for new users', async () => {
    const register = jest.fn();
    const auth = { register } as unknown as AuthService;
    const controller = new AuthController(auth);
    await expect(
      controller.register({ username: 'friend', password: 'short' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(register).not.toHaveBeenCalled();
  });

  it('still permits existing shorter passwords at login', async () => {
    const auth = {
      login: jest.fn().mockResolvedValue({ accessToken: 'token' }),
    } as unknown as AuthService;
    const controller = new AuthController(auth);
    await expect(
      controller.login({ login: 'existing', password: 'old' }),
    ).resolves.toEqual({ accessToken: 'token' });
  });
});
