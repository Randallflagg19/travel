import { ConflictException, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

export type UserRole = 'USER' | 'ADMIN' | 'SUPERADMIN';

export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  name: string | null;
  created_at: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly db: DbService) {}

  async findByEmail(email: string): Promise<UserRow | null> {
    if (!this.db.client) return null;
    const rows = await this.db.client<UserRow[]>`
      SELECT id, email, password_hash, role, name, created_at
      FROM users
      WHERE lower(email) = lower(${email})
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<Omit<UserRow, 'password_hash'> | null> {
    if (!this.db.client) return null;
    const rows = await this.db.client<Omit<UserRow, 'password_hash'>[]>`
      SELECT id, email, role, name, created_at
      FROM users
      WHERE id = ${id}::uuid
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    name?: string;
    role?: UserRole;
  }): Promise<Omit<UserRow, 'password_hash'>> {
    if (!this.db.client) {
      throw new ConflictException('Database is not configured');
    }

    const role = input.role ?? 'USER';
    try {
      const rows = await this.db.client<Omit<UserRow, 'password_hash'>[]>`
        INSERT INTO users (email, password_hash, role, name)
        VALUES (${input.email}, ${input.passwordHash}, ${role}, ${input.name ?? null})
        RETURNING id, email, role, name, created_at
      `;
      return rows[0];
    } catch (e: unknown) {
      // unique index on lower(email)
      if (
        typeof e === 'object' &&
        e !== null &&
        'code' in e &&
        typeof (e as { code: unknown }).code === 'string' &&
        (e as { code: string }).code === '23505'
      ) {
        throw new ConflictException('Email already exists');
      }
      throw e;
    }
  }
}
