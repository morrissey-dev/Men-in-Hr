import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { adminSession, adminApplications, adminCohorts } from '../netlify/lib/admin-server.ts';

const uid = '72f9a302-1391-4e87-a217-77b5e16b5e1d';
const cohortId = '9dbeaa23-e643-4e87-b46e-f3785fe9aa2f';
const applicationId = '25e9ae25-d7dc-4d59-9c35-e28529cc5d0d';
const allKeys = ['ADMIN_DASHBOARD_ENABLED','SITE_ORIGIN','SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_PUBLISHABLE_KEY', 'APPLICATIONS_OPEN','PRIVACY_APPROVED','RETENTION_PROCESS_ACTIVE','TURNSTILE_SITE_KEY','TURNSTILE_SECRET_KEY','PRIVACY_CONTROLLER_NAME','PRIVACY_CONTACT_EMAIL','APPLICATION_RETENTION_DAYS','APPLICATION_COHORT_SLUG','FACILITATOR_USER_ID'];
const initial = Object.fromEntries(allKeys.map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
function configure() {
  Object.assign(process.env, {
    ADMIN_DASHBOARD_ENABLED:'true', SITE_ORIGIN:'https://men-in-hr.netlify.app',
    SUPABASE_URL:'https://sample.supabase.co', SUPABASE_SECRET_KEY:'server-only-key', SUPABASE_PUBLISHABLE_KEY:'public-key',
    APPLICATIONS_OPEN:'false', PRIVACY_APPROVED:'false', RETENTION_PROCESS_ACTIVE:'false',
    APPLICATION_COHORT_SLUG:'cohort-1',
  });
}
function req(endpoint, method='GET', body=null, origin='https://men-in-hr.netlify.app', token='t'.repeat(32)) {
  return new Request(`https://men-in-hr.netlify.app/api/admin/${endpoint}`, {
    method, headers: { Authorization: `Bearer ${token}`, Origin:origin, ...(body ? { 'Content-Type':'application/json' } : {}) },
    ...(body ? {body:JSON.stringify(body)} : {}),
  });
}
function providers({ authenticated=true, role='owner', cohortOpen=false, rpcResult=true }={}) {
  const calls=[];
  globalThis.fetch = async (url, init={}) => {
    const uri=String(url);
    calls.push({uri, init});
    if (uri.endsWith('/auth/v1/user')) return authenticated ? Response.json({ id:uid }) : Response.json({ message:'Invalid JWT' }, {status:401});
    if (uri.includes('admin_members?')) return Response.json(role ? [{role}] : []);
    if (uri.includes('applications?')) return Response.json([{ id:applicationId, full_name:'Private Name' }]);
    if (uri.includes('cohorts?id=')) return Response.json([{slug:'cohort-1', applications_open:cohortOpen}]);
    if (uri.includes('cohorts?')) return Response.json([{id:cohortId,slug:'cohort-1',name:'Cohort 1', applications_open:cohortOpen}]);
    if (uri.includes('rpc/admin_')) return Response.json(uri.includes('admin_create_cohort') ? cohortId : rpcResult);
    throw new Error(`Unexpected backend: ${uri}`);
  };
  return calls;
}
afterEach(()=>{
  for (const key of allKeys) { if (initial[key] === undefined) delete process.env[key]; else process.env[key]=initial[key]; }
  globalThis.fetch = originalFetch;
});

test('admin dashboard disabled by default (fail closed, no provider access)', async()=>{
  delete process.env.ADMIN_DASHBOARD_ENABLED;
  globalThis.fetch=()=>{throw new Error('Should never call provider');};
  assert.equal((await adminSession(req('session'))).status,503);
});

test('request without access token is denied before provider call', async()=>{
  configure(); globalThis.fetch=()=>{throw new Error('Should never call provider');};
  const response=await adminSession(new Request('https://men-in-hr.netlify.app/api/admin/session'));
  assert.equal(response.status,401);
});

test('forged JWT fails Supabase Auth check and does not read database', async()=>{
  configure(); const calls=providers({authenticated:false});
  assert.equal((await adminApplications(req('applications'))).status,401);
  assert.equal(calls.length,1);
  assert.ok(calls[0].uri.endsWith('/auth/v1/user'));
});

test('existing Supabase user without approved active role is rejected', async()=>{
  configure(); const calls=providers({role:null});
  assert.equal((await adminSession(req('session'))).status,403);
  assert.equal(calls.length,2);
});

test('role is determined by server membership and exposed minimally', async()=>{
  configure(); providers({role:'coordinator',canFacilitate:false});
  assert.deepEqual(await (await adminSession(req('session'))).json(), {role:'coordinator',canFacilitate:false});
});

test('coordinator cannot create or toggle cohorts', async()=>{
  configure(); const calls=providers({role:'coordinator',canFacilitate:false});
  assert.equal((await adminCohorts(req('cohorts','POST',{slug:'cohort-2',name:'Cohort Two'}))).status,403);
  assert.equal((await adminCohorts(req('cohorts','PATCH',{cohortId,applicationsOpen:false}))).status,403);
  assert.equal(calls.filter(c=>c.uri.includes('/rpc/')).length,0);
});

test('blocks cross-origin mutations before reading tokens or database', async()=>{
  configure(); globalThis.fetch=()=>{throw new Error('No network on forbidden origin');};
  const response=await adminApplications(req('applications','PATCH',{applicationId,status:'approved'},'https://attacker.example'));
  assert.equal(response.status,403);
});

test('server rejects arbitrary application ids and statuses', async()=>{
  configure(); const calls=providers();
  assert.equal((await adminApplications(req('applications','PATCH',{applicationId:'other',status:'approved'}))).status,400);
  assert.equal((await adminApplications(req('applications','PATCH',{applicationId,status:'admin'}))).status,400);
  assert.equal(calls.filter(c=>c.uri.includes('/rpc/')).length,0);
});

test('applications are paginated and only selected private fields returned', async()=>{
  configure(); const calls=providers();
  const response=await adminApplications(req(`applications?cohort=${cohortId}&status=pending&page=2`));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.page,2);
  assert.equal(body.applications.length,1);
  const path=calls.find(c=>c.uri.includes('applications?')).uri;
  assert.ok(path.includes('offset=50') && path.includes('limit=26') && path.includes('status=eq.pending'));
});

test('pagination filters cannot inject PostgREST operators', async()=>{
  configure(); const calls=providers();
  assert.equal((await adminApplications(req('applications?status=pending%2Cemail.eq.any'))).status,400);
  assert.equal((await adminApplications(req('applications?page=999999'))).status,400);
  assert.equal(calls.some(c=>c.uri.includes('applications?')),false);
});

test('approved application change calls audited atomic SQL function', async()=>{
  configure(); const calls=providers();
  const response=await adminApplications(req('applications','PATCH',{applicationId,status:'approved'}));
  assert.equal(response.status,200);
  const audit=calls.find(c=>c.uri.endsWith('rpc/admin_set_application_status'));
  assert.ok(audit);
  assert.deepEqual(JSON.parse(audit.init.body), {p_actor:uid,p_application_id:applicationId,p_new_status:'approved'});
  assert.equal(audit.init.headers.apikey,'server-only-key');
});

test('unsuccessful application decision RPC is not reported as saved', async()=>{
  configure(); providers({rpcResult:false});
  assert.equal((await adminApplications(req('applications','PATCH',{applicationId,status:'approved'}))).status,409);
});

test('owner creates a draft cohort, not open registration', async()=>{
  configure(); const calls=providers();
  const response=await adminCohorts(req('cohorts','POST',{slug:'cohort-2',name:'Men in HR Cohort 2'}));
  assert.equal(response.status,201);
  assert.ok(calls.some(c=>c.uri.endsWith('rpc/admin_create_cohort')));
  assert.ok(!calls.some(c=>c.uri.endsWith('rpc/admin_set_cohort_open')));
});

test('owner can close cohort even without privacy approvals', async()=>{
  configure(); const calls=providers({cohortOpen:true});
  const response=await adminCohorts(req('cohorts','PATCH',{cohortId,applicationsOpen:false}));
  assert.equal(response.status,200);
  assert.ok(calls.some(c=>c.uri.endsWith('rpc/admin_set_cohort_open')));
});

test('owner cannot open cohort while privacy and registration gates are off', async()=>{
  configure(); const calls=providers();
  assert.equal((await adminCohorts(req('cohorts','PATCH',{cohortId,applicationsOpen:true}))).status,409);
  assert.ok(!calls.some(c=>c.uri.endsWith('rpc/admin_set_cohort_open')));
});

test('owner can open configured cohort when all safeguards are approved', async()=>{
  configure(); Object.assign(process.env,{
    APPLICATIONS_OPEN:'true',PRIVACY_APPROVED:'true',RETENTION_PROCESS_ACTIVE:'true',
    TURNSTILE_SITE_KEY:'site',TURNSTILE_SECRET_KEY:'secret',PRIVACY_CONTROLLER_NAME:'Approved Operator',
    PRIVACY_CONTACT_EMAIL:'privacy@example.org',APPLICATION_RETENTION_DAYS:'180',
  });
  const calls=providers();
  assert.equal((await adminCohorts(req('cohorts','PATCH',{cohortId,applicationsOpen:true}))).status,200);
  assert.ok(calls.some(c=>c.uri.endsWith('rpc/admin_set_cohort_open')));
});

test('sensitive settings and user tokens are never copied into success responses', async()=>{
  configure(); providers();
  const text=await (await adminSession(req('session'))).text();
  assert.ok(!text.includes('server-only-key') && !text.includes('t'.repeat(32)));
});


test('facilitation tab entitlement is disabled without explicit user allowlist', async()=>{
  configure(); delete process.env.FACILITATOR_USER_ID; providers({role:'owner'});
  assert.deepEqual(await (await adminSession(req('session'))).json(), {role:'owner',canFacilitate:false});
});

test('only the matching approved owner can access personal facilitation desk', async()=>{
  configure(); process.env.FACILITATOR_USER_ID=uid; providers({role:'owner'});
  assert.deepEqual(await (await adminSession(req('session'))).json(), {role:'owner',canFacilitate:true});
  providers({role:'coordinator'});
  assert.deepEqual(await (await adminSession(req('session'))).json(), {role:'coordinator',canFacilitate:false});
  process.env.FACILITATOR_USER_ID='fc61a6d0-491b-498b-9abb-48bbf4fc3146';
  providers({role:'owner'});
  assert.deepEqual(await (await adminSession(req('session'))).json(), {role:'owner',canFacilitate:false});
});
