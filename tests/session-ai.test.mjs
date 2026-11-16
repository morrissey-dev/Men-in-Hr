import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { adminAIProcess } from '../netlify/lib/session-ai.ts';

const user = '72f9a302-1391-4e87-a217-77b5e16b5e1d';
const jobId = '15c1fdf5-18be-4122-80e6-cb70b981a860';
const recordingId = '5b3d916a-112c-4b61-b375-ab2042b97066';
const keys = [
  'ADMIN_DASHBOARD_ENABLED','SESSION_PORTAL_ENABLED','SESSION_PRIVACY_APPROVED','MEDIA_UPLOADS_ENABLED',
  'MEDIA_RETENTION_APPROVED','RECORDING_CONSENT_APPROVED','AI_PROCESSING_ENABLED','AI_DATA_PROCESSING_APPROVED',
  'AI_API_KEY','AI_TRANSCRIPTION_ENDPOINT','AI_TRANSCRIPTION_MODEL','AI_CHAT_COMPLETIONS_ENDPOINT','AI_CHAT_MODEL',
  'SITE_ORIGIN','SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_PUBLISHABLE_KEY','AI_MAX_MEDIA_BYTES',
];
const initial = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

function setup() {
  Object.assign(process.env, {
    ADMIN_DASHBOARD_ENABLED:'true', SESSION_PORTAL_ENABLED:'true', SESSION_PRIVACY_APPROVED:'true',
    MEDIA_UPLOADS_ENABLED:'true', MEDIA_RETENTION_APPROVED:'true', RECORDING_CONSENT_APPROVED:'true',
    AI_PROCESSING_ENABLED:'true', AI_DATA_PROCESSING_APPROVED:'true', AI_API_KEY:'test-only-provider-key',
    AI_TRANSCRIPTION_ENDPOINT:'https://provider.test/v1/audio/transcriptions', AI_TRANSCRIPTION_MODEL:'test-transcribe',
    AI_CHAT_COMPLETIONS_ENDPOINT:'https://provider.test/v1/chat/completions', AI_CHAT_MODEL:'test-summary',
    SITE_ORIGIN:'https://men-in-hr.netlify.app', SUPABASE_URL:'https://sample.supabase.co',
    SUPABASE_SECRET_KEY:'test-only-server-key', SUPABASE_PUBLISHABLE_KEY:'test-only-public-key', AI_MAX_MEDIA_BYTES:'104857600',
  });
}
function request() {
  return new Request('https://men-in-hr.netlify.app/.netlify/functions-background/admin-session-ai-process', {
    method:'POST', headers:{Origin:'https://men-in-hr.netlify.app',Authorization:`Bearer ${'t'.repeat(32)}`,'Content-Type':'application/json'},
    body:JSON.stringify({jobId}),
  });
}
function mockServices() {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const uri = String(url);
    calls.push({uri,init});
    if (uri.endsWith('/auth/v1/user')) return Response.json({id:user});
    if (uri.includes('/rest/v1/admin_members?')) return Response.json([{role:'coordinator'}]);
    if (uri.includes('/rest/v1/session_ai_jobs?') && init.method !== 'PATCH') {
      return Response.json([{id:jobId,source_resource_id:recordingId,status:'queued'}]);
    }
    if (uri.includes('/rest/v1/session_ai_jobs?') && init.method === 'PATCH') return Response.json([{id:jobId}]);
    if (uri.includes('/rest/v1/session_resources?')) return Response.json([{
      id:recordingId,cohort_id:'9dbeaa23-e643-4e87-b46e-f3785fe9aa2f',session_id:'0d2bb8f0-5f7a-4d76-b0b8-2f9d8b0a5d9a',
      participant_id:null,source_resource_id:null,kind:'recording',status:'ready',object_path:'recordings/cohort/random.mp4',
      file_name:'meet-session.mp4',content_type:'video/mp4',size_bytes:3,content_text:null,created_by:user,
      recording_notice_attested:true,consent_attested_by:user,consent_attested_at:'2026-01-01T00:00:00Z',
    }]);
    if (uri.includes('/storage/v1/object/menhr-private/recordings/')) {
      return new Response(new Blob([new Uint8Array([1,2,3])],{type:'video/mp4'}),{status:200,headers:{'content-type':'video/mp4'}});
    }
    if (uri === 'https://provider.test/v1/audio/transcriptions') {
      assert.equal(init.headers.Authorization,'Bearer test-only-provider-key');
      assert.ok(init.body instanceof FormData);
      assert.equal(init.body.get('model'),'test-transcribe');
      assert.equal(init.body.get('file').size,3);
      return Response.json({text:'The mentors will share an HR career map with the cohort.'});
    }
    if (uri === 'https://provider.test/v1/chat/completions') {
      assert.equal(init.headers.Authorization,'Bearer test-only-provider-key');
      const body = JSON.parse(init.body);
      assert.equal(body.model,'test-summary');
      assert.match(body.messages[0].content,/untrusted meeting text/i);
      assert.equal(body.messages[1].content,'The mentors will share an HR career map with the cohort.');
      return Response.json({choices:[{message:{content:JSON.stringify({
        summary:'Mentors will share an HR career map with the cohort.',
        actionItems:[{task:'Share an HR career map',owner:'Not specified',deadline:'Not specified'}],
      })}}]});
    }
    if (uri.includes('/rest/v1/rpc/admin_complete_session_ai_job')) return Response.json(true);
    throw new Error(`Unexpected mocked request: ${uri}`);
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

test('coordinator AI processing uses mocked private media and providers, and persists only reviewed-state drafts', async () => {
  setup();
  const calls = mockServices();
  const response = await adminAIProcess(request());
  const result = await response.json();
  const completion = calls.find(call => call.uri.includes('/rest/v1/rpc/admin_complete_session_ai_job'));
  const saved = JSON.parse(completion.init.body);
  assert.equal(response.status,200,JSON.stringify({result,requests:calls.map(call=>call.uri)}));
  assert.match(result.message,/draft.*review/i);
  assert.equal(saved.p_actor,user);
  assert.equal(saved.p_job_id,jobId);
  assert.equal(saved.p_transcript,'The mentors will share an HR career map with the cohort.');
  assert.equal(saved.p_summary,'Mentors will share an HR career map with the cohort.');
  assert.deepEqual(JSON.parse(saved.p_action_items),[{task:'Share an HR career map',owner:'Not specified',deadline:'Not specified'}]);
  assert.equal(JSON.stringify(result).includes('test-only-provider-key'),false);
  assert.ok(calls.some(call => call.uri.includes('/storage/v1/object/menhr-private/')));
});
