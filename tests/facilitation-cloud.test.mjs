import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { adminFacilitationSync } from '../netlify/lib/facilitation-cloud-server.ts';

const ownerId='72f9a302-1391-4e87-a217-77b5e16b5e1d';
const originalFetch=globalThis.fetch;
const envKeys=['FACILITATION_CLOUD_SYNC_ENABLED','FACILITATOR_USER_ID','ADMIN_DASHBOARD_ENABLED','SITE_ORIGIN','SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_PUBLISHABLE_KEY'];
const originalEnv=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
afterEach(()=>{globalThis.fetch=originalFetch;for(const k of envKeys){if(originalEnv[k]===undefined)delete process.env[k];else process.env[k]=originalEnv[k];}});
function config(){Object.assign(process.env,{FACILITATION_CLOUD_SYNC_ENABLED:'true', FACILITATOR_USER_ID:ownerId, ADMIN_DASHBOARD_ENABLED:'true',SITE_ORIGIN:'https://men-in-hr.netlify.app',SUPABASE_URL:'https://sample.supabase.co',SUPABASE_SECRET_KEY:'not-for-browser',SUPABASE_PUBLISHABLE_KEY:'public'});}
function request(method='GET', data=null, origin='https://men-in-hr.netlify.app'){
 return new Request('https://men-in-hr.netlify.app/api/admin/facilitation-sync',{method,headers:{Authorization:'Bearer '+'a'.repeat(32),Origin:origin,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});
}
const sampleWorkspace={version:1,sessions:{}};
function backend(role='owner', options={}){
 const calls=[];
 globalThis.fetch=async(url,init={})=>{
  const uri=String(url);calls.push({uri,init});
  if(uri.includes('/auth/v1/user'))return Response.json({id:ownerId});
  if(uri.includes('admin_members?'))return Response.json([{role}]);
  if(uri.includes('facilitation_workspaces?'))return Response.json(options.stored||[]);
  if(uri.includes('rpc/facilitation_save_workspace'))return Response.json(options.saveResult||{status:'saved',revision:1});
  throw new Error('unexpected request '+uri);
 };
 return calls;
}
test('cloud disabled by default and makes no network request',async()=>{
 delete process.env.FACILITATION_CLOUD_SYNC_ENABLED;
 globalThis.fetch=()=>{throw new Error('No provider calls should occur');};
 assert.equal((await adminFacilitationSync(request())).status,503);
});
test('unauthenticated and unapproved callers cannot access workspace',async()=>{
 config();let calls=backend('coordinator');
 assert.equal((await adminFacilitationSync(request())).status,403);
 assert.equal(calls.some(x=>x.uri.includes('facilitation_workspaces')),false);
 process.env.FACILITATOR_USER_ID='00000000-0000-0000-0000-000000000000';
 calls=backend('owner');
 assert.equal((await adminFacilitationSync(request())).status,403);
 assert.equal(calls.some(x=>x.uri.includes('facilitation_workspaces')),false);
});
test('cross-origin upload blocked without accessing backend',async()=>{
 config();globalThis.fetch=()=>{throw new Error('should not reach backend');};
 assert.equal((await adminFacilitationSync(request('PUT',{workspace:sampleWorkspace,expectedRevision:0},'https://attacker.test'))).status,403);
});
test('first manual check returns empty workspace and zero revision',async()=>{
 config();const calls=backend();const response=await adminFacilitationSync(request());
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{workspace:sampleWorkspace,revision:0,updatedAt:null});
 assert.equal(calls.filter(x=>x.uri.includes('facilitation_workspaces')).length,1);
});
test('upload sends only verified owner UUID and normalized workspace to guarded RPC',async()=>{
 config();const calls=backend();const response=await adminFacilitationSync(request('PUT',{workspace:sampleWorkspace,expectedRevision:0}));
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{revision:1,message:'Cloud copy updated manually.'});
 const rpc=calls.find(x=>x.uri.includes('rpc/facilitation_save_workspace'));
 assert.ok(rpc);
 assert.deepEqual(JSON.parse(rpc.init.body),{p_actor:ownerId,p_expected_revision:0,p_workspace:sampleWorkspace});
 assert.equal(rpc.init.headers.apikey,'not-for-browser');
});
test('revision conflict prevents overwriting changed cloud data',async()=>{
 config();backend('owner',{saveResult:{status:'conflict',revision:7}});
 assert.equal((await adminFacilitationSync(request('PUT',{workspace:sampleWorkspace,expectedRevision:1}))).status,409);
});
test('malformed workspace is rejected before any cloud write',async()=>{
 config();const calls=backend();
 const response=await adminFacilitationSync(request('PUT',{workspace:{version:1,sessions:{'week-1':{plan:'PII'}}},expectedRevision:0}));
 assert.equal(response.status,400);
 assert.equal(calls.some(x=>x.uri.includes('rpc/facilitation_save_workspace')),false);
});
