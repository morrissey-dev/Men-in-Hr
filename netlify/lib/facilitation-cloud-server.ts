/** Optional owner-only manual cloud backup. Disabled until a verified Supabase project exists. */
import { json } from './application-server.ts';
import { authorize, serviceFetch } from './admin-server.ts';
import { parseWorkspace, emptyWorkspace } from '../../src/lib/session-management.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (status: number, error: string) => json({ error }, status);
export function cloudGateEnabled(): boolean {
  return process.env.FACILITATION_CLOUD_SYNC_ENABLED === 'true';
}
export function facilitatorMatches(userId: string, role: string): boolean {
  const selected = process.env.FACILITATOR_USER_ID?.trim() || '';
  return role === 'owner' && UUID.test(selected) && selected.toLowerCase() === userId.toLowerCase();
}
export async function adminFacilitationSync(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'PUT') return fail(405, 'Method not allowed.');
  if (!cloudGateEnabled()) return fail(503, 'Cloud backup is not configured. Browser drafts are unchanged.');
  const access = await authorize(request, request.method === 'PUT', true);
  if (access.error) return access.error;
  const { userId, role, settings } = access.admin;
  if (!facilitatorMatches(userId, role)) return fail(403, 'This workspace is private.');
  try {
    if (request.method === 'GET') {
      const result = await serviceFetch(settings, `facilitation_workspaces?user_id=eq.${userId}&select=workspace,revision,updated_at&limit=1`);
      if (!result.ok) return fail(503, 'Cloud backup temporarily unavailable.');
      const entries = await result.json() as Array<{ workspace: unknown; revision: number; updated_at: string }>;
      if (!entries.length) return json({workspace:emptyWorkspace(),revision:0,updatedAt:null});
      const data = entries[0];
      if (!Number.isSafeInteger(data.revision) || data.revision < 1) return fail(503, 'Invalid cloud revision.');
      const workspace = parseWorkspace(JSON.stringify(data.workspace));
      return json({workspace,revision:data.revision,updatedAt:data.updated_at});
    }
    if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return fail(415,'JSON required.');
    if (Number(request.headers.get('content-length') || '0') > 450000) return fail(413,'Backup too large.');
    const bodyText = await request.text();
    if (bodyText.length > 450000) return fail(413,'Backup too large.');
    const body = JSON.parse(bodyText) as {workspace?:unknown;expectedRevision?:unknown};
    const revision = body?.expectedRevision;
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0) return fail(400,'Invalid cloud revision.');
    const workspace = parseWorkspace(JSON.stringify(body?.workspace));
    const res = await serviceFetch(settings,'rpc/facilitation_save_workspace',{
      method:'POST',body:JSON.stringify({p_actor:userId,p_expected_revision:revision,p_workspace:workspace}),
    });
    if (!res.ok) return fail(503,'Unable to save cloud backup.');
    const result = await res.json() as {status?:string;revision?:number};
    if (result.status === 'conflict') return fail(409,'Cloud copy has changed. Check it before trying again.');
    if (result.status !== 'saved' || !Number.isSafeInteger(result.revision) || (result.revision || 0) <= revision) return fail(503,'Unable to confirm cloud backup.');
    return json({revision:result.revision,message:'Cloud copy updated manually.'});
  } catch {
    return fail(400,'Invalid backup or unavailable service. Your local draft has not been changed.');
  }
}
