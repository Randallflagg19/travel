import type { Sql } from 'postgres';
import { runMigrations } from './migrations';
import { migrateMedia } from './media-migration';

export async function runVersionedMigrations(sql: Sql) {
  await sql.begin(async (transaction) => {
    const tx = transaction as unknown as Sql;
    await tx`SET LOCAL lock_timeout = '5s'`;
    await tx`SET LOCAL statement_timeout = '120s'`;
    await tx`SELECT pg_advisory_xact_lock(184726031)`;
    await tx`CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
    const versions = await tx<
      { version: string }[]
    >`SELECT version FROM schema_migrations`;
    if (!versions.some((row) => row.version === '001_legacy')) {
      // Reuse the legacy baseline inside this transaction, without BEGIN nesting.
      await runMigrations(tx, true);
      await tx`INSERT INTO schema_migrations (version) VALUES ('001_legacy')`;
    }
    if (!versions.some((row) => row.version === '002_media_posts')) {
      await migrateMedia(tx);
      await tx`INSERT INTO schema_migrations (version) VALUES ('002_media_posts')`;
    }
  });
}
