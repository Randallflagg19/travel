import type { Sql } from 'postgres';

// Additive migration: the cover remains in posts for the previous application.
export async function migrateMedia(sql: Sql) {
  await sql`
    CREATE TABLE media_sessions (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id),
      environment text NOT NULL,
      state text NOT NULL DEFAULT 'OPEN' CHECK (state IN ('OPEN', 'PUBLISHED', 'CANCELLED')),
      post_id uuid,
      publication_hash text,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours'
    )
  `;
  await sql`
    CREATE TABLE media_uploads (
      id uuid PRIMARY KEY,
      session_id uuid NOT NULL REFERENCES media_sessions(id),
      media_type text NOT NULL CHECK (media_type IN ('PHOTO', 'VIDEO')),
      cloud_name text NOT NULL,
      public_id text NOT NULL,
      resource_type text NOT NULL CHECK (resource_type IN ('image', 'video')),
      declared_bytes bigint NOT NULL CHECK (declared_bytes > 0),
      media_url text,
      media_width integer,
      media_height integer,
      ready boolean NOT NULL DEFAULT false,
      signature_expires_at timestamptz NOT NULL DEFAULT now() + interval '2 hours',
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (cloud_name, resource_type, public_id)
    )
  `;
  await sql`CREATE INDEX media_uploads_session_idx ON media_uploads(session_id)`;
  await sql`CREATE INDEX media_sessions_expiry_idx ON media_sessions(expires_at) WHERE state = 'OPEN'`;
  await sql`
    CREATE TABLE post_media (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      upload_id uuid UNIQUE REFERENCES media_uploads(id),
      position integer NOT NULL CHECK (position BETWEEN 0 AND 9),
      media_type text NOT NULL CHECK (media_type IN ('PHOTO', 'VIDEO', 'AUDIO')),
      media_url text NOT NULL,
      cloudinary_public_id text,
      cloud_name text,
      resource_type text NOT NULL CHECK (resource_type IN ('image', 'video', 'raw')),
      media_width integer,
      media_height integer,
      UNIQUE (post_id, position)
    )
  `;
  await sql`CREATE INDEX post_media_resource_idx ON post_media(cloudinary_public_id)`;
  await sql`
    INSERT INTO post_media (post_id, position, media_type, media_url,
      cloudinary_public_id, cloud_name, resource_type, media_width, media_height)
    SELECT id, 0, media_type, media_url, cloudinary_public_id,
      substring(media_url from '^https://res[.]cloudinary[.]com/([^/]+)/'),
      CASE WHEN media_type = 'PHOTO' THEN 'image' ELSE 'video' END,
      media_width, media_height
    FROM posts WHERE media_type <> 'STORY' AND media_url <> ''
  `;
  await sql`
    CREATE TABLE media_deletions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      environment text NOT NULL,
      cloud_name text NOT NULL,
      public_id text NOT NULL,
      resource_type text NOT NULL CHECK (resource_type IN ('image', 'video', 'raw')),
      attempts integer NOT NULL DEFAULT 0,
      last_error text,
      next_attempt_at timestamptz NOT NULL DEFAULT now(),
      retain_until timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (cloud_name, resource_type, public_id)
    )
  `;
  await sql`CREATE INDEX media_deletions_retry_idx ON media_deletions(next_attempt_at)`;
  // The previous release deletes only its cover. Preserve cleanup work for the
  // remaining carousel files even if that release is temporarily rolled back.
  await sql`
    CREATE FUNCTION queue_deleted_post_media() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO media_deletions (environment, cloud_name, public_id, resource_type, retain_until)
      SELECT s.environment, u.cloud_name, u.public_id, u.resource_type, u.signature_expires_at
      FROM post_media m JOIN media_uploads u ON u.id = m.upload_id
        JOIN media_sessions s ON s.id = u.session_id
      WHERE m.post_id = OLD.id
      ON CONFLICT (cloud_name, resource_type, public_id) DO NOTHING;
      RETURN OLD;
    END;
    $$
  `;
  await sql`CREATE TRIGGER posts_queue_media_deletion BEFORE DELETE ON posts FOR EACH ROW EXECUTE FUNCTION queue_deleted_post_media()`;
}
