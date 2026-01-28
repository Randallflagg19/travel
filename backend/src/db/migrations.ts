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

    // Posts: 1 media = 1 post
    await q`
      CREATE TABLE IF NOT EXISTS posts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        media_type text NOT NULL,
        media_url text NOT NULL,
        cloudinary_public_id text,
        folder text,
        text text,
        country text,
        city text,
        lat double precision,
        lng double precision,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    // Restrict media_type values (easier than creating a Postgres enum for MVP)
    await q`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'posts_media_type_check'
        ) THEN
          ALTER TABLE posts
          ADD CONSTRAINT posts_media_type_check
          CHECK (media_type IN ('PHOTO', 'VIDEO', 'AUDIO'));
        END IF;
      END $$;
    `;

    await q`CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts (created_at DESC)`;
    await q`CREATE INDEX IF NOT EXISTS posts_user_id_idx ON posts (user_id)`;

    // Comments
    await q`
      CREATE TABLE IF NOT EXISTS comments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        text text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    await q`CREATE INDEX IF NOT EXISTS comments_post_id_idx ON comments (post_id)`;

    // Likes (one like per user per post)
    await q`
      CREATE TABLE IF NOT EXISTS likes (
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, post_id)
      )
    `;
    await q`CREATE INDEX IF NOT EXISTS likes_post_id_idx ON likes (post_id)`;
  });
}
