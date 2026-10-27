import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Deterministic, dependency-free release checks. These are NOT a substitute for
// a production build, deployed-function smoke test, or independent security review.
const root = resolve(import.meta.dirname, '..');
const read = (name) => readFileSync(join(root, name), 'utf8');
const pack = JSON.parse(read('package.json'));
const env = read('.env.example');
const gitignore = read('.gitignore');
const netlify = read('netlify.toml');
const requiredRoutes = {
  '/api/application-status': 'netlify/functions/application-status.mts',
  '/api/applications': 'netlify/functions/apply.mts',
  '/api/admin/session': 'netlify/functions/admin-session.mts',
  '/api/admin/applications': 'netlify/functions/admin-applications.mts',
  '/api/admin/cohorts': 'netlify/functions/admin-cohorts.mts',
  '/api/admin/facilitation-sync': 'netlify/functions/admin-facilitation-sync.mts',
};

assert.equal(pack.version, '0.7.0', 'Update the package version with the release');
for (const [name, path] of Object.entries(requiredRoutes)) {
  assert.ok(existsSync(join(root, path)), `Missing API function: ${path}`);
  assert.ok(read(path).includes(`path: '${name}'`), `Incorrect route for ${path}`);
}
for (const flag of ['APPLICATIONS_OPEN', 'PRIVACY_APPROVED', 'RETENTION_PROCESS_ACTIVE', 'ADMIN_DASHBOARD_ENABLED', 'VITE_ADMIN_LOGIN_ENABLED', 'FACILITATION_CLOUD_SYNC_ENABLED']) {
  assert.match(env, new RegExp(`^${flag}=false$`, 'm'), `Default ${flag} must be false`);
}
for (const entry of ['node_modules/', 'dist/', '.env', '.env.local']) {
  assert.ok(gitignore.includes(entry), `${entry} must be gitignored`);
}
for (const header of ['Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options']) {
  assert.ok(netlify.includes(header), `Missing response header: ${header}`);
}
for (const path of ['supabase/migrations/202610270001_applications.sql', 'supabase/migrations/202610280001_admin_dashboard.sql', 'supabase/migrations/202610280002_facilitation_cloud.sql']) {
  assert.ok(existsSync(join(root, path)), `Missing migration: ${path}`);
}
const migrations = read('supabase/migrations/202610270001_applications.sql') + read('supabase/migrations/202610280001_admin_dashboard.sql');
assert.match(migrations, /enable row level security/i, 'Missing row-level security');
assert.match(migrations, /revoke all on public\.applications from anon, authenticated, public/i, 'Application privileges must not be public');
assert.match(read('netlify/lib/application-server.ts'), /APPLICATIONS_OPEN !== 'true'/, 'Registration must fail closed');
assert.match(read('netlify/lib/admin-server.ts'), /ADMIN_DASHBOARD_ENABLED !== 'true'/, 'Admin must fail closed');

assert.ok(existsSync(join(root, 'src/components/FacilitationDesk.tsx')), 'Personal facilitation desk missing');
for (const name of ['src/lib/session-management.ts', 'src/lib/session-management.test.ts', 'docs/session-management.md']) {
  assert.ok(existsSync(join(root, name)), `Session management file missing: ${name}`);
}
assert.match(read('netlify/lib/admin-server.ts'), /FACILITATOR_USER_ID/, 'Facilitation must be server-gated');
assert.doesNotMatch(env, /^VITE_FACILITATOR_USER_ID=/m, 'Private facilitator ID must not be client-exposed');
console.log(`Release v${pack.version}: ${Object.keys(requiredRoutes).length} API routes, closed-by-default flags, migrations, security headers and ignored secrets verified.`);
