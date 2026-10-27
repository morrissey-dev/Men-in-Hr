import { validateApplication, NOTICE_VERSION } from '../../src/lib/application-validation.ts';

export type PublicApplicationStatus = {
  open: boolean;
  cohortName?: string;
  privacyController?: string;
  privacyEmail?: string;
  retentionDays?: number;
  turnstileSiteKey?: string;
  noticeVersion?: string;
};

type Cohort = { id: string; name: string; applications_open: boolean };

type Settings = {
  origin: string;
  supabaseUrl: string;
  supabaseKey: string;
  cohortSlug: string;
  siteKey: string;
  secretKey: string;
  controller: string;
  email: string;
  retentionDays: number;
};

export function json(body: object, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

function loadSettings(): Settings | null {
  const origin = process.env.SITE_ORIGIN?.trim() ?? '';
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? '';
  const supabaseKey = process.env.SUPABASE_SECRET_KEY?.trim() ?? '';
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim() ?? '';
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim() ?? '';
  const controller = process.env.PRIVACY_CONTROLLER_NAME?.trim() ?? '';
  const email = process.env.PRIVACY_CONTACT_EMAIL?.trim() ?? '';
  const retentionDays = Number(process.env.APPLICATION_RETENTION_DAYS);
  if (process.env.APPLICATIONS_OPEN !== 'true' || process.env.PRIVACY_APPROVED !== 'true' || process.env.RETENTION_PROCESS_ACTIVE !== 'true' || !origin || !supabaseUrl || !supabaseKey || !siteKey || !secretKey || !controller || !email || !Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 365) return null;
  try {
    const base = new URL(supabaseUrl);
    const site = new URL(origin);
    if (base.protocol !== 'https:' || !base.hostname.endsWith('.supabase.co') || (site.protocol !== 'https:' && site.hostname !== 'localhost')) return null;
    if (site.origin !== origin.replace(/\/$/, '') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  } catch { return null; }
  return { origin: origin.replace(/\/$/, ''), supabaseUrl: supabaseUrl.replace(/\/$/, ''), supabaseKey, cohortSlug: process.env.APPLICATION_COHORT_SLUG?.trim() || 'cohort-1', siteKey, secretKey, controller, email, retentionDays };
}

export function registrationConfigurationReady(): boolean {
  return loadSettings() !== null;
}

async function database(settings: Settings, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${settings.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: settings.supabaseKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(8000),
  });
}

async function getOpenCohort(settings: Settings): Promise<Cohort | null> {
  const slug = encodeURIComponent(settings.cohortSlug);
  const response = await database(settings, `cohorts?slug=eq.${slug}&select=id,name,applications_open&limit=1`);
  if (!response.ok) throw new Error('Unable to check cohort');
  const rows = await response.json() as Cohort[];
  const cohort = rows[0];
  return cohort?.applications_open ? cohort : null;
}

export async function readPublicStatus(): Promise<PublicApplicationStatus> {
  const settings = loadSettings();
  if (!settings) return { open: false };
  try {
    const cohort = await getOpenCohort(settings);
    if (!cohort) return { open: false };
    return { open: true, cohortName: cohort.name, privacyController: settings.controller,
      privacyEmail: settings.email, retentionDays: settings.retentionDays,
      turnstileSiteKey: settings.siteKey, noticeVersion: NOTICE_VERSION };
  } catch {
    return { open: false };
  }
}

async function verifyTurnstile(settings: Settings, token: string): Promise<boolean> {
  if (!token) return false;
  const data = new URLSearchParams({ secret: settings.secretKey, response: token });
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: data, signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return false;
  const verdict = await response.json() as { success?: boolean; hostname?: string };
  return verdict.success === true && verdict.hostname === new URL(settings.origin).hostname;
}

export async function submitApplication(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const settings = loadSettings();
  if (!settings) return json({ error: 'Applications are not open.' }, 503);
  if (request.headers.get('origin') !== settings.origin) return json({ error: 'Origin not permitted.' }, 403);
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return json({ error: 'Send JSON.' }, 415);
  if (Number(request.headers.get('content-length') ?? 0) > 16384) return json({ error: 'Request too large.' }, 413);
  let raw: string;
  try { raw = await request.text(); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (raw.length > 16384) return json({ error: 'Request too large.' }, 413);
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON.' }, 400); }
  const checked = validateApplication(payload);
  if (!checked.value) return json({ error: 'Please correct your application.', fields: checked.errors }, 400);
  try {
    const cohort = await getOpenCohort(settings);
    if (!cohort) return json({ error: 'Applications are not open.' }, 503);
    if (!(await verifyTurnstile(settings, checked.value.turnstileToken))) return json({ error: 'Verification expired or failed. Please retry.' }, 400);
    const value = checked.value;
    const row = {
      cohort_id: cohort.id, full_name: value.fullName, email: value.email,
      institution: value.institution, year_of_study: value.yearOfStudy,
      interests: value.interests, motivation: value.motivation,
      privacy_notice_version: NOTICE_VERSION, privacy_consented_at: new Date().toISOString(),
      confirmed_adult: true,
    };
    const response = await database(settings, 'applications', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) });
    // A duplicate email for the same cohort receives the same generic response: no account enumeration.
    if (response.status === 409) return json({ message: 'Your application has been received if eligible. Please check official announcements for updates.' }, 202);
    if (!response.ok) return json({ error: 'Submission could not be completed. Please try again later.' }, 502);
    return json({ message: 'Your application has been received if eligible. Please check official announcements for updates.' }, 202);
  } catch {
    // Do not log names, addresses, tokens or raw submission bodies.
    return json({ error: 'The service is temporarily unavailable. Please try again later.' }, 503);
  }
}
