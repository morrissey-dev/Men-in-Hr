import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adminAttendanceImports } from '../netlify/lib/attendance-imports.ts';
import {
  adminInviteMember,
  adminSessionResources,
  memberResources,
  memberSession,
} from '../netlify/lib/session-portal.ts';
import { adminAIJobs, adminAIProcess } from '../netlify/lib/session-ai.ts';

const gateNames = [
  'SESSION_PORTAL_ENABLED', 'SESSION_PRIVACY_APPROVED', 'ATTENDANCE_IMPORTS_ENABLED',
  'ATTENDANCE_RETENTION_APPROVED', 'MEDIA_UPLOADS_ENABLED', 'MEDIA_RETENTION_APPROVED',
  'RECORDING_CONSENT_APPROVED', 'CERTIFICATES_ENABLED', 'MEMBER_PORTAL_ENABLED',
  'MEMBER_INVITES_ENABLED', 'AI_PROCESSING_ENABLED', 'AI_DATA_PROCESSING_APPROVED',
  'AI_API_KEY', 'AI_TRANSCRIPTION_ENDPOINT', 'AI_TRANSCRIPTION_MODEL',
  'AI_CHAT_COMPLETIONS_ENDPOINT', 'AI_CHAT_MODEL',
];

function withGates(values, action) {
  const original = Object.fromEntries(gateNames.map(name => [name, process.env[name]]));
  for (const name of gateNames) delete process.env[name];
  Object.assign(process.env, values);
  return Promise.resolve().then(action).finally(() => {
    for (const name of gateNames) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  });
}

const request = (path, method = 'GET', body) => new Request(`https://menhr.test/api/${path}`, {
  method,
  headers: body === undefined ? {} : { 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

test('all new session, attendance, recording, member and AI features fail closed without making provider requests', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('network must stay unused'); };
  try {
    await withGates({}, async () => {
      const responses = await Promise.all([
        adminAttendanceImports(request('admin/attendance/imports')),
        adminSessionResources(request('admin/session-resources')),
        adminInviteMember(request('admin/member-invite', 'POST', { participantId: '00000000-0000-4000-8000-000000000000' })),
        memberSession(request('member/session')),
        memberResources(request('member/resources')),
        adminAIJobs(request('admin/session-ai-jobs', 'POST', { resourceId: '00000000-0000-4000-8000-000000000000' })),
        adminAIProcess(request('admin/session-ai-process', 'POST', { jobId: '00000000-0000-4000-8000-000000000000' })),
      ]);
      for (const response of responses) assert.equal(response.status, 503);
      assert.equal(calls, 0);
    });

    await withGates({
      SESSION_PORTAL_ENABLED: 'true',
      SESSION_PRIVACY_APPROVED: 'false',
      ATTENDANCE_IMPORTS_ENABLED: 'true',
      ATTENDANCE_RETENTION_APPROVED: 'true',
      MEMBER_PORTAL_ENABLED: 'true',
      MEDIA_RETENTION_APPROVED: 'true',
    }, async () => {
      const attendance = await adminAttendanceImports(request('admin/attendance/imports'));
      const member = await memberSession(request('member/session'));
      assert.equal(attendance.status, 503);
      assert.equal(member.status, 503);
      assert.equal(calls, 0);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
