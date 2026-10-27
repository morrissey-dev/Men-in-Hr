import assert from 'node:assert/strict';

// Use ONLY on a test/staging deployment that is supposed to stay CLOSED.
// No real participant data, authentication token, or external secret is required.
const raw = process.argv[2];
if (!raw) {
  console.error('Usage: npm run smoke:staging -- https://your-test-site.netlify.app');
  process.exit(2);
}
let base;
try {
  const url = new URL(raw);
  assert.equal(url.protocol, 'https:', 'Use HTTPS');
  assert.equal(url.pathname, '/');
  assert.equal(url.search, '');
  assert.equal(url.hash, '');
  base = url.origin;
} catch (error) {
  console.error(`Invalid HTTPS deployment origin: ${error.message}`);
  process.exit(2);
}
async function jsonResponse(path, init) {
  const response = await fetch(`${base}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(15000), ...init });
  assert.match(response.headers.get('content-type') || '', /application\/json/i, `${path} did not return JSON (possibly routed to SPA instead of the function)`);
  const body = await response.json();
  return { response, body };
}

const { response: statusResponse, body: status } = await jsonResponse('/api/application-status');
assert.equal(statusResponse.status, 200, 'Public status endpoint failed');
assert.equal(status.open, false, 'Applications must be CLOSED on staging; aborting all other checks');
console.log('PASS: applications are closed');

const admin = await jsonResponse('/api/admin/session');
assert.ok([401, 503].includes(admin.response.status), `Unauthenticated admin endpoint unexpectedly returned ${admin.response.status}`);
console.log('PASS: admin endpoint denies unauthenticated calls');

const apply = await jsonResponse('/api/applications', {
  method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' },
  body: '{}', // no applicant PII: the closed gate must reject before parsing a form
});
assert.equal(apply.response.status, 503, 'Closed application endpoint should reject POST');
console.log('PASS: student submissions are disabled');
console.log('Staging smoke checks complete. No personal information was submitted.');
