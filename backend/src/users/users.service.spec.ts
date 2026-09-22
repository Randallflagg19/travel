/// <reference types="jest" />

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { UsersService } from './users.service';

function makeService(results: unknown[][]) {
  const calls: { text: string; values: unknown[] }[] = [];
  const queue = [...results];
  const client = jest.fn(
    (parts: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ text: parts.join('?'), values });
      return Promise.resolve(queue.shift() ?? []);
    },
  );
  return {
    service: new UsersService({ client } as unknown as DbService),
    calls,
  };
}

describe('UsersService authors', () => {
  it('lists only author-capable roles without exposing emails', async () => {
    const item = {
      id: '00000000-0000-4000-8000-000000000001',
      username: 'friend',
      name: null,
    };
    const { service, calls } = makeService([[item]]);
    await expect(service.listAuthors()).resolves.toEqual([item]);
    expect(calls[0]?.text).toContain(
      "role IN ('AUTHOR', 'ADMIN', 'SUPERADMIN')",
    );
    expect(calls[0]?.text).toContain('SELECT id, username, name');
    expect(calls[0]?.text).not.toContain('email');
  });

  it('lists only USER candidates without exposing emails', async () => {
    const item = {
      id: '00000000-0000-4000-8000-000000000002',
      username: 'newfriend',
      name: null,
    };
    const { service, calls } = makeService([[item]]);
    await expect(service.listAuthorCandidates()).resolves.toEqual([item]);
    expect(calls[0]?.text).toContain("WHERE role = 'USER'");
    expect(calls[0]?.text).toContain('SELECT id, username, name');
    expect(calls[0]?.text).not.toContain('email');
  });

  it('can promote a registered USER only', async () => {
    const target = {
      id: '00000000-0000-4000-8000-000000000001',
      username: 'friend',
      name: null,
      role: 'AUTHOR',
    };
    const { service, calls } = makeService([[target]]);
    await expect(service.setAuthorRole(target.id, 'AUTHOR')).resolves.toEqual(
      target,
    );
    expect(calls[0]?.text).toContain("role IN ('USER', 'AUTHOR')");
  });

  it('does not change an administrator role', async () => {
    const target = {
      id: '00000000-0000-4000-8000-000000000001',
      username: 'admin',
      name: null,
      role: 'ADMIN',
    };
    const { service } = makeService([[], [target]]);
    await expect(
      service.setAuthorRole(target.id, 'AUTHOR'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown users', async () => {
    const { service } = makeService([[], []]);
    await expect(
      service.setAuthorRole('00000000-0000-4000-8000-000000000001', 'AUTHOR'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
