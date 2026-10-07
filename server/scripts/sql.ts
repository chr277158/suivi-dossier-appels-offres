import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pool } from '../src/db';

async function main() {
  const operation = process.argv[2];
  if (operation !== 'schema' && operation !== 'seed') {
    throw new Error('Usage: npm run db:migrate | npm run seed');
  }
  const file = resolve(process.cwd(), 'db', operation === 'schema' ? 'schema.sql' : 'seed.sql');
  const sql = await readFile(file, 'utf8');
  await pool.query(sql);
  console.log(`${operation} applied from ${file}`);
  await pool.end();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Database script failed');
  await pool.end();
  process.exitCode = 1;
});
