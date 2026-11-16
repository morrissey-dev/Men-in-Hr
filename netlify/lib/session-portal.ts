import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { json } from './application-server.ts';
import { authorize, serviceFetch } from './admin-server.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = 'menhr-private';
const AUDIO_TYPES = new Set(['audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/webm']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);
const CERTIFICATE_TYPE = 'application/pdf';
const MAX_RECORDING_BYTES = 500 * 1024 * 1024;
const MAX_CERTIFICATE_BYTES = 10 * 1024 * 1024;
const MAX_COHORT_PARTICIPANTS = 5000;
const COHORT_PAGE_SIZE = 500;
const MEMBER_RESOURCE_PAGE_SIZE = 200;
const MAX_MEMBER_RESOURCE_OFFSET = 5000;
const DOWNLOAD_SECONDS = 300;
const PORTAL_FLAG = 'SESSION_PORTAL_ENABLED';

type Resource = {
  id: string; cohort_id: string; session_id: string | null; participant_id: string | null;
  kind: string; status: string; object_path: string | null; file_name: string | null;
  content_type: string | null; size_bytes: number | null; content_text: string | null;
  source_resource_id: string | null; created_by: string;
  recording_notice_attested: boolean; consent_attested_by: string | null; consent_attested_at: string | null;
};
type PortalSettings = { origin: string; url: string; secret: string; publishable: string };
type Member = { settings: PortalSettings; userId: string; participantId: string; cohortId: string; fullName: string };

type Body = Record<string, unknown>;
function fail(status: number, error: string): Response { return json({ error }, status); }
function isRecord(value: unknown): value is Body { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function service(s: PortalSettings): SupabaseClient {
  return createClient(s.url, s.secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
function portalReady(): boolean { return process.env[PORTAL_FLAG] === 'true'; }
function mediaReady(): boolean {
  return portalReady() && process.env.SESSION_PRIVACY_APPROVED === 'true'
    && process.env.MEDIA_UPLOADS_ENABLED === 'true' && process.env.MEDIA_RETENTION_APPROVED === 'true';
}
function memberReady(): boolean { return portalReady() && process.env.SESSION_PRIVACY_APPROVED === 'true'
  && process.env.MEDIA_RETENTION_APPROVED === 'true' && process.env.MEMBER_PORTAL_ENABLED === 'true'; }
function consentReady(): boolean { return mediaReady() && process.env.RECORDING_CONSENT_APPROVED === 'true'; }
async function readBody(request: Request, maxBytes = 8192): Promise<Body | null> {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return null;
  const length = Number(request.headers.get('content-length') || '0');
  if (length > maxBytes) return null;
  const raw = await request.text();
  if (raw.length > maxBytes) return null;
  try { const value: unknown = JSON.parse(raw); return isRecord(value) ? value : null; } catch { return null; }
}

function portalSettings(): PortalSettings | null {
  if (!portalReady()) return null;
  const origin = process.env.SITE_ORIGIN?.trim() || '';
  const url = process.env.SUPABASE_URL?.trim() || '';
  const secret = process.env.SUPABASE_SECRET_KEY?.trim() || '';
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || '';
  try {
    if (!origin || !url || !secret || !publishable) return null;
    const site = new URL(origin); const db = new URL(url);
    if ((site.protocol !== 'https:' && site.hostname !== 'localhost') || site.origin !== origin.replace(/\/$/, '')) return null;
    if (db.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/i.test(db.hostname)) return null;
    return { origin, url: url.replace(/\/$/, ''), secret, publishable };
  } catch { return null; }
}

function directStorageHost(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const ref = /^([a-z0-9-]+)\.supabase\.co$/i.exec(host)?.[1];
    return ref ? `https://${ref}.storage.supabase.co` : null;
  } catch { return null; }
}

async function admin(request: Request, mutate = false) {
  if (!portalReady()) return { error: fail(503, 'Session services are not enabled.') } as const;
  const checked = await authorize(request, mutate);
  if (checked.error) return { error: checked.error } as const;
  return { access: checked.admin, settings: checked.admin.settings as PortalSettings } as const;
}

async function audit(s: PortalSettings, actor: string, action: string, resourceId: string | null, participantId: string | null = null) {
  const response = await serviceFetch(s, 'session_resource_events', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ resource_id: resourceId, actor_id: actor, participant_id: participantId, action }),
  });
  if (!response.ok) throw new Error('audit_unavailable');
}

function safeFileName(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length < 1 || raw.length > 160) return null;
  const cleaned = raw.normalize('NFKC').replace(/[\\/\u0000-\u001f\u007f]/g, '').trim();
  return cleaned.length > 0 && cleaned !== '.' && cleaned !== '..' ? cleaned : null;
}

function validFile(kind: unknown, type: unknown, size: unknown): { kind: 'recording' | 'certificate'; contentType: string; size: number; extension: string } | null {
  if (kind !== 'recording' && kind !== 'certificate') return null;
  if (typeof type !== 'string' || typeof size !== 'number' || !Number.isSafeInteger(size) || size <= 0) return null;
  if (kind === 'certificate') {
    if (type !== CERTIFICATE_TYPE || size > MAX_CERTIFICATE_BYTES) return null;
    return { kind, contentType: type, size, extension: 'pdf' };
  }
  if ((!AUDIO_TYPES.has(type) && !VIDEO_TYPES.has(type)) || size > MAX_RECORDING_BYTES) return null;
  const extension = type === 'audio/mpeg' ? 'mp3' : type === 'audio/wav' ? 'wav' : type === 'audio/webm' || type === 'video/webm' ? 'webm' : 'mp4';
  return { kind, contentType: type, size, extension };
}

async function resourceById(s: PortalSettings, id: string): Promise<Resource | null> {
  const response = await serviceFetch(s, `session_resources?id=eq.${id}&select=id,cohort_id,session_id,participant_id,kind,status,object_path,file_name,content_type,size_bytes,content_text,source_resource_id,created_by,recording_notice_attested,consent_attested_by,consent_attested_at&limit=1`);
  if (!response.ok) return null;
  return (await response.json() as Resource[])[0] || null;
}

async function allActiveParticipantIds(s: PortalSettings, cohortId: string): Promise<{ ids: string[] } | { error: 'unavailable' | 'too_many' }> {
  const ids: string[] = [];
  for (let offset = 0; offset <= MAX_COHORT_PARTICIPANTS; offset += COHORT_PAGE_SIZE) {
    const limit = Math.min(COHORT_PAGE_SIZE, MAX_COHORT_PARTICIPANTS + 1 - offset);
    const response = await serviceFetch(s, `attendance_participants?cohort_id=eq.${cohortId}&active=eq.true&select=id&order=id.asc&limit=${limit}&offset=${offset}`);
    if (!response.ok) return { error: 'unavailable' };
    const page = await response.json() as { id: string }[];
    ids.push(...page.map(row => row.id));
    if (ids.length > MAX_COHORT_PARTICIPANTS) return { error: 'too_many' };
    if (page.length < limit) return { ids };
  }
  return { error: 'too_many' };
}

export async function adminSessionResources(request: Request): Promise<Response> {
  const method = request.method;
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) return fail(405, 'Method not allowed.');
  const checked = await admin(request, method !== 'GET');
  if ('error' in checked) return checked.error;
  const { access, settings: s } = checked;
  const db = service(s);

  try {
    if (method === 'GET') {
      const query = new URL(request.url).searchParams;
      const downloadId = query.get('download') || '';
      if (downloadId) {
        if (!UUID.test(downloadId)) return fail(400, 'Invalid resource.');
        const item = await resourceById(s, downloadId);
        if (!item || !item.object_path || !['ready', 'approved'].includes(item.status)) return fail(404, 'Resource not found.');
        const signed = await db.storage.from(BUCKET).createSignedUrl(item.object_path, DOWNLOAD_SECONDS, { download: item.file_name || true });
        if (signed.error || !signed.data?.signedUrl) return fail(503, 'Download is temporarily unavailable.');
        await audit(s, access.userId, 'download_authorized', item.id, item.participant_id);
        return json({ url: signed.data.signedUrl, expiresIn: DOWNLOAD_SECONDS, fileName: item.file_name });
      }
      const cohortId = query.get('cohort') || '';
      const sessionId = query.get('session') || '';
      if ((cohortId && !UUID.test(cohortId)) || (sessionId && !UUID.test(sessionId))) return fail(400, 'Invalid filter.');
      const filters = ['select=id,cohort_id,session_id,participant_id,source_resource_id,kind,status,file_name,content_type,size_bytes,content_text,created_by,created_at,reviewed_by,reviewed_at', 'order=created_at.desc', 'limit=100'];
      if (cohortId) filters.push(`cohort_id=eq.${cohortId}`);
      if (sessionId) filters.push(`session_id=eq.${sessionId}`);
      const response = await serviceFetch(s, `session_resources?${filters.join('&')}`);
      if (response.status === 404) return fail(503, 'Session resource schema is not installed.');
      if (!response.ok) return fail(503, 'Unable to load session resources.');
      const resources = await response.json() as Omit<Resource, 'object_path'>[];
      const jobs = await serviceFetch(s, 'session_ai_jobs?select=id,source_resource_id,status,error_code,created_at,completed_at&order=created_at.desc&limit=100');
      const jobRows = jobs.ok ? await jobs.json() as Record<string, unknown>[] : [];
      return json({ resources, jobs: jobRows });
    }

    const body = await readBody(request);
    if (!body || typeof body.action !== 'string') return fail(400, 'Invalid request.');

    if (body.action === 'sign-upload') {
      if (!mediaReady()) return fail(503, 'Private media uploads are not configured and approved.');
      const file = validFile(body.kind, body.contentType, body.size);
      const fileName = safeFileName(body.fileName);
      const cohortId = body.cohortId;
      const sessionId = body.sessionId;
      const participantId = body.participantId;
      if (!file || !fileName || typeof cohortId !== 'string' || !UUID.test(cohortId)) return fail(400, 'Invalid file or cohort.');
      if (file.kind === 'recording') {
        if (!consentReady() || body.recordingNoticeAttested !== true || typeof sessionId !== 'string' || !UUID.test(sessionId)) return fail(403, 'Recording upload requires approved notice and coordinator consent attestation.');
        const sessionResponse = await serviceFetch(s, `attendance_sessions?id=eq.${sessionId}&cohort_id=eq.${cohortId}&select=id&limit=1`);
        if (!sessionResponse.ok || !(await sessionResponse.json() as unknown[]).length) return fail(404, 'Session not found.');
      } else {
        if (process.env.CERTIFICATES_ENABLED !== 'true' || typeof participantId !== 'string' || !UUID.test(participantId)) return fail(503, 'Certificate uploads are not enabled.');
        const memberResponse = await serviceFetch(s, `attendance_participants?id=eq.${participantId}&cohort_id=eq.${cohortId}&active=eq.true&select=id&limit=1`);
        if (!memberResponse.ok || !(await memberResponse.json() as unknown[]).length) return fail(404, 'Participant not found.');
      }
      const objectPath = `${file.kind === 'recording' ? 'recordings' : 'certificates'}/${cohortId}/${crypto.randomUUID()}.${file.extension}`;
      const inserted = await serviceFetch(s, 'session_resources?select=id', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          cohort_id: cohortId, session_id: file.kind === 'recording' ? sessionId : null,
          participant_id: file.kind === 'certificate' ? participantId : null,
          kind: file.kind, status: 'uploading', object_path: objectPath, file_name: fileName,
          content_type: file.contentType, size_bytes: file.size, created_by: access.userId,
          recording_notice_attested: file.kind === 'recording',
          consent_attested_by: file.kind === 'recording' ? access.userId : null,
          consent_attested_at: file.kind === 'recording' ? new Date().toISOString() : null,
        }),
      });
      if (!inserted.ok) return fail(503, 'Upload could not be prepared.');
      const created = (await inserted.json() as { id?: string }[])[0];
      if (!created?.id) return fail(503, 'Upload could not be prepared.');
      const signed = await db.storage.from(BUCKET).createSignedUploadUrl(objectPath, { upsert: false });
      const storageHost = directStorageHost(s.url);
      if (signed.error || !signed.data?.token || !storageHost) {
        await serviceFetch(s, `session_resources?id=eq.${created.id}`, { method: 'DELETE' });
        return fail(503, 'Upload could not be prepared.');
      }
      return json({ resourceId: created.id, bucketName: BUCKET, objectName: objectPath, uploadToken: signed.data.token, storageHost, contentType: file.contentType }, 201);
    }

    if (body.action === 'complete-upload') {
      if (!mediaReady()) return fail(503, 'Private media uploads are not configured.');
      const id = body.resourceId;
      if (typeof id !== 'string' || !UUID.test(id)) return fail(400, 'Invalid upload.');
      const item = await resourceById(s, id);
      if (!item || item.created_by !== access.userId || item.status !== 'uploading' || !item.object_path) return fail(404, 'Upload not found.');
      const pathParts = item.object_path.split('/');
      const folder = pathParts.slice(0, -1).join('/'); const name = pathParts.at(-1) || '';
      const listed = await db.storage.from(BUCKET).list(folder, { search: name, limit: 2 });
      if (listed.error || !listed.data?.some(file => file.name === name)) return fail(409, 'Upload is not complete.');
      const uploaded = listed.data.find(file => file.name === name);
      const actualSize = Number(uploaded?.metadata?.size);
      const actualType = uploaded?.metadata?.mimetype;
      if (!uploaded || !Number.isSafeInteger(actualSize) || actualSize !== Number(item.size_bytes) || actualType !== item.content_type) {
        await db.storage.from(BUCKET).remove([item.object_path]);
        await serviceFetch(s, `session_resources?id=eq.${id}&status=eq.uploading`, { method: 'PATCH', body: JSON.stringify({ status: 'failed', error_code: 'upload_metadata_mismatch' }) });
        return fail(409, 'Uploaded file details did not match the authorized size and type. The file was rejected.');
      }
      const updated = await serviceFetch(s, `session_resources?id=eq.${id}&status=eq.uploading`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: 'ready', updated_at: new Date().toISOString() }),
      });
      if (!updated.ok || !(await updated.json() as unknown[]).length) return fail(409, 'Upload could not be confirmed.');
      await audit(s, access.userId, item.kind === 'certificate' ? 'certificate_assigned' : 'uploaded', item.id, item.participant_id);
      return json({ message: item.kind === 'certificate' ? 'Certificate uploaded and assigned.' : 'Recording uploaded.' });
    }

    const resourceId = body.resourceId;
    if (typeof resourceId !== 'string' || !UUID.test(resourceId)) return fail(400, 'Invalid resource.');
    const item = await resourceById(s, resourceId);
    if (!item) return fail(404, 'Resource not found.');

    if (body.action === 'download') {
      if (!item.object_path || !['ready', 'approved'].includes(item.status)) return fail(409, 'Resource is not ready to download.');
      const signed = await db.storage.from(BUCKET).createSignedUrl(item.object_path, DOWNLOAD_SECONDS, { download: item.file_name || true });
      if (signed.error || !signed.data?.signedUrl) return fail(503, 'Download is temporarily unavailable.');
      await audit(s, access.userId, 'download_authorized', item.id, item.participant_id);
      return json({ url: signed.data.signedUrl, expiresIn: DOWNLOAD_SECONDS, fileName: item.file_name });
    }

    if (body.action === 'approve') {
      if (!consentReady()) return fail(503, 'Recording consent and retention approval are required before notes can be approved.');
      if (!['transcript', 'summary', 'action_items'].includes(item.kind) || item.status !== 'pending_review') return fail(409, 'Only draft session notes can be approved.');
      const source = item.source_resource_id ? await resourceById(s, item.source_resource_id) : null;
      if (!source || source.kind !== 'recording' || source.recording_notice_attested !== true || !source.consent_attested_by) return fail(409, 'The original recording approval could not be confirmed.');
      const updated = await serviceFetch(s, `session_resources?id=eq.${resourceId}&status=eq.pending_review`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: 'approved', reviewed_by: access.userId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      });
      if (!updated.ok || !(await updated.json() as unknown[]).length) return fail(409, 'The notes could not be approved.');
      await audit(s, access.userId, 'approved', item.id);
      return json({ message: 'Draft approved. Share it separately when ready.' });
    }

    if (body.action === 'share') {
      if (process.env.SESSION_PRIVACY_APPROVED !== 'true' || process.env.MEDIA_RETENTION_APPROVED !== 'true') return fail(503, 'Programme privacy and retention approval are required before sharing.');
      if (item.kind === 'certificate' || (item.kind === 'recording' && item.status !== 'ready') || (['transcript','summary','action_items'].includes(item.kind) && item.status !== 'approved')) return fail(409, 'This resource is not approved for sharing.');
      if (item.kind === 'recording' && (!consentReady() || item.recording_notice_attested !== true || !item.consent_attested_by)) return fail(403, 'Recording notice and consent approval could not be confirmed.');
      if (['transcript','summary','action_items'].includes(item.kind)) {
        const source = item.source_resource_id ? await resourceById(s, item.source_resource_id) : null;
        if (!consentReady() || !source || source.kind !== 'recording' || source.recording_notice_attested !== true || !source.consent_attested_by) return fail(403, 'Recording notice and consent approval could not be confirmed.');
      }
      let targets: string[] = [];
      if (body.allParticipants === true) {
        const participants = await allActiveParticipantIds(s, item.cohort_id);
        if ('error' in participants) return participants.error === 'too_many'
          ? fail(413, 'This cohort exceeds the safe 5,000-member sharing limit; no partial sharing was applied.')
          : fail(503, 'Unable to load all cohort members.');
        targets = participants.ids;
      } else if (Array.isArray(body.participantIds) && body.participantIds.length <= 200 && body.participantIds.every(id => typeof id === 'string' && UUID.test(id))) {
        targets = [...new Set(body.participantIds as string[])];
      } else return fail(400, 'Choose cohort members to share with.');
      if (!targets.length) return fail(409, 'No active cohort members are available.');
      if (body.allParticipants !== true) {
        const valid = await serviceFetch(s, `attendance_participants?id=in.(${targets.join(',')})&cohort_id=eq.${item.cohort_id}&active=eq.true&select=id&limit=200`);
        if (!valid.ok) return fail(503, 'Unable to confirm cohort membership.');
        const confirmed = (await valid.json() as { id: string }[]).map(row => row.id);
        if (confirmed.length !== targets.length) return fail(400, 'One or more selected members are not in this cohort.');
      }
      const grants = targets.map(participant_id => ({ resource_id: item.id, participant_id, granted_by: access.userId, revoked_by: null, revoked_at: null }));
      const saved = await serviceFetch(s, 'session_resource_shares?on_conflict=resource_id,participant_id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(grants),
      });
      if (!saved.ok) return fail(503, 'Sharing could not be saved.');
      await audit(s, access.userId, 'shared', item.id);
      return json({ message: 'Resource shared with the selected cohort members.', recipientCount: targets.length });
    }

    if (body.action === 'unshare') {
      const recipients = Array.isArray(body.participantIds) && body.participantIds.length <= 200 && body.participantIds.every(id => typeof id === 'string' && UUID.test(id))
        ? [...new Set(body.participantIds as string[])] : [];
      const filters = `resource_id=eq.${resourceId}&revoked_at=is.null${recipients.length ? `&participant_id=in.(${recipients.join(',')})` : ''}`;
      const revoked = await serviceFetch(s, `session_resource_shares?${filters}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ revoked_by: access.userId, revoked_at: new Date().toISOString() }),
      });
      if (!revoked.ok) return fail(503, 'Sharing could not be revoked.');
      await audit(s, access.userId, 'unshared', item.id);
      return json({ message: 'Resource access revoked.' });
    }

    if (body.action === 'delete') {
      if (item.kind === 'recording') {
        const [notes, jobs] = await Promise.all([
          serviceFetch(s, `session_resources?source_resource_id=eq.${resourceId}&select=id&limit=1`),
          serviceFetch(s, `session_ai_jobs?source_resource_id=eq.${resourceId}&status=in.(queued,processing)&select=id&limit=1`),
        ]);
        if (!notes.ok || !jobs.ok) return fail(503, 'Recording dependencies could not be checked.');
        if ((await notes.json() as unknown[]).length) return fail(409, 'Remove its linked draft or approved notes before deleting this recording.');
        if ((await jobs.json() as unknown[]).length) return fail(409, 'A recording with an active AI job cannot be deleted.');
      }
      if (item.object_path) {
        const removed = await db.storage.from(BUCKET).remove([item.object_path]);
        if (removed.error) return fail(503, 'Private file could not be removed.');
      }
      await audit(s, access.userId, 'deleted', item.id, item.participant_id);
      const deleted = await serviceFetch(s, `session_resources?id=eq.${resourceId}`, { method: 'DELETE' });
      if (!deleted.ok) {
        await serviceFetch(s, `session_resources?id=eq.${resourceId}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed', error_code: 'storage_removed_metadata_delete_failed' }) });
        return fail(503, 'The file was removed, but its record could not be removed. An administrator must review it.');
      }
      return json({ message: 'Resource removed.' });
    }

    return fail(400, 'Unsupported resource action.');
  } catch {
    // Never log or return participant data, file contents, provider responses, or credentials.
    return fail(503, 'Session resource service is temporarily unavailable.');
  }
}

async function memberAuthorization(request: Request): Promise<{ member: Member } | { error: Response }> {
  if (!memberReady()) return { error: fail(503, 'The member portal is not enabled.') };
  const s = portalSettings();
  if (!s) return { error: fail(503, 'The member portal is not configured.') };
  const bearer = /^Bearer ([A-Za-z0-9_.-]{20,8192})$/.exec(request.headers.get('authorization') || '')?.[1];
  if (!bearer) return { error: fail(401, 'Sign in to continue.') };
  try {
    const verified = await fetch(`${s.url}/auth/v1/user`, { headers: { apikey: s.publishable, Authorization: `Bearer ${bearer}` }, signal: AbortSignal.timeout(8000) });
    if (!verified.ok) return { error: fail(401, 'Session expired. Sign in again.') };
    const user = await verified.json() as { id?: unknown; email?: unknown; email_confirmed_at?: unknown };
    if (typeof user.id !== 'string' || !UUID.test(user.id) || typeof user.email !== 'string' || !user.email_confirmed_at) return { error: fail(403, 'Use a verified email address assigned to your cohort account.') };
    const memberRows = await serviceFetch(s, `participant_member_accounts?user_id=eq.${user.id}&active=eq.true&select=participant_id&limit=1`);
    if (!memberRows.ok) return { error: fail(503, 'Member access is temporarily unavailable.') };
    const membership = (await memberRows.json() as { participant_id: string }[])[0];
    if (!membership?.participant_id) return { error: fail(403, 'This account has not been approved for member resources.') };
    const participantRows = await serviceFetch(s, `attendance_participants?id=eq.${membership.participant_id}&active=eq.true&select=id,cohort_id,full_name,normalized_email&limit=1`);
    if (!participantRows.ok) return { error: fail(503, 'Member access is temporarily unavailable.') };
    const participant = (await participantRows.json() as { id: string; cohort_id: string; full_name: string; normalized_email: string | null }[])[0];
    if (!participant || !participant.normalized_email || participant.normalized_email !== user.email.trim().toLowerCase()) return { error: fail(403, 'The verified email does not match an active member assignment.') };
    return { member: { settings: s, userId: user.id, participantId: participant.id, cohortId: participant.cohort_id, fullName: participant.full_name } };
  } catch { return { error: fail(503, 'Member access is temporarily unavailable.') }; }
}

export async function memberSession(request: Request): Promise<Response> {
  if (request.method !== 'GET') return fail(405, 'Method not allowed.');
  const checked = await memberAuthorization(request);
  if ('error' in checked) return checked.error;
  return json({ member: { fullName: checked.member.fullName } });
}

export async function memberResources(request: Request): Promise<Response> {
  if (request.method !== 'GET') return fail(405, 'Method not allowed.');
  const checked = await memberAuthorization(request);
  if ('error' in checked) return checked.error;
  const { member } = checked;
  const query = new URL(request.url).searchParams;
  const downloadId = query.get('download') || '';
  try {
    if (downloadId) {
      if (!UUID.test(downloadId)) return fail(400, 'Invalid resource.');
      const item = await resourceById(member.settings, downloadId);
      if (!item || !item.object_path || !['ready','approved'].includes(item.status)) return fail(404, 'Resource not found.');
      let allowed = item.kind === 'certificate' && item.participant_id === member.participantId;
      if (!allowed && item.participant_id === null) {
        const grant = await serviceFetch(member.settings, `session_resource_shares?resource_id=eq.${item.id}&participant_id=eq.${member.participantId}&revoked_at=is.null&select=resource_id&limit=1`);
        allowed = grant.ok && (await grant.json() as unknown[]).length > 0;
      }
      if (!allowed) return fail(404, 'Resource not found.');
      const signed = await service(member.settings).storage.from(BUCKET).createSignedUrl(item.object_path, DOWNLOAD_SECONDS, { download: item.file_name || true });
      if (signed.error || !signed.data?.signedUrl) return fail(503, 'Download is temporarily unavailable.');
      await audit(member.settings, member.userId, 'download_authorized', item.id, member.participantId);
      return json({ url: signed.data.signedUrl, expiresIn: DOWNLOAD_SECONDS, fileName: item.file_name });
    }
    const rawOffset = query.get('offset') || '0';
    if (!/^\d{1,5}$/.test(rawOffset)) return fail(400, 'Invalid resource page.');
    const offset = Number(rawOffset);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset >= MAX_MEMBER_RESOURCE_OFFSET
      || offset % MEMBER_RESOURCE_PAGE_SIZE !== 0) return fail(400, 'Invalid resource page.');
    const resourceResponse = await serviceFetch(member.settings, 'rpc/member_list_session_resources', {
      method: 'POST',
      body: JSON.stringify({ p_actor: member.userId, p_participant_id: member.participantId, p_offset: offset, p_limit: MEMBER_RESOURCE_PAGE_SIZE + 1 }),
    });
    if (!resourceResponse.ok) return fail(503, 'Member resources are temporarily unavailable.');
    const rows = await resourceResponse.json() as { id: string; session_id: string | null; participant_id: string | null; kind: string; status: string; file_name: string | null; content_type: string | null; size_bytes: number | null; content_text: string | null; created_at: string }[];
    if (!Array.isArray(rows)) return fail(503, 'Member resources are temporarily unavailable.');
    const hasMore = rows.length > MEMBER_RESOURCE_PAGE_SIZE;
    const limitReached = hasMore && offset + MEMBER_RESOURCE_PAGE_SIZE >= MAX_MEMBER_RESOURCE_OFFSET;
    const safe = rows.slice(0, MEMBER_RESOURCE_PAGE_SIZE).map(row => ({
      id: row.id, sessionId: row.session_id, kind: row.kind, status: row.status,
      fileName: row.file_name, contentType: row.content_type, sizeBytes: row.size_bytes,
      content: ['transcript','summary','action_items'].includes(row.kind) && row.status === 'approved' ? (row.content_text || '').slice(0, 200000) : null,
      createdAt: row.created_at,
    }));
    return json({ resources: safe, nextOffset: offset + safe.length, hasMore: hasMore && !limitReached, limitReached });
  } catch { return fail(503, 'Member resources are temporarily unavailable.'); }
}

export async function adminInviteMember(request: Request): Promise<Response> {
  if (request.method !== 'POST') return fail(405, 'Method not allowed.');
  if (!portalReady() || process.env.SESSION_PRIVACY_APPROVED !== 'true' || process.env.MEDIA_RETENTION_APPROVED !== 'true'
    || process.env.MEMBER_PORTAL_ENABLED !== 'true' || process.env.MEMBER_INVITES_ENABLED !== 'true') return fail(503, 'Member invitations are not enabled.');
  const checked = await admin(request, true);
  if ('error' in checked) return checked.error;
  const body = await readBody(request);
  const participantId = body?.participantId;
  if (typeof participantId !== 'string' || !UUID.test(participantId)) return fail(400, 'Select a valid participant.');
  try {
    const participantResponse = await serviceFetch(checked.settings, `attendance_participants?id=eq.${participantId}&active=eq.true&select=id,cohort_id,full_name,normalized_email&limit=1`);
    if (!participantResponse.ok) return fail(503, 'Participant could not be checked.');
    const participant = (await participantResponse.json() as { id: string; cohort_id: string; full_name: string; normalized_email: string | null }[])[0];
    if (!participant?.normalized_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(participant.normalized_email)) return fail(409, 'This participant needs a verified email in the approved cohort register first.');
    const matches = await serviceFetch(checked.settings, `attendance_participants?normalized_email=eq.${encodeURIComponent(participant.normalized_email)}&active=eq.true&select=id&limit=2`);
    if (!matches.ok || (await matches.json() as unknown[]).length !== 1) return fail(409, 'This email must identify exactly one active participant before member access can be assigned.');
    const existing = await serviceFetch(checked.settings, `participant_member_accounts?participant_id=eq.${participant.id}&active=eq.true&select=participant_id&limit=1`);
    if (!existing.ok) return fail(503, 'Member access could not be checked.');
    if ((await existing.json() as unknown[]).length) return fail(409, 'Member access has already been assigned for this participant.');
    const client = service(checked.settings);
    const invite = await client.auth.admin.inviteUserByEmail(participant.normalized_email, { redirectTo: `${checked.settings.origin}/member`, data: { menhr_member: true } });
    if (invite.error || !invite.data.user?.id) return fail(409, 'Invitation could not be issued. Check whether this approved address already has an account or contact the platform administrator.');
    const linked = await serviceFetch(checked.settings, 'participant_member_accounts', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: invite.data.user.id, participant_id: participant.id, active: true, linked_by: checked.access.userId }),
    });
    if (!linked.ok) return fail(409, 'The invitation was sent, but the member assignment needs administrator review.');
    await audit(checked.settings, checked.access.userId, 'member_invited', null, participant.id);
    return json({ message: 'Member invitation sent and cohort access assigned.' }, 201);
  } catch { return fail(503, 'Member invitation is temporarily unavailable.'); }
}

export async function adminMemberRoster(request: Request): Promise<Response> {
  if (request.method !== 'GET') return fail(405, 'Method not allowed.');
  const checked = await admin(request);
  if ('error' in checked) return checked.error;
  if (process.env.SESSION_PRIVACY_APPROVED !== 'true' || process.env.MEDIA_RETENTION_APPROVED !== 'true') return fail(503, 'Member access is not approved.');
  const query = new URL(request.url).searchParams;
  const cohortId = query.get('cohort') || '';
  const offset = Number(query.get('offset') || '0');
  if (!UUID.test(cohortId)) return fail(400, 'Choose a valid cohort.');
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= MAX_COHORT_PARTICIPANTS || offset % 200 !== 0) return fail(400, 'Invalid roster page.');
  const limit = Math.min(201, MAX_COHORT_PARTICIPANTS + 1 - offset);
  const response = await serviceFetch(checked.settings, `attendance_participants?cohort_id=eq.${cohortId}&active=eq.true&select=id,cohort_id,full_name,email,normalized_email&order=full_name.asc,id.asc&limit=${limit}&offset=${offset}`);
  if (!response.ok) return fail(503, 'Member roster is unavailable.');
  const rows = await response.json() as { id:string; cohort_id:string; full_name:string; email:string|null; normalized_email:string|null }[];
  const hasNextPage = rows.length > 200;
  const limitReached = hasNextPage && offset + 200 >= MAX_COHORT_PARTICIPANTS;
  const participants = rows.slice(0, 200);
  return json({ participants, nextOffset: offset + participants.length, hasMore: hasNextPage && !limitReached, limitReached });
}
