import { ConflictException, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

export type UserRole = 'USER' | 'ADMIN' | 'SUPERADMIN';

export type UserRow = {
  id: string;
  username: string;
  email: string | null;
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
      SELECT id, username, email, password_hash, role, name, created_at
      FROM users
      WHERE lower(email) = lower(${email})
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async findByUsername(username: string): Promise<UserRow | null> {
    if (!this.db.client) return null;
    const rows = await this.db.client<UserRow[]>`
      SELECT id, username, email, password_hash, role, name, created_at
      FROM users
      WHERE lower(username) = lower(${username})
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<Omit<UserRow, 'password_hash'> | null> {
    if (!this.db.client) return null;
    const rows = await this.db.client<Omit<UserRow, 'password_hash'>[]>`
      SELECT id, username, email, role, name, created_at
      FROM users
      WHERE id = ${id}::uuid
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async createUser(input: {
    username: string;
    email?: string;
    passwordHash: string;
    name?: string;
    role?: UserRole;
  }): Promise<Omit<UserRow, 'password_hash'>> {
    if (!this.db.client) {
      throw new ConflictException('Database is not configured');
    }

    const existingUsername = await this.findByUsername(input.username);
    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    if (input.email) {
      const existingEmail = await this.findByEmail(input.email);
      if (existingEmail) throw new ConflictException('Email already exists');
    }

    const role = input.role ?? 'USER';
    try {
      const rows = await this.db.client<Omit<UserRow, 'password_hash'>[]>`
        INSERT INTO users (username, email, password_hash, role, name)
        VALUES (${input.username}, ${input.email ?? null}, ${input.passwordHash}, ${role}, ${input.name ?? null})
        RETURNING id, username, email, role, name, created_at
      `;
      return rows[0];
    } catch (e: unknown) {
      // unique index on lower(email) / lower(username)
      if (
        typeof e === 'object' &&
        e !== null &&
        'code' in e &&
        typeof (e as { code: unknown }).code === 'string' &&
        (e as { code: string }).code === '23505'
      ) {
        throw new ConflictException('Username or email already exists');
      }
      throw e;
    }
  }

  async updateEmail(userId: string, email: string) {
    if (!this.db.client) {
      throw new ConflictException('Database is not configured');
    }

    const existing = await this.findByEmail(email);
    if (existing && existing.id !== userId) {
      throw new ConflictException('Email already exists');
    }

    const rows = await this.db.client<Omit<UserRow, 'password_hash'>[]>`
      UPDATE users
      SET email = ${email}
      WHERE id = ${userId}::uuid
      RETURNING id, username, email, role, name, created_at
    `;
    return rows[0] ?? null;
  }
}
