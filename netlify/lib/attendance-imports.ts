import { json } from './application-server.ts';
import { authorize, serviceFetch } from './admin-server.ts';
import { parseCsv, previewRosterRows, previewAttendanceRows, normalizeName, normalizeEmail, DEFAULT_MAX_CSV_BYTES } from './attendance-csv.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (status: number, error: string) => json({ error }, status);
const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const gate = () => process.env.SESSION_PORTAL_ENABLED === 'true'
  && process.env.SESSION_PRIVACY_APPROVED === 'true'
  && process.env.ATTENDANCE_RETENTION_APPROVED === 'true'
  && process.env.ATTENDANCE_IMPORTS_ENABLED === 'true';
function readFile(body: Record<string, unknown>) {
  if (typeof body.csv !== 'string' || new TextEncoder().encode(body.csv).byteLength > DEFAULT_MAX_CSV_BYTES
    || typeof body.fileName !== 'string' || !body.fileName.trim() || body.fileName.trim().length > 160) throw new Error('input');
  const data = parseCsv(body.csv);
  if (data.length < 2 || data.length > 1001) throw new Error('input');
  const headers = data[0]!.map(h => h.trim());
  if (!headers.length || headers.some(h => !h || h.length > 160) || new Set(headers).size !== headers.length) throw new Error('input');
  const rows = data.slice(1).filter(row => row.some(v => v.trim()));
  if (!rows.length || rows.length > 1000 || rows.some(r => r.length !== headers.length)) throw new Error('input');
  return { headers, rows };
}
function mapping(body: Record<string, unknown>, key: string, headers: string[], required = true) {
  const value = body[key];
  if (value === undefined || value === '' || value === null) { if (!required) return ''; throw new Error('mapping'); }
  if (typeof value !== 'string' || !headers.includes(value)) throw new Error('mapping');
  return value;
}
async function rows<T>(s: Parameters<typeof serviceFetch>[0], path: string): Promise<T[]> {
  const r = await serviceFetch(s, path);
  if (!r.ok) throw new Error('db');
  const result = await r.json(); return Array.isArray(result) ? result as T[] : [];
}
export async function adminAttendanceImports(request: Request): Promise<Response> {
  if (!['GET','POST'].includes(request.method)) return fail(405, 'Method not allowed.');
  if (!gate()) return fail(503, 'Attendance imports are unavailable.');
  const check = await authorize(request, request.method === 'POST');
  if (check.error) return check.error;
  const { settings: s, userId } = check.admin;
  try {
    if (request.method === 'GET') {
      const q = new URL(request.url).searchParams;
      const cohortId = q.get('cohort') || '', sessionId = q.get('session') || '';
      if ((cohortId && !UUID.test(cohortId)) || (sessionId && !UUID.test(sessionId))) return fail(400, 'Invalid filter.');
      const exportFormat = q.get('export') || '';
      if (exportFormat && exportFormat !== 'csv') return fail(400, 'Invalid export format.');
      if (exportFormat === 'csv') {
        if (!sessionId) return fail(400, 'Select a session to export.');
        const session = (await rows<{id:string;cohort_id:string;session_number:number;title:string}>(s, `attendance_sessions?id=eq.${sessionId}&select=id,cohort_id,session_number,title&limit=1`))[0];
        if (!session || (cohortId && session.cohort_id !== cohortId)) return fail(404, 'Session not found.');
        const records = await rows<{participant_id:string|null;attended_seconds:number;attendance_percent:number|null}>(s, `attendance_records?session_id=eq.${sessionId}&participant_id=not.is.null&select=participant_id,attended_seconds,attendance_percent&order=participant_id.asc&limit=1000`);
        const participantIds = [...new Set(records.map(record => record.participant_id).filter((id): id is string => !!id))];
        const people = participantIds.length
          ? await rows<{id:string;full_name:string}>(s, `attendance_participants?id=in.(${participantIds.join(',')})&select=id,full_name&limit=1000`)
          : [];
        const byId = new Map(people.map(person => [person.id, person.full_name]));
        if (records.some(record => !record.participant_id || !byId.has(record.participant_id))) return fail(503, 'Attendance export could not be prepared.');
        const cell = (value: unknown) => {
          let text = String(value ?? '').replace(/\r\n?/g, '\n');
          if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
          return `"${text.replace(/"/g, '""')}"`;
        };
        const csv = [
          ['Session number','Session title','Participant name','Attended seconds','Attendance percent'],
          ...records.map(record => [session.session_number,session.title,byId.get(record.participant_id!)!,record.attended_seconds,record.attendance_percent]),
        ].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
        return new Response(csv, { status:200, headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="attendance-session-${session.session_number}.csv"`,'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'} });
      }
      const filters = ['select=id,cohort_id,session_number,title,scheduled_at,duration_minutes,status','order=scheduled_at.asc','limit=100'];
      if (cohortId) filters.push(`cohort_id=eq.${cohortId}`);
      if (sessionId) filters.push(`id=eq.${sessionId}`);
      const sessions = await rows<Record<string, unknown>>(s, `attendance_sessions?${filters.join('&')}`);
      const result = await Promise.all(sessions.map(async session => {
        const sid = String(session.id);
        const [records, imports, participants] = await Promise.all([
          rows<Record<string, unknown>>(s, `attendance_records?session_id=eq.${sid}&select=id,participant_id,attended_seconds,attendance_percent&limit=1000`),
          rows<Record<string, unknown>>(s, `attendance_imports?session_id=eq.${sid}&status=eq.confirmed&select=id,row_count,summary,confirmed_at&order=confirmed_at.desc&limit=1`),
          rows<Record<string, unknown>>(s, `attendance_participants?cohort_id=eq.${session.cohort_id}&active=eq.true&select=id&limit=2000`),
        ]);
        const hasConfirmedImport = imports.some(i => i.id);
        return { session, confirmedMatches: records.length, ...(hasConfirmedImport ? { participantCount: participants.length, noAttendanceRecordCount: Math.max(0, participants.length-records.length) } : {}), imports: imports.map(i => ({ id:i.id,rowCount:i.row_count,summary:i.summary,confirmedAt:i.confirmed_at })) };
      }));
      return json({ sessions: result });
    }
    if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return fail(415, 'Send JSON.');
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > DEFAULT_MAX_CSV_BYTES + 16384) return fail(413, 'Request too large.');
    const body: unknown = JSON.parse(raw);
    if (!rec(body)) return fail(400, 'Invalid request.');
    const action = body.action;
    if (!['roster-preview','roster-confirm','report-preview','report-confirm'].includes(String(action))) return fail(400, 'Invalid action.');
    const cohortId = body.cohortId;
    if (typeof cohortId !== 'string' || !UUID.test(cohortId)) return fail(400, 'Invalid cohort.');
    const isRoster = String(action).startsWith('roster');
    const sessionId = body.sessionId;
    if (!isRoster && (typeof sessionId !== 'string' || !UUID.test(sessionId))) return fail(400, 'Invalid session.');
    const { headers, rows: csvRows } = readFile(body);
    const nameHeader = mapping(body, 'nameHeader', headers)!;
    const confirm = String(action).endsWith('confirm');
    if (confirm && body.confirm !== true) return fail(400, 'Explicit confirmation is required.');
    if (isRoster) {
      const emailHeader = mapping(body, 'emailHeader', headers, false);
      const imported = await rows<{id:string;normalized_email:string|null;normalized_name:string}>(s, `attendance_participants?cohort_id=eq.${cohortId}&select=id,normalized_email,normalized_name&limit=2000`);
      const preview = previewRosterRows(headers, csvRows, nameHeader, emailHeader);
      const seen = new Set<string>();
      const reviewed = preview.map(row => {
        if (row.status === 'invalid') return row;
        const duplicateFile = !!row.normalizedEmail && seen.has(row.normalizedEmail);
        if (row.normalizedEmail) seen.add(row.normalizedEmail);
        const duplicateDb = !!row.normalizedEmail && imported.some(p => p.normalized_email === row.normalizedEmail);
        return { ...row, status: duplicateFile || duplicateDb ? 'duplicate' : 'new', issues: [...row.issues, ...(duplicateFile ? ['Duplicate email in CSV.'] : []), ...(duplicateDb ? ['Email already exists in cohort roster.'] : [])] };
      });
      if (!confirm) return json({ preview: reviewed, counts: countBy(reviewed, 'status') });
      if (reviewed.some(r => r.status !== 'new')) return fail(409, 'Roster contains invalid or duplicate-email rows; correct the CSV and preview again.');
      const payload = reviewed.map(r => ({ name:r.name, normalized_name:r.normalizedName, email:r.normalizedEmail || null, normalized_email:r.normalizedEmail || null }));
      const result = await serviceFetch(s, 'rpc/admin_commit_attendance_roster_import', { method:'POST', body:JSON.stringify({ p_actor:userId,p_cohort_id:cohortId,p_file_name:(body.fileName as string).trim(),p_rows:payload }) });
      if (!result.ok) return fail(503, 'Roster import could not be saved.');
      const value = await result.json();
      if (!value || (value as {ok?:boolean}).ok !== true) return fail(409, 'Roster changed during review; preview again.');
      return json({ import: value }, 201);
    }
    const session = (await rows<{id:string;cohort_id:string;duration_minutes:number}>(s, `attendance_sessions?id=eq.${sessionId}&select=id,cohort_id,duration_minutes&limit=1`))[0];
    if (!session || session.cohort_id !== cohortId) return fail(404, 'Session not found.');
    const durationHeader = mapping(body, 'durationHeader', headers)!;
    const joinedAtHeader = mapping(body, 'joinedAtHeader', headers, false);
    const candidates = await rows<{id:string;full_name:string;normalized_name:string}>(s, `attendance_participants?cohort_id=eq.${cohortId}&active=eq.true&select=id,full_name,normalized_name&limit=2000`);
    const preview = previewAttendanceRows(headers,csvRows,nameHeader,durationHeader,joinedAtHeader,candidates.map(p=>({id:p.id,name:p.full_name}))).map(row => ({
      ...row,
      candidates: candidates.filter(candidate => normalizeName(candidate.full_name) === row.normalizedName).map(candidate => ({ id: candidate.id, name: candidate.full_name })),
    }));
    if (!confirm) return json({ preview, counts: countBy(preview,'status') });
    if (!Array.isArray(body.decisions) || body.decisions.length !== preview.length) return fail(400, 'A decision is required for every report row.');
    const repeated = new Set(preview.filter(r=>r.duplicateSourceName).map(r=>r.normalizedName));
    const decisions = body.decisions as unknown[];
    const finalRows = preview.map((row,i) => {
      const d=decisions[i]; if (!rec(d) || d.rowNumber !== row.rowNumber || row.duration === null || !row.normalizedName) throw new Error('decision');
      const participantId = d.participantId;
      if (participantId === null && d.unmatched === true) return { row_number:row.rowNumber,name:row.name,normalized_name:row.normalizedName,duration_seconds:row.duration,joined_at:row.joinedAt||null,participant_id:null,decision:'unmatched' };
      if (typeof participantId !== 'string' || !UUID.test(participantId)) throw new Error('decision');
      const selected = candidates.find(c=>c.id===participantId);
      if (!selected || normalizeName(selected.full_name)!==row.normalizedName) throw new Error('decision');
      return { row_number:row.rowNumber,name:row.name,normalized_name:row.normalizedName,duration_seconds:row.duration,joined_at:row.joinedAt||null,participant_id:participantId,decision:'matched' };
    });
    const participantIds=finalRows.filter(r=>r.participant_id).map(r=>r.participant_id);
    if (new Set(participantIds).size !== participantIds.length) return fail(409,'Repeated names or duplicate session participants require separate review; no attendance was saved.');
    finalRows.forEach(r => { (r as typeof r & { duplicate_name?: boolean }).duplicate_name = repeated.has(r.normalized_name); });
    const result = await serviceFetch(s,'rpc/admin_commit_attendance_report_import',{method:'POST',body:JSON.stringify({p_actor:userId,p_cohort_id:cohortId,p_session_id:sessionId,p_file_name:(body.fileName as string).trim(),p_rows:finalRows})});
    if (!result.ok) return fail(503,'Attendance import could not be saved.');
    const value=await result.json(); if (!value || (value as {ok?:boolean}).ok!==true) return fail(409,'Session or roster changed, or attendance already exists; refresh and review again.');
    return json({import:value},201);
  } catch (e) {
    if (e instanceof SyntaxError || e instanceof RangeError || e instanceof TypeError || (e instanceof Error && ['input','mapping','decision'].includes(e.message))) return fail(400,'CSV, mapping, or review decisions are invalid.');
    return fail(503,'Attendance imports are temporarily unavailable.');
  }
}
function countBy<T extends {status:string}>(items:T[], key:'status') { return items.reduce<Record<string,number>>((acc,item)=>{acc[item[key]]=(acc[item[key]]||0)+1;return acc;},{}); }
