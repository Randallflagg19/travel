/// <reference types="jest" />
import { ConfigService } from '@nestjs/config';
import postgres, { type Sql } from 'postgres';
import { DbService } from './db.service';

jest.mock('postgres', () => ({ __esModule: true, default: jest.fn() }));

describe('Database transport configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(postgres).mockReturnValue(jest.fn() as unknown as Sql);
  });

  it.each([
    { setting: undefined, expected: 'require' },
    { setting: 'require', expected: 'require' },
    { setting: 'disable', expected: false },
  ])('uses SSL=$expected when DB_SSL=$setting', ({ setting, expected }) => {
    const url = 'postgresql://local-user@127.0.0.1:5432/local-test';
    const values = { DATABASE_URL: url, DB_SSL: setting };
    const config = {
      get: (key: string) => values[key as keyof typeof values],
    } as unknown as ConfigService;

    const service = new DbService(config);

    expect(service.isConfigured).toBe(true);
    expect(postgres).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ ssl: expected }),
    );
  });
});
