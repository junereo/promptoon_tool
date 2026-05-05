import { execFileSync } from 'node:child_process';

const DEFAULT_TEST_DATABASE_URL = 'postgresql://promptoon_test_user:promptoon_test_password@localhost:5436/promptoon_test';
const databaseUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
const parsedUrl = new URL(databaseUrl);
const databaseName = parsedUrl.pathname.replace(/^\//, '');
const roleName = decodeURIComponent(parsedUrl.username);
const rolePassword = decodeURIComponent(parsedUrl.password);
const hostName = parsedUrl.hostname;
const containerName = process.env.POSTGRES_CONTAINER ?? 'promptoon_postgres';
const adminUser = process.env.POSTGRES_ADMIN_USER ?? 'postgres';

function assertLocalDatabaseHost() {
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (localHosts.has(hostName) || process.env.ALLOW_REMOTE_TEST_DB_SETUP === '1') {
    return;
  }

  throw new Error('Refusing to setup a non-local TEST_DATABASE_URL without ALLOW_REMOTE_TEST_DB_SETUP=1.');
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function runSql(sql) {
  execFileSync(
    'docker',
    ['exec', containerName, 'psql', '-U', adminUser, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql],
    {
      stdio: 'inherit'
    }
  );
}

if (!databaseName || !roleName || !rolePassword) {
  throw new Error('TEST_DATABASE_URL must include database name, username, and password.');
}

assertLocalDatabaseHost();

runSql(`
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${quoteLiteral(roleName)}) THEN
    CREATE ROLE ${quoteIdentifier(roleName)} LOGIN PASSWORD ${quoteLiteral(rolePassword)};
  ELSE
    ALTER ROLE ${quoteIdentifier(roleName)} WITH LOGIN PASSWORD ${quoteLiteral(rolePassword)};
  END IF;
END
$$;
`);
runSql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${quoteLiteral(databaseName)};`);
runSql(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)};`);
runSql(`CREATE DATABASE ${quoteIdentifier(databaseName)} OWNER ${quoteIdentifier(roleName)};`);

console.log(`Prepared local API integration database "${databaseName}" for role "${roleName}".`);
