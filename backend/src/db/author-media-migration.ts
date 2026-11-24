import type { Sql } from 'postgres';

export async function migrateAuthorMedia(sql: Sql) {
  await sql`
    ALTER TABLE media_uploads
      ADD COLUMN author_user_id uuid,
      ADD COLUMN size_limit_bytes integer CHECK (size_limit_bytes > 0),
      ADD FOREIGN KEY (author_user_id, cloud_name)
        REFERENCES author_cloudinary_connections (user_id, cloud_name)
  `;
  await sql`
    ALTER TABLE media_deletions
      ADD COLUMN author_user_id uuid,
      ADD FOREIGN KEY (author_user_id, cloud_name)
        REFERENCES author_cloudinary_connections (user_id, cloud_name)
  `;
  await sql`
    CREATE OR REPLACE FUNCTION queue_deleted_post_media() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO media_deletions (environment, cloud_name, public_id, resource_type, retain_until, author_user_id)
      SELECT s.environment, u.cloud_name, u.public_id, u.resource_type, u.signature_expires_at, u.author_user_id
      FROM post_media m JOIN media_uploads u ON u.id = m.upload_id
        JOIN media_sessions s ON s.id = u.session_id
      WHERE m.post_id = OLD.id
      ON CONFLICT (cloud_name, resource_type, public_id) DO NOTHING;
      RETURN OLD;
    END;
    $$
  `;
}
