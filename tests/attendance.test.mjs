import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { adminAttendanceSessions } from '../netlify/lib/admin-attendance.ts';

const uid = '72f9a302-1391-4e87-a217-77b5e16b5e1d';
const cohortId = '9dbeaa23-e643-4e87-b46e-f3785fe9aa2f';
const sessionId = '0d2bb8f0-5f7a-4d76-b0b8-2f9d8b0a5d9a';
const keys = ['ADMIN_DASHBOARD_ENABLED','SITE_ORIGIN','SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_PUBLISHABLE_KEY'];
const initial = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

function configure() {
  Object.assign(process.env, {
    ADMIN_DASHBOARD_ENABLED: 'true',
    SITE_ORIGIN: 'https://men-in-hr.netlify.app',
    SUPABASE_URL: 'https://sample.supabase.co',
    SUPABASE_SECRET_KEY: 'server-only-key',
    SUPABASE_PUBLISHABLE_KEY: 'public-key',
  });
}

function req(method = 'GET', body = null, origin = 'https://men-in-hr.netlify.app', token = 't'.repeat(32), query = '') {
  return new Request(`https://men-in-hr.netlify.app/api/admin/attendance/sessions${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: origin,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function providers({ authenticated = true, role = 'owner', sessions = [] } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const uri = String(url);
    calls.push({ uri, init });
    if (uri.endsWith('/auth/v1/user')) {
      return authenticated ? Response.json({ id: uid }) : Response.json({ message: 'Invalid JWT' }, { status: 401 });
    }
    if (uri.includes('admin_members?')) return Response.json(role ? [{ role }] : []);
    if (uri.includes('attendance_sessions?') && init.method === 'POST') {
      const inserted = { id: sessionId, ...JSON.parse(init.body) };
      return Response.json([inserted], { status: 201 });
    }
    if (uri.includes('attendance_sessions?')) return Response.json(sessions);
    throw new Error(`Unexpected backend request: ${uri}`);
  };
  return calls;
}

afterEach(() => {
  for (const key of keys) {
    if (initial[key] === undefined) delete process.env[key];
    else process.env[key] = initial[key];
  }
  globalThis.fetch = originalFetch;
});

test('attendance sessions require the existing admin dashboard configuration', async () => {
  delete process.env.ADMIN_DASHBOARD_ENABLED;
  globalThis.fetch = () => { throw new Error('Provider must not be called'); };
  assert.equal((await adminAttendanceSessions(req())).status, 503);
});

test('attendance sessions reject a forged or missing Supabase session', async () => {
  configure();
  const calls = providers({ authenticated: false });
  assert.equal((await adminAttendanceSessions(req())).status, 401);
  assert.equal(calls.length, 1);
});

test('attendance session reads are authenticated and scoped to a valid cohort', async () => {
  configure();
  const calls = providers({ sessions: [{ id: sessionId, cohort_id: cohortId, session_number: 1 }] });
  const response = await adminAttendanceSessions(req('GET', null, undefined, undefined, `?cohort=${cohortId}`));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).sessions.length, 1);
  assert.ok(calls.some(call => call.uri.includes(`cohort_id=eq.${cohortId}`)));
});

test('invalid cohort filter is rejected before database access', async () => {
  configure();
  const calls = providers();
  assert.equal((await adminAttendanceSessions(req('GET', null, undefined, undefined, '?cohort=bad'))).status, 400);
  assert.equal(calls.length, 2);
  assert.equal(calls.some(call => call.uri.includes('attendance_sessions?')), false);
});

test('cross-origin session creation is blocked', async () => {
  configure();
  globalThis.fetch = () => { throw new Error('Provider must not be called'); };
  const response = await adminAttendanceSessions(req('POST', {
    cohortId, sessionNumber: 1, title: 'Session One',
    scheduledAt: '2026-11-05T17:00:00.000Z', durationMinutes: 60,
  }, 'https://attacker.example'));
  assert.equal(response.status, 403);
});

test('owner can create a valid Google Meet session through the server-only key', async () => {
  configure();
  const calls = providers();
  const response = await adminAttendanceSessions(req('POST', {
    cohortId,
    sessionNumber: 1,
    title: 'Self-Discovery and Personal Growth',
    scheduledAt: '2026-11-05T17:00:00.000Z',
    durationMinutes: 60,
    meetingUrl: 'https://meet.google.com/abc-defg-hij',
  }));
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.session.id, sessionId);
  const insert = calls.find(call => call.uri.includes('attendance_sessions?') && call.init.method === 'POST');
  assert.ok(insert);
  assert.equal(insert.init.headers.apikey, 'server-only-key');
  assert.deepEqual(JSON.parse(insert.init.body), {
    cohort_id: cohortId,
    session_number: 1,
    title: 'Self-Discovery and Personal Growth',
    scheduled_at: '2026-11-05T17:00:00.000Z',
    duration_minutes: 60,
    meeting_url: 'https://meet.google.com/abc-defg-hij',
    status: 'planned',
    created_by: uid,
  });
});

test('invalid session data and non-Google Meet links are rejected', async () => {
  configure();
  const calls = providers();
  const base = {
    cohortId, sessionNumber: 1, title: 'Valid session title',
    scheduledAt: '2026-11-05T17:00:00.000Z', durationMinutes: 60,
  };
  assert.equal((await adminAttendanceSessions(req('POST', { ...base, sessionNumber: 0 }))).status, 400);
  assert.equal((await adminAttendanceSessions(req('POST', { ...base, meetingUrl: 'https://example.com/meet' }))).status, 400);
  assert.equal((await adminAttendanceSessions(req('POST', { ...base, durationMinutes: 500 }))).status, 400);
  assert.equal(calls.some(call => call.uri.includes('attendance_sessions?') && call.init.method === 'POST'), false);
});

test('cohort and participant information is not included in unauthorised responses', async () => {
  configure();
  providers();
  const response = await adminAttendanceSessions(req('POST', {
    cohortId, sessionNumber: 1, title: 'Self-Discovery and Personal Growth',
    scheduledAt: '2026-11-05T17:00:00.000Z', durationMinutes: 60,
  }, 'https://attacker.example'));
  const text = await response.text();
  assert.equal(response.status, 403);
  assert.ok(!text.includes('server-only-key'));
  assert.ok(!text.includes('t'.repeat(32)));
});
