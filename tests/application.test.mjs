import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { initialApplication, validateApplication } from '../src/lib/application-validation.ts';
import { readPublicStatus, submitApplication } from '../netlify/lib/application-server.ts';

const sample = {
  ...initialApplication,
  fullName: 'Test Student', email: 'Student@example.com', institution: 'JKUAT', yearOfStudy: '3',
  interests: ['self-discovery', 'hr-career-pathways'], motivation: 'I want to learn about careers.',
  isAdult: true, privacyAccepted: true, turnstileToken: 'valid-test-token',
};
const envKeys = ['APPLICATIONS_OPEN', 'PRIVACY_APPROVED', 'RETENTION_PROCESS_ACTIVE', 'SITE_ORIGIN', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY', 'PRIVACY_CONTROLLER_NAME', 'PRIVACY_CONTACT_EMAIL', 'APPLICATION_RETENTION_DAYS', 'APPLICATION_COHORT_SLUG'];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

afterEach(() => {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  globalThis.fetch = originalFetch;
});

function enableSettings() {
  Object.assign(process.env, {
    APPLICATIONS_OPEN: 'true', PRIVACY_APPROVED: 'true', RETENTION_PROCESS_ACTIVE: 'true',
    SITE_ORIGIN: 'https://men-in-hr.netlify.app', SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SECRET_KEY: 'server-secret', TURNSTILE_SITE_KEY: 'public-test-key',
    TURNSTILE_SECRET_KEY: 'turnstile-secret', PRIVACY_CONTROLLER_NAME: 'Approved organisation',
    PRIVACY_CONTACT_EMAIL: 'privacy@example.org', APPLICATION_RETENTION_DAYS: '180',
  });
}

function request(body = sample, origin = 'https://men-in-hr.netlify.app') {
  return new Request('https://men-in-hr.netlify.app/api/applications', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

function stubServices({ turnstileSuccess = true, duplicate = false, open = true } = {}) {
  const events = [];
  globalThis.fetch = async (url, init = {}) => {
    const uri = String(url);
    events.push({ uri, method: init.method ?? 'GET', body: init.body, headers: init.headers });
    if (uri.includes('/cohorts?')) return Response.json(open ? [{ id: 'cohort-uuid', name: 'Cohort 1', applications_open: true }] : []);
    if (uri.includes('siteverify')) return Response.json({ success: turnstileSuccess, hostname: 'men-in-hr.netlify.app' });
    if (uri.endsWith('/applications')) return new Response(null, { status: duplicate ? 409 : 201 });
    throw new Error(`Unexpected outbound request ${uri}`);
  };
  return events;
}

test('accepts valid student data, normalizes email and name', () => {
  const { value, errors } = validateApplication({ ...sample, fullName: '  Test   Student ', email: ' Test@Example.com ' });
  assert.deepEqual(errors, {});
  assert.equal(value.email, 'test@example.com');
  assert.equal(value.fullName, 'Test Student');
});

test('rejects unexpected interests and unconfirmed privacy or adulthood', () => {
  const invalid = validateApplication({ ...sample, interests: ['unknown-topic'], isAdult: false, privacyAccepted: false });
  assert.ok(invalid.errors.interests);
  assert.ok(invalid.errors.isAdult);
  assert.ok(invalid.errors.privacyAccepted);
});

test('rejects honeypot, oversized message and too many interests', () => {
  const invalid = validateApplication({ ...sample, website: 'spam', motivation: 'x'.repeat(401), interests: ['self-discovery', 'hr-career-pathways', 'personal-branding', 'communication'] });
  assert.equal(Object.keys(invalid.errors).length, 3);
});

test('closed by default: no DB traffic or personal data submission', async () => {
  delete process.env.APPLICATIONS_OPEN;
  globalThis.fetch = () => { throw new Error('DB must not be queried when disabled'); };
  assert.deepEqual(await readPublicStatus(), { open: false });
  const response = await submitApplication(request());
  assert.equal(response.status, 503);
});

test('requires institutional privacy and retention approvals', async () => {
  enableSettings();
  delete process.env.PRIVACY_APPROVED;
  stubServices();
  assert.deepEqual(await readPublicStatus(), { open: false });
});

test('public status opens only when DB cohort is also open', async () => {
  enableSettings(); stubServices({ open: false });
  assert.deepEqual(await readPublicStatus(), { open: false });
  const result = await submitApplication(request());
  assert.equal(result.status, 503);
});

test('public status exposes only approved information and never secrets', async () => {
  enableSettings(); stubServices();
  const status = await readPublicStatus();
  assert.equal(status.open, true);
  assert.equal(status.cohortName, 'Cohort 1');
  assert.equal(status.privacyEmail, 'privacy@example.org');
  assert.ok(!JSON.stringify(status).includes('server-secret'));
});

test('blocks cross-origin posts before interacting with providers', async () => {
  enableSettings();
  globalThis.fetch = () => { throw new Error('Provider must not be called'); };
  const response = await submitApplication(request(sample, 'https://attacker.example'));
  assert.equal(response.status, 403);
});

test('server rejects invalid JSON application fields', async () => {
  enableSettings();
  globalThis.fetch = () => { throw new Error('Provider must not be called'); };
  const response = await submitApplication(request({ ...sample, isAdult: false }));
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.ok(data.fields.isAdult);
});

test('invalid turnstile does not write application', async () => {
  enableSettings(); const events = stubServices({ turnstileSuccess: false });
  const response = await submitApplication(request());
  assert.equal(response.status, 400);
  assert.ok(!events.some(item => item.uri.endsWith('/applications')));
});

test('valid POST writes only minimal data and gets confirmation', async () => {
  enableSettings(); const events = stubServices();
  const response = await submitApplication(request());
  assert.equal(response.status, 202);
  const post = events.find(item => item.uri.endsWith('/applications'));
  assert.equal(post.method, 'POST');
  const data = JSON.parse(post.body);
  assert.equal(data.email, 'student@example.com');
  assert.equal(data.cohort_id, 'cohort-uuid');
  assert.ok(data.privacy_consented_at);
  assert.ok(!('turnstileToken' in data));
});

test('duplicate applications return generic confirmation', async () => {
  enableSettings(); stubServices({ duplicate: true });
  const response = await submitApplication(request());
  assert.equal(response.status, 202);
});

test('rejects oversized JSON and incorrect content type before provider calls', async () => {
  enableSettings();
  globalThis.fetch = () => { throw new Error('Provider must not be called'); };
  const huge = { ...sample, motivation: 'a'.repeat(20000) };
  assert.equal((await submitApplication(request(huge))).status, 413);
  const textRequest = new Request('https://men-in-hr.netlify.app/api/applications', { method: 'POST', headers: { Origin: process.env.SITE_ORIGIN, 'Content-Type': 'text/plain' }, body: 'test' });
  assert.equal((await submitApplication(textRequest)).status, 415);
});

test('rejects forged successful bot result from the wrong hostname', async () => {
  enableSettings();
  let insertCount = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes('/cohorts?')) return Response.json([{ id: 'test', name: 'Cohort 1', applications_open: true }]);
    if (String(url).includes('siteverify')) return Response.json({ success: true, hostname: 'attacker.example' });
    insertCount++;
    return new Response(null, { status: 201 });
  };
  const result = await submitApplication(request());
  assert.equal(result.status, 400);
  assert.equal(insertCount, 0);
});

test('backend secrets never appear in JSON error responses', async () => {
  enableSettings();
  globalThis.fetch = async () => { throw new Error('server-secret'); };
  const body = await (await submitApplication(request())).text();
  assert.ok(!body.includes('server-secret'));
});
