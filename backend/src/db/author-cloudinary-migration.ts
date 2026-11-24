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

export async function migrateAuthorCloudinarySessionBindings(sql: Sql) {
  await sql`
    ALTER TABLE author_cloudinary_connections
      ADD COLUMN is_active boolean NOT NULL DEFAULT true,
      DROP CONSTRAINT author_cloudinary_connections_pkey,
      ADD PRIMARY KEY (user_id, cloud_name)
  `;
  await sql`
    CREATE UNIQUE INDEX author_cloudinary_active_user_idx
      ON author_cloudinary_connections (user_id) WHERE is_active
  `;
  await sql`
    ALTER TABLE media_sessions
      ADD COLUMN author_cloud_name text,
      ADD FOREIGN KEY (user_id, author_cloud_name)
        REFERENCES author_cloudinary_connections (user_id, cloud_name)
  `;
}
