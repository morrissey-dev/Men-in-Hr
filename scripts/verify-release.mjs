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
  '/api/admin/attendance/sessions': 'netlify/functions/admin-attendance-sessions.mts',
  '/api/admin/attendance/imports': 'netlify/functions/admin-attendance-imports.mts',
  '/api/admin/session-resources': 'netlify/functions/admin-session-resources.mts',
  '/api/admin/session-ai-jobs': 'netlify/functions/admin-session-ai-jobs.mts',
  '/api/admin/session-ai-process': 'netlify/functions/admin-session-ai-process.mts',
  '/api/admin/member-roster': 'netlify/functions/admin-member-roster.mts',
  '/api/admin/member-invite': 'netlify/functions/admin-member-invite.mts',
  '/api/member/session': 'netlify/functions/member-session.mts',
  '/api/member/resources': 'netlify/functions/member-resources.mts',
  '/api/admin/facilitation-sync': 'netlify/functions/admin-facilitation-sync.mts',
};

assert.equal(pack.version, '0.8.0', 'Update the package version with the release');
for (const [name, path] of Object.entries(requiredRoutes)) {
  assert.ok(existsSync(join(root, path)), `Missing API function: ${path}`);
  assert.ok(read(path).includes(`path: '${name}'`), `Incorrect route for ${path}`);
}
for (const flag of ['APPLICATIONS_OPEN', 'PRIVACY_APPROVED', 'RETENTION_PROCESS_ACTIVE', 'ADMIN_DASHBOARD_ENABLED', 'VITE_ADMIN_LOGIN_ENABLED', 'FACILITATION_CLOUD_SYNC_ENABLED', 'SESSION_PORTAL_ENABLED', 'SESSION_PRIVACY_APPROVED', 'ATTENDANCE_IMPORTS_ENABLED', 'ATTENDANCE_RETENTION_APPROVED', 'MEDIA_UPLOADS_ENABLED', 'MEDIA_RETENTION_APPROVED', 'RECORDING_CONSENT_APPROVED', 'CERTIFICATES_ENABLED', 'MEMBER_PORTAL_ENABLED', 'MEMBER_INVITES_ENABLED', 'AI_PROCESSING_ENABLED', 'AI_DATA_PROCESSING_APPROVED', 'VITE_MEMBER_LOGIN_ENABLED']) {
  assert.match(env, new RegExp(`^${flag}=false$`, 'm'), `Default ${flag} must be false`);
}
for (const entry of ['node_modules/', 'dist/', '.env', '.env.local']) {
  assert.ok(gitignore.includes(entry), `${entry} must be gitignored`);
}
for (const header of ['Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options']) {
  assert.ok(netlify.includes(header), `Missing response header: ${header}`);
}
for (const path of ['supabase/migrations/202610270001_applications.sql', 'supabase/migrations/202610280001_admin_dashboard.sql', 'supabase/migrations/202610280002_facilitation_cloud.sql', 'supabase/migrations/202611140001_private_session_library.sql', 'supabase/migrations/202611140002_attendance_import_transactions.sql']) {
  assert.ok(existsSync(join(root, path)), `Missing migration: ${path}`);
}
const migrations = read('supabase/migrations/202610270001_applications.sql') + read('supabase/migrations/202610280001_admin_dashboard.sql');
assert.match(migrations, /enable row level security/i, 'Missing row-level security');
assert.match(migrations, /revoke all on public\.applications from anon, authenticated, public/i, 'Application privileges must not be public');
assert.match(read('netlify/lib/application-server.ts'), /APPLICATIONS_OPEN !== 'true'/, 'Registration must fail closed');
assert.match(read('netlify/lib/admin-server.ts'), /ADMIN_DASHBOARD_ENABLED !== 'true'/, 'Admin must fail closed');
assert.match(read('netlify/lib/session-portal.ts'), /SESSION_PORTAL_ENABLED/, 'Session resource APIs must be server-gated');
assert.match(read('netlify/lib/session-portal.ts'), /rpc\/member_list_session_resources/, 'Member resources must use the paginated authorized database function');
assert.match(read('netlify/lib/session-ai.ts'), /AI_DATA_PROCESSING_APPROVED/, 'AI must require separate provider/privacy approval');
const sessionMigration = read('supabase/migrations/202611140001_private_session_library.sql');
assert.match(sessionMigration, /values \(\s*'menhr-private', 'menhr-private', false/s, 'Private media bucket must never be public');
assert.match(sessionMigration, /revoke all on function public\.member_list_session_resources\(uuid,uuid,integer,integer\) from public, anon, authenticated/i, 'Member-resource SQL must not be directly executable by browser roles');
assert.match(sessionMigration, /grant execute on function public\.member_list_session_resources\(uuid,uuid,integer,integer\) to service_role/i, 'Member-resource SQL must be callable by the server service role');
assert.ok(existsSync(join(root, 'tests/member-resource-pagination.test.mjs')), 'Member resource pagination regression tests are required');
assert.match(read('netlify/lib/session-portal.ts'), /createSignedUrl\([^\n]+DOWNLOAD_SECONDS/, 'Private downloads must use short-lived signed URLs');
assert.doesNotMatch(env, /^VITE_AI_API_KEY=/m, 'AI provider credentials must not be exposed to the client');

assert.ok(existsSync(join(root, 'src/components/FacilitationDesk.tsx')), 'Personal facilitation desk missing');
for (const name of ['src/lib/session-management.ts', 'src/lib/session-management.test.ts', 'docs/session-management.md']) {
  assert.ok(existsSync(join(root, name)), `Session management file missing: ${name}`);
}
assert.match(read('netlify/lib/admin-server.ts'), /FACILITATOR_USER_ID/, 'Facilitation must be server-gated');
assert.doesNotMatch(env, /^VITE_FACILITATOR_USER_ID=/m, 'Private facilitator ID must not be client-exposed');
console.log(`Release v${pack.version}: ${Object.keys(requiredRoutes).length} API routes, closed-by-default flags, private media, migrations, security headers and ignored secrets verified.`);
