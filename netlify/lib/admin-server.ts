/**
 * Men in HR Connect: authenticated administration service.
 * Browser tokens are ALWAYS verified against Supabase Auth on every request.
 * Roles are looked up on the server; no browser-supplied claim confers access.
 */
import { json, registrationConfigurationReady } from './application-server.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['pending', 'approved', 'declined', 'withdrawn'] as const;
type Role = 'owner' | 'coordinator';
type AdminSettings = { origin: string; url: string; secret: string; publishable: string };
type Authorized = { settings: AdminSettings; userId: string; role: Role };
type Allowed = { admin: Authorized; error?: never } | { admin?: never; error: Response };

type Cohort = { id: string; slug: string; name: string; applications_open: boolean; created_at: string };

function settings(): AdminSettings | null {
  if (process.env.ADMIN_DASHBOARD_ENABLED !== 'true') return null;
  const origin = process.env.SITE_ORIGIN?.trim() || '';
  const url = process.env.SUPABASE_URL?.trim() || '';
  const secret = process.env.SUPABASE_SECRET_KEY?.trim() || '';
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || '';
  try {
    if (!origin || !url || !secret || !publishable) return null;
    const o = new URL(origin); const s = new URL(url);
    if ((o.protocol !== 'https:' && o.hostname !== 'localhost') || o.origin !== origin.replace(/\/$/, '')) return null;
    if (s.protocol !== 'https:' || !s.hostname.endsWith('.supabase.co')) return null;
    return { origin, url: url.replace(/\/$/, ''), secret, publishable };
  } catch { return null; }
}

async function serviceFetch(s: AdminSettings, path: string, init: RequestInit = {}) {
  return fetch(`${s.url}/rest/v1/${path}`, {
    ...init, headers: { apikey: s.secret, Accept: 'application/json', 'Content-Type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(8000),
  });
}

function failure(status: number, error: string) { return json({ error }, status); }

async function authorize(request: Request, mutate = false, owner = false): Promise<Allowed> {
  const s = settings();
  if (!s) return { error: failure(503, 'Administration is not configured.') };
  if (mutate && request.headers.get('origin') !== s.origin) return { error: failure(403, 'Origin not permitted.') };
  const raw = request.headers.get('authorization') || '';
  const matched = /^Bearer ([A-Za-z0-9_.-]{20,8192})$/.exec(raw);
  if (!matched) return { error: failure(401, 'Sign in to continue.') };
  try {
    // Authoritative JWT validation: never merely decode an untrusted browser JWT.
    const verified = await fetch(`${s.url}/auth/v1/user`, {
      headers: { apikey: s.publishable, Authorization: `Bearer ${matched[1]}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!verified.ok) return { error: failure(401, 'Session expired. Sign in again.') };
    const user = await verified.json() as { id?: unknown };
    if (typeof user.id !== 'string' || !UUID.test(user.id)) return { error: failure(401, 'Invalid session.') };
    const members = await serviceFetch(s, `admin_members?user_id=eq.${user.id}&active=eq.true&select=role&limit=1`);
    if (!members.ok) return { error: failure(503, 'Administration is temporarily unavailable.') };
    const rows = await members.json() as { role?: string }[];
    const role = rows[0]?.role;
    if (role !== 'owner' && role !== 'coordinator') return { error: failure(403, 'Access restricted to approved coordinators.') };
    if (owner && role !== 'owner') return { error: failure(403, 'Only the authorised administrator may change cohorts.') };
    return { admin: { settings: s, userId: user.id, role } };
  } catch {
    return { error: failure(503, 'Administration is temporarily unavailable.') };
  }
}

function jsonBody(request: Request): Promise<unknown> {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) throw new Error('content-type');
  if (Number(request.headers.get('content-length') || '0') > 2048) throw new Error('oversize');
  return request.text().then(raw => { if (raw.length > 2048) throw new Error('oversize'); return JSON.parse(raw) as unknown; });
}
function record(body: unknown): Record<string, unknown> | null {
  return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
}

export async function adminSession(request: Request): Promise<Response> {
  if (request.method !== 'GET') return failure(405, 'Method not allowed.');
  const check = await authorize(request);
  if (check.error) return check.error;
  // Personal-only feature gate: the authenticated Supabase user ID must match the
  // approved facilitator UUID. Having an admin role alone is not sufficient.
  const facilitatorId = process.env.FACILITATOR_USER_ID?.trim() || '';
  const canFacilitate = check.admin.role === 'owner'
    && UUID.test(facilitatorId) && check.admin.userId.toLowerCase() === facilitatorId.toLowerCase();
  return json({ role: check.admin.role, canFacilitate });
}

export async function adminApplications(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'PATCH') return failure(405, 'Method not allowed.');
  const check = await authorize(request, request.method === 'PATCH');
  if (check.error) return check.error;
  const { settings: s, userId } = check.admin;
  try {
    if (request.method === 'GET') {
      const query = new URL(request.url).searchParams;
      const cohort = query.get('cohort') || '';
      const status = query.get('status') || '';
      const page = Number(query.get('page') || '0');
      if ((cohort && !UUID.test(cohort)) || (status && !STATUSES.includes(status as typeof STATUSES[number])) || !Number.isInteger(page) || page < 0 || page > 200) return failure(400, 'Invalid filter.');
      const filters = [`select=id,cohort_id,full_name,email,institution,year_of_study,interests,motivation,status,created_at`, 'order=created_at.desc,id.desc', `offset=${page * 25}`, 'limit=26'];
      if (cohort) filters.push(`cohort_id=eq.${cohort}`);
      if (status) filters.push(`status=eq.${status}`);
      const response = await serviceFetch(s, `applications?${filters.join('&')}`);
      if (!response.ok) return failure(503, 'Unable to retrieve applications.');
      const rows = await response.json() as unknown[];
      return json({ applications: rows.slice(0, 25), hasMore: rows.length > 25, page });
    }
    let parsed: Record<string, unknown> | null;
    try { parsed = record(await jsonBody(request)); } catch { return failure(400, 'Invalid request.'); }
    const id = parsed?.applicationId;
    const next = parsed?.status;
    if (typeof id !== 'string' || !UUID.test(id) || typeof next !== 'string' || !['pending', 'approved', 'declined'].includes(next)) return failure(400, 'Invalid application or decision.');
    // Database RPC performs the update and audit insert atomically, after its own role check.
    const response = await serviceFetch(s, 'rpc/admin_set_application_status', {
      method: 'POST', body: JSON.stringify({ p_actor: userId, p_application_id: id, p_new_status: next }),
    });
    if (!response.ok) return failure(503, 'Decision could not be saved.');
    const changed = await response.json() as boolean;
    if (changed !== true) return failure(409, 'The application is unavailable or the requested transition is not allowed. Refresh and retry.');
    return json({ message: 'Application decision saved.' });
  } catch { return failure(503, 'Administration is temporarily unavailable.'); }
}

export async function adminCohorts(request: Request): Promise<Response> {
  if (!['GET', 'POST', 'PATCH'].includes(request.method)) return failure(405, 'Method not allowed.');
  const check = await authorize(request, request.method !== 'GET', request.method !== 'GET');
  if (check.error) return check.error;
  const { settings: s, userId } = check.admin;
  try {
    if (request.method === 'GET') {
      const response = await serviceFetch(s, 'cohorts?select=id,slug,name,applications_open,created_at&order=created_at.asc&limit=100');
      if (!response.ok) return failure(503, 'Unable to retrieve cohorts.');
      return json({ cohorts: await response.json() as Cohort[] });
    }
    let parsed: Record<string, unknown> | null;
    try { parsed = record(await jsonBody(request)); } catch { return failure(400, 'Invalid request.'); }
    if (request.method === 'POST') {
      const slug = parsed?.slug, name = parsed?.name;
      if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 60 || typeof name !== 'string' || name.trim().length < 4 || name.trim().length > 120) return failure(400, 'Provide a valid cohort name and slug.');
      const response = await serviceFetch(s, 'rpc/admin_create_cohort', { method: 'POST', body: JSON.stringify({ p_actor: userId, p_slug: slug, p_name: name.trim() }) });
      if (response.status === 409) return failure(409, 'A cohort with this slug already exists.');
      if (!response.ok) return failure(503, 'Could not create cohort.');
      const id = await response.json() as unknown;
      if (typeof id !== 'string' || !UUID.test(id)) return failure(409, 'Unable to create cohort.');
      return json({ message: 'Draft cohort created. Applications remain closed.' }, 201);
    }
    const id = parsed?.cohortId, open = parsed?.applicationsOpen;
    if (typeof id !== 'string' || !UUID.test(id) || typeof open !== 'boolean') return failure(400, 'Invalid cohort change.');
    const rowResponse = await serviceFetch(s, `cohorts?id=eq.${id}&select=slug,applications_open&limit=1`);
    if (!rowResponse.ok) return failure(503, 'Unable to check cohort.');
    const rows = await rowResponse.json() as { slug: string; applications_open: boolean }[];
    if (!rows.length) return failure(404, 'Cohort not found.');
    if (open && (rows[0].slug !== (process.env.APPLICATION_COHORT_SLUG || 'cohort-1') || !registrationConfigurationReady())) {
      return failure(409, 'Only the configured cohort can be opened, after all privacy and registration safeguards are approved.');
    }
    // A closed cohort can always be closed again, even if approval settings have changed.
    const response = await serviceFetch(s, 'rpc/admin_set_cohort_open', { method: 'POST', body: JSON.stringify({ p_actor: userId, p_cohort_id: id, p_open: open }) });
    if (!response.ok) return failure(503, 'Cohort update could not be saved.');
    if ((await response.json()) !== true) return failure(409, 'Cohort was not changed.');
    return json({ message: open ? 'Registration enabled for configured cohort.' : 'Cohort applications closed.' });
  } catch { return failure(503, 'Administration is temporarily unavailable.'); }
}
