import type { Sql } from 'postgres';

export async function runMigrations(sql: Sql) {
  // One transaction so we don't end up half-migrated.
  await sql.begin(async (tx) => {
    // postgres' TransactionSql type is not callable in TS due to Omit<Sql,...>,
    // but at runtime it works as a tagged template. Cast for TS.
    const q = tx as unknown as Sql;

    // UUID generation
    await q`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;

    // Users (minimum for auth)
    await q`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL,
        password_hash text NOT NULL,
        role text NOT NULL DEFAULT 'USER',
        name text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    // Case-insensitive uniqueness for email
    await q`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
      ON users ((lower(email)))
    `;
  });
}
