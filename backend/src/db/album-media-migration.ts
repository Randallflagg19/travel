import type { Sql } from 'postgres';

export async function migrateAlbumMedia(sql: Sql) {
  await sql`ALTER TABLE media_sessions ADD COLUMN album_id uuid REFERENCES albums(id)`;
  await sql`ALTER TABLE media_uploads ADD COLUMN asset_folder text`;
  await sql`ALTER TABLE posts ADD COLUMN album_id uuid REFERENCES albums(id)`;
  await sql`
    CREATE INDEX posts_album_feed_idx ON posts (album_id, created_at, id)
    WHERE album_id IS NOT NULL
  `;
}

export async function migrateAlbumFolderPaths(sql: Sql) {
  await sql`ALTER TABLE albums ADD COLUMN folder_path text`;
  // Keep the folder already used by an earlier upload, in either Cloudinary mode.
  await sql`
    UPDATE albums a SET folder_path = previous.path
    FROM (
      SELECT DISTINCT ON (s.album_id) s.album_id,
        COALESCE(
          substring(u.asset_folder FROM '^travel/(.+)$'),
          substring(u.public_id FROM '^travel/[^/]+/(.+)/[^/]+$')
        ) AS path
      FROM media_sessions s JOIN media_uploads u ON u.session_id = s.id
      WHERE s.album_id IS NOT NULL
      ORDER BY s.album_id, u.signature_expires_at, u.id
    ) previous
    WHERE a.id = previous.album_id
  `;
  await sql`
    CREATE UNIQUE INDEX albums_folder_path_uidx ON albums (lower(folder_path))
    WHERE folder_path IS NOT NULL
  `;
}

export async function migrateMediaSessionCountry(sql: Sql) {
  await sql`ALTER TABLE media_sessions ADD COLUMN country text`;
}
