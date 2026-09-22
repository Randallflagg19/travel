/// <reference types="jest" />

import { AuthorsController } from './authors.controller';
import { UsersService } from './users.service';

describe('AuthorsController candidates', () => {
  it('exposes USER candidates only on a SUPERADMIN route', async () => {
    const items = [
      {
        id: '00000000-0000-4000-8000-000000000002',
        username: 'friend',
        name: null,
      },
    ];
    const listAuthorCandidates = jest.fn().mockResolvedValue(items);
    const controller = new AuthorsController({
      listAuthorCandidates,
    } as unknown as UsersService);

    await expect(controller.candidates()).resolves.toEqual({ items });
    expect(listAuthorCandidates).toHaveBeenCalledTimes(1);
    const handler = Reflect.get(
      AuthorsController.prototype,
      'candidates',
    ) as object;
    expect(Reflect.getMetadata('roles', handler)).toEqual(['SUPERADMIN']);
  });
});
