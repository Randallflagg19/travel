import type { Sql } from 'postgres';

export async function migrateAlbums(sql: Sql) {
  await sql`
    CREATE TABLE albums (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      country text NOT NULL CHECK (btrim(country) <> ''),
      title text NOT NULL CHECK (btrim(title) <> '')
    )
  `;
}
