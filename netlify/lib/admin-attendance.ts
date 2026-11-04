/**
 * Men in HR Connect: private attendance session administration.
 * Uses the existing server-side Supabase token verification and admin role check.
 */
import { json } from './application-server.ts';
import { authorize, serviceFetch } from './admin-server.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 8192;

type SessionRow = {
  id: string;
  cohort_id: string;
  session_number: number;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  status: 'planned' | 'completed' | 'cancelled';
  created_at: string;
};

function failure(status: number, error: string) {
  return json({ error }, status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return null;
  const length = Number(request.headers.get('content-length') || '0');
  if (length > MAX_BODY_BYTES) return null;
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function validMeetUrl(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 500) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'meet.google.com' || !url.pathname.startsWith('/')) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export async function adminAttendanceSessions(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'POST') return failure(405, 'Method not allowed.');
  const check = await authorize(request, request.method !== 'GET');
  if (check.error) return check.error;
  const { settings: s, userId } = check.admin;

  try {
    if (request.method === 'GET') {
      const query = new URL(request.url).searchParams;
      const cohortId = query.get('cohort') || '';
      if (cohortId && !UUID.test(cohortId)) return failure(400, 'Invalid cohort filter.');
      const filters = [
        'select=id,cohort_id,session_number,title,scheduled_at,duration_minutes,meeting_url,status,created_at',
        'order=scheduled_at.asc,session_number.asc',
        'limit=100',
      ];
      if (cohortId) filters.push(`cohort_id=eq.${cohortId}`);
      const response = await serviceFetch(s, `attendance_sessions?${filters.join('&')}`);
      if (response.status === 404) return failure(503, 'Attendance setup is not installed yet.');
      if (!response.ok) return failure(503, 'Unable to retrieve attendance sessions.');
      return json({ sessions: await response.json() as SessionRow[] });
    }

    let body: Record<string, unknown> | null;
    try { body = await readJson(request); } catch { return failure(400, 'Invalid request.'); }
    if (!body) return failure(400, 'Send a valid JSON request within the size limit.');

    const cohortId = body.cohortId;
    const sessionNumber = Number(body.sessionNumber);
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const scheduledAt = typeof body.scheduledAt === 'string' ? body.scheduledAt : '';
    const durationMinutes = Number(body.durationMinutes ?? 60);
    const meetingUrl = validMeetUrl(body.meetingUrl);

    if (typeof cohortId !== 'string' || !UUID.test(cohortId)
      || !Number.isInteger(sessionNumber) || sessionNumber < 1 || sessionNumber > 20
      || title.length < 4 || title.length > 160
      || !scheduledAt || !Number.isFinite(Date.parse(scheduledAt))
      || !Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 240
      || meetingUrl === undefined) {
      return failure(400, 'Check the cohort, session number, title, date, duration and Google Meet link.');
    }

    const row = {
      cohort_id: cohortId,
      session_number: sessionNumber,
      title,
      scheduled_at: new Date(scheduledAt).toISOString(),
      duration_minutes: durationMinutes,
      meeting_url: meetingUrl,
      status: 'planned',
      created_by: userId,
    };
    const response = await serviceFetch(s, 'attendance_sessions?select=id,cohort_id,session_number,title,scheduled_at,duration_minutes,meeting_url,status,created_at', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(row),
    });
    if (response.status === 409) return failure(409, 'That session number already exists for this cohort.');
    if (!response.ok) return failure(503, 'The session could not be saved. Confirm that the attendance schema has been installed.');
    const rows = await response.json() as SessionRow[];
    if (!Array.isArray(rows) || !rows[0]?.id) return failure(503, 'The session could not be confirmed.');
    return json({ session: rows[0], message: 'Session created.' }, 201);
  } catch {
    return failure(503, 'Attendance administration is temporarily unavailable.');
  }
}
