import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pool } from '../src/db';

async function main() {
  const operation = process.argv[2];
  if (operation !== 'schema' && operation !== 'seed' && operation !== 'dossier-detail' && operation !== 'notifications' && operation !== 'reference-rules' && operation !== 'dossier-compliance' && operation !== 'dossier-launch-specification' && operation !== 'dossier-provisional-bond-return' && operation !== 'surveillance-events' && operation !== 'leave-management' && operation !== 'user-service' && operation !== 'auth-session-hardening') {
    throw new Error('Usage: npm run db:migrate | npm run db:migrate:dossier-detail | npm run db:migrate:notifications | npm run db:migrate:reference-rules | npm run db:migrate:dossier-compliance | npm run db:migrate:dossier-launch-specification | npm run db:migrate:dossier-provisional-bond-return | npm run seed');
  }
  const file = operation === 'dossier-detail'
    ? resolve(process.cwd(), 'db', 'migrations', '20261020_dossier_detail.sql')
    : operation === 'notifications'
      ? resolve(process.cwd(), 'db', 'migrations', '20261020_simplified_notifications.sql')
      : operation === 'reference-rules'
        ? resolve(process.cwd(), 'db', 'migrations', '20261022_reference_rules.sql')
        : operation === 'dossier-compliance'
          ? resolve(process.cwd(), 'db', 'migrations', '20261022_dossier_compliance.sql')
          : operation === 'dossier-launch-specification'
            ? resolve(process.cwd(), 'db', 'migrations', '20261023_launch_specification_status.sql')
            : operation === 'dossier-provisional-bond-return'
              ? resolve(process.cwd(), 'db', 'migrations', '20261023_provisional_bond_return_status.sql')
              : operation === 'surveillance-events'
                ? resolve(process.cwd(), 'db', 'migrations', '20261026_surveillance_events.sql')
                : operation === 'leave-management'
                  ? resolve(process.cwd(), 'db', 'migrations', '20261026_leave_management.sql')
                  : operation === 'user-service'
                    ? resolve(process.cwd(), 'db', 'migrations', '20261026_user_service.sql')
                    : operation === 'auth-session-hardening'
                    ? resolve(process.cwd(), 'db', 'migrations', '20261026_auth_session_hardening.sql')
    : resolve(process.cwd(), 'db', operation === 'schema' ? 'schema.sql' : 'seed.sql');
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
