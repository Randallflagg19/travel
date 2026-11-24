import type { Sql } from 'postgres';

export async function migrateAuthorCloudinaryConnections(sql: Sql) {
  await sql`
    CREATE TABLE author_cloudinary_connections (
      user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      cloud_name text NOT NULL,
      api_key text NOT NULL,
      api_secret_encrypted text NOT NULL
    )
  `;
}
