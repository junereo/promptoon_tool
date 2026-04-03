import { closePool } from './index';
import { runMigrations } from './migrate';

async function main() {
  await runMigrations();
  console.log('Migrations completed successfully.');
  await closePool();
}

main().catch(async (error) => {
  console.error('Migration run failed.', error);
  await closePool();
  process.exit(1);
});

