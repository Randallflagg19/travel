import postgres from 'postgres';
import { runVersionedMigrations } from './versioned-migrations';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error('Set DATABASE_URL explicitly before running migrations');
  const sql = postgres(url, {
    ssl: process.env.DB_SSL === 'disable' ? false : 'require',
    max: 1,
    prepare: false,
  });
  try {
    await runVersionedMigrations(sql);
    console.log('Database migrations complete');
  } finally {
    await sql.end();
  }
}
void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Migration failed');
  process.exitCode = 1;
});
