import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { adminMemberRoster, adminSessionResources } from '../netlify/lib/session-portal.ts';

const user = '72f9a302-1391-4e87-a217-77b5e16b5e1d';
const cohort = '9dbeaa23-e643-4e87-b46e-f3785fe9aa2f';
const resource = 'a0bd00db-247c-440d-850e-111111111111';
const keys = ['ADMIN_DASHBOARD_ENABLED','SESSION_PORTAL_ENABLED','SESSION_PRIVACY_APPROVED','MEDIA_UPLOADS_ENABLED','MEDIA_RETENTION_APPROVED','RECORDING_CONSENT_APPROVED','MEMBER_PORTAL_ENABLED','SITE_ORIGIN','SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_PUBLISHABLE_KEY'];
const initial = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

function setup() {
  Object.assign(process.env, {
    ADMIN_DASHBOARD_ENABLED:'true', SESSION_PORTAL_ENABLED:'true', SESSION_PRIVACY_APPROVED:'true', MEDIA_UPLOADS_ENABLED:'true',
    MEDIA_RETENTION_APPROVED:'true', RECORDING_CONSENT_APPROVED:'true', MEMBER_PORTAL_ENABLED:'true',
    SITE_ORIGIN:'https://men-in-hr.netlify.app', SUPABASE_URL:'https://sample.supabase.co',
    SUPABASE_SECRET_KEY:'server-only-key', SUPABASE_PUBLISHABLE_KEY:'public-key',
  });
}
function makeRequest() {
  return new Request('https://men-in-hr.netlify.app/api/admin/session-resources', {
    method:'POST', headers:{Origin:'https://men-in-hr.netlify.app',Authorization:`Bearer ${'t'.repeat(32)}`,'Content-Type':'application/json'},
    body:JSON.stringify({action:'share',resourceId:resource,allParticipants:true}),
  });
}
function participantId(index) { return `00000000-0000-4000-8000-${String(index + 1).padStart(12,'0')}`; }
function mockBackend(total) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const uri = String(url);
    calls.push({uri,init});
    if (uri.endsWith('/auth/v1/user')) return Response.json({id:user});
    if (uri.includes('/rest/v1/admin_members?')) return Response.json([{role:'coordinator'}]);
    if (uri.includes('/rest/v1/session_resources?')) return Response.json([{
      id:resource,cohort_id:cohort,session_id:'0d2bb8f0-5f7a-4d76-b0b8-2f9d8b0a5d9a',participant_id:null,source_resource_id:null,
      kind:'recording',status:'ready',object_path:'recordings/private/session.mp4',file_name:'session.mp4',content_type:'video/mp4',size_bytes:1000,
      content_text:null,created_by:user,recording_notice_attested:true,consent_attested_by:user,consent_attested_at:'2026-01-01T00:00:00Z',
    }]);
    if (uri.includes('/rest/v1/attendance_participants?')) {
      const query = new URL(uri).searchParams;
      const offset = Number(query.get('offset') || 0);
      const limit = Number(query.get('limit') || 0);
      const rows = Array.from({length:Math.max(0,Math.min(limit,total-offset))},(_,index)=>({id:participantId(offset+index)}));
      if ((query.get('select') || '').includes('full_name')) return Response.json(rows.map((row,index)=>({
        ...row,cohort_id:cohort,full_name:`Synthetic Participant ${offset+index+1}`,email:`student${offset+index+1}@example.test`,normalized_email:`student${offset+index+1}@example.test`,
      })));
      return Response.json(rows);
    }
    if (uri.includes('/rest/v1/session_resource_shares?')) return new Response(null,{status:204});
    if (uri.includes('/rest/v1/session_resource_events')) return new Response(null,{status:204});
    throw new Error(`Unexpected request: ${uri}`);
  };
  return calls;
}
function rosterRequest(offset = 0) {
  return new Request(`https://men-in-hr.netlify.app/api/admin/member-roster?cohort=${cohort}&offset=${offset}`, {
    headers:{Authorization:`Bearer ${'t'.repeat(32)}`},
  });
}
afterEach(() => {
  for (const key of keys) {
    if (initial[key] === undefined) delete process.env[key];
    else process.env[key] = initial[key];
  }
  globalThis.fetch = originalFetch;
});

test('whole-cohort sharing includes more than 200 participants and reports actual coverage', async () => {
  setup();
  const calls = mockBackend(250);
  const response = await adminSessionResources(makeRequest());
  const result = await response.json();
  const shares = calls.find(call => call.uri.includes('/rest/v1/session_resource_shares?'));
  assert.equal(response.status,200,JSON.stringify({result,requests:calls.map(call=>call.uri)}));
  assert.equal(result.recipientCount,250);
  assert.equal(JSON.parse(shares.init.body).length,250);
  assert.ok(calls.some(call => call.uri.includes('offset=0')));
  assert.ok(!calls.some(call => call.uri.includes('offset=500')));
});

test('cohorts above 5,000 are rejected before any partial share write', async () => {
  setup();
  const calls = mockBackend(5001);
  const response = await adminSessionResources(makeRequest());
  const result = await response.json();
  assert.equal(response.status,413,JSON.stringify({result,requests:calls.map(call=>call.uri)}));
  assert.match(result.error,/no partial sharing was applied/i);
  assert.equal(calls.some(call => call.uri.includes('/rest/v1/session_resource_shares?')),false);
});

test('coordinator member roster exposes successive 200-person pages without truncating a 250-person cohort', async () => {
  setup();
  mockBackend(250);
  const firstResponse = await adminMemberRoster(rosterRequest());
  const first = await firstResponse.json();
  const nextResponse = await adminMemberRoster(rosterRequest(first.nextOffset));
  const next = await nextResponse.json();
  assert.equal(firstResponse.status,200);
  assert.equal(first.participants.length,200);
  assert.equal(first.nextOffset,200);
  assert.equal(first.hasMore,true);
  assert.equal(nextResponse.status,200);
  assert.equal(next.participants.length,50);
  assert.equal(next.nextOffset,250);
  assert.equal(next.hasMore,false);
  assert.equal(new Set([...first.participants,...next.participants].map(person=>person.id)).size,250);
});
