import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { memberResources } from '../netlify/lib/session-portal.ts';

const userId = '72f9a302-1391-4e87-a217-77b5e16b5e1d';
const participantId = 'b26f9851-f1e6-4f6d-a8ce-cd5279bd9c90';
const cohortId = '9dbeaa23-e643-4e87-b46e-f3785fe9aa2f';
const envKeys = ['SESSION_PORTAL_ENABLED','SESSION_PRIVACY_APPROVED','MEDIA_RETENTION_APPROVED','MEMBER_PORTAL_ENABLED','SITE_ORIGIN','SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_PUBLISHABLE_KEY'];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

function setup(total) {
  Object.assign(process.env, {
    SESSION_PORTAL_ENABLED:'true', SESSION_PRIVACY_APPROVED:'true', MEDIA_RETENTION_APPROVED:'true',
    MEMBER_PORTAL_ENABLED:'true', SITE_ORIGIN:'https://men-in-hr.netlify.app',
    SUPABASE_URL:'https://sample.supabase.co', SUPABASE_SECRET_KEY:'test-only-service-key',
    SUPABASE_PUBLISHABLE_KEY:'test-only-publishable-key',
  });
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const uri = String(url);
    calls.push({uri,init});
    if (uri.endsWith('/auth/v1/user')) return Response.json({id:userId,email:'member@example.test',email_confirmed_at:'2026-01-01T00:00:00Z'});
    if (uri.includes('/rest/v1/participant_member_accounts?')) return Response.json([{participant_id:participantId}]);
    if (uri.includes('/rest/v1/attendance_participants?')) return Response.json([{
      id:participantId,cohort_id:cohortId,full_name:'Synthetic Member',normalized_email:'member@example.test',
    }]);
    if (uri.includes('/rest/v1/rpc/member_list_session_resources')) {
      const payload = JSON.parse(init.body);
      const rows = Array.from({length:Math.max(0,Math.min(payload.p_limit,total-payload.p_offset))},(_,index)=>{
        const number = payload.p_offset + index + 1;
        return {
          id:`00000000-0000-4000-8000-${String(number).padStart(12,'0')}`,
          session_id:null,participant_id:null,kind:'summary',status:'approved',
          file_name:null,content_type:null,size_bytes:null,content_text:`Synthetic summary ${number}`,
          created_at:new Date(Date.UTC(2026,0,1,0,0,0, -number)).toISOString(),
        };
      });
      return Response.json(rows);
    }
    throw new Error(`Unexpected mocked request: ${uri}`);
  };
  return calls;
}
function request(offset = 0) {
  return new Request(`https://men-in-hr.netlify.app/.netlify/functions/member-resources${offset ? `?offset=${offset}` : ''}`, {
    headers:{Authorization:`Bearer ${'t'.repeat(32)}`},
  });
}
afterEach(() => {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  globalThis.fetch = originalFetch;
});

test('verified member can page through more than 200 shared and assigned resources without omission', async () => {
  const calls = setup(450);
  const pages = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const response = await memberResources(request(offset));
    const result = await response.json();
    assert.equal(response.status,200,JSON.stringify(result));
    assert.equal('objectPath' in result,false);
    pages.push(...result.resources);
    offset = result.nextOffset;
    hasMore = result.hasMore;
  }
  assert.deepEqual(pages.map(item=>item.id),Array.from({length:450},(_,index)=>`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`));
  assert.equal(new Set(pages.map(item=>item.id)).size,450);
  assert.equal(calls.filter(call=>call.uri.includes('/rpc/member_list_session_resources')).length,3);
});

test('member API signals its 5,000-item limit instead of silently hiding a remaining page', async () => {
  const calls = setup(5201);
  const response = await memberResources(request(4800));
  const result = await response.json();
  assert.equal(response.status,200);
  assert.equal(result.resources.length,200);
  assert.equal(result.nextOffset,5000);
  assert.equal(result.hasMore,false);
  assert.equal(result.limitReached,true);
  assert.equal(JSON.parse(calls.find(call=>call.uri.includes('/rpc/member_list_session_resources')).init.body).p_offset,4800);
});

test('member resource pagination rejects malformed or unaligned offsets before listing resources', async () => {
  const calls = setup(250);
  const malformed = await memberResources(request(17));
  const beyondCap = await memberResources(request(5000));
  assert.equal(malformed.status,400);
  assert.equal(beyondCap.status,400);
  assert.equal(calls.some(call=>call.uri.includes('/rpc/member_list_session_resources')),false);
});
