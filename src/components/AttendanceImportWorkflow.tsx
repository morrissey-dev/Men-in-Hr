import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { AlertCircle, CheckCircle2, ClipboardCheck, FileUp, Users } from 'lucide-react';
import { adminDownload, adminRequest } from '../lib/admin-auth';

type Cohort = { id: string; name: string };
type Session = { id: string; cohort_id: string; session_number: number; title: string; duration_minutes: number; scheduled_at: string };
type RosterRow = { rowNumber: number; name: string; email: string; normalizedEmail: string; status: 'new'|'duplicate'|'invalid'; issues: string[] };
type Candidate = { id: string; name: string };
type AttendanceRow = { rowNumber: number; name: string; duration: number|null; joinedAt: string; status: 'suggested'|'ambiguous'|'unmatched'|'invalid'; suggestedMatch: Candidate|null; candidateCount: number; candidates: Candidate[]; duplicateSourceName: boolean; issues: string[] };
type Counts = Record<string, number>;
type SessionSummary = { session: Session; confirmedMatches: number; participantCount?: number; noAttendanceRecordCount?: number; imports: { id: string; rowCount: number; summary: Record<string, unknown>; confirmedAt: string }[] };
type ImportResponse = { preview: RosterRow[]|AttendanceRow[]; counts: Counts; import?: { id: string; rowCount: number } };
type Mode = 'roster'|'report';

function csvHeaders(text: string): string[] {
  const input = text.replace(/^\uFEFF/, '');
  const headers: string[] = [];
  let field = ''; let quoted = false; let afterQuote = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i += 1; }
        else { quoted = false; afterQuote = true; }
      } else field += ch;
      continue;
    }
    if (afterQuote) {
      if (ch === ',') { headers.push(field.trim()); field = ''; afterQuote = false; }
      else if (ch === '\r' || ch === '\n') { headers.push(field.trim()); return headers; }
      else if (ch !== ' ' && ch !== '\t') throw new Error('The first CSV row has invalid quote formatting.');
      continue;
    }
    if (ch === '"' && field.length === 0) quoted = true;
    else if (ch === ',') { headers.push(field.trim()); field = ''; }
    else if (ch === '\r' || ch === '\n') { headers.push(field.trim()); return headers; }
    else field += ch;
  }
  if (quoted) throw new Error('The CSV header contains an unclosed quote.');
  headers.push(field.trim());
  return headers;
}

export default function AttendanceImportWorkflow({ cohorts, sessions }: { cohorts: Cohort[]; sessions: Session[] }) {
  const [mode, setMode] = useState<Mode>('roster');
  const [cohortId, setCohortId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [nameHeader, setNameHeader] = useState('');
  const [emailHeader, setEmailHeader] = useState('');
  const [durationHeader, setDurationHeader] = useState('');
  const [joinedAtHeader, setJoinedAtHeader] = useState('');
  const [preview, setPreview] = useState<RosterRow[]|AttendanceRow[]|null>(null);
  const [counts, setCounts] = useState<Counts>({});
  const [decisions, setDecisions] = useState<Record<number, string|null|undefined>>({});
  const [summary, setSummary] = useState<SessionSummary|null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const selectedSessions = useMemo(() => sessions.filter(session => session.cohort_id === cohortId), [sessions, cohortId]);
  const selectedSession = selectedSessions.find(session => session.id === sessionId) || null;

  useEffect(() => { if (!cohortId && cohorts.length) setCohortId(cohorts[0].id); }, [cohortId, cohorts]);
  useEffect(() => {
    if (!selectedSessions.some(session => session.id === sessionId)) setSessionId(selectedSessions[0]?.id || '');
  }, [selectedSessions, sessionId]);
  useEffect(() => { setPreview(null); setDecisions({}); setSummary(null); }, [mode, cohortId, sessionId]);
  useEffect(() => {
    if (mode !== 'report' || !cohortId || !sessionId) { setSummary(null); return; }
    let active = true;
    void adminRequest<{ sessions: SessionSummary[] }>(`attendance/imports?cohort=${encodeURIComponent(cohortId)}&session=${encodeURIComponent(sessionId)}`)
      .then(result => { if (active) setSummary(result.sessions?.[0] || null); })
      .catch(() => { if (active) setSummary(null); });
    return () => { active = false; };
  }, [mode, cohortId, sessionId, message]);

  function resetFile() { setFileName(''); setCsv(''); setHeaders([]); setNameHeader(''); setEmailHeader(''); setDurationHeader(''); setJoinedAtHeader(''); setPreview(null); setCounts({}); setDecisions({}); }
  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    setError(''); setMessage(''); resetFile();
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 500 * 1024) { setError('Choose a CSV file no larger than 500 KB.'); return; }
    try {
      const text = await file.text();
      const columns = csvHeaders(text);
      if (!columns.length || columns.some(column => !column) || new Set(columns).size !== columns.length) throw new Error('Each column needs a unique, non-empty header.');
      setFileName(file.name); setCsv(text); setHeaders(columns);
      const guess = (tests: RegExp[]) => columns.find(column => tests.some(test => test.test(column.toLowerCase()))) || '';
      const name = guess([/^name$/, /participant.*name/, /^full.?name$/, /^attendee/]);
      setNameHeader(name || columns[0] || '');
      setEmailHeader(guess([/^email$/, /e.?mail/ ]));
      setDurationHeader(guess([/duration/, /time.?in/, /attendance.?time/, /total.?time/]));
      setJoinedAtHeader(guess([/joined.?at/, /first.?join/, /join.?time/, /start.?time/]));
    } catch (e) { setError(e instanceof Error ? e.message : 'The CSV headers could not be read.'); }
  }

  function requestBody(action: string) {
    return {
      action, cohortId, fileName, csv, nameHeader,
      ...(mode === 'roster' ? { emailHeader } : { sessionId, durationHeader, joinedAtHeader }),
    };
  }

  async function makePreview() {
    setError(''); setMessage(''); setBusy(true); setPreview(null); setDecisions({});
    try {
      const action = mode === 'roster' ? 'roster-preview' : 'report-preview';
      const result = await adminRequest<ImportResponse>('attendance/imports', { method: 'POST', body: JSON.stringify(requestBody(action)) });
      setPreview(result.preview || []); setCounts(result.counts || {});
      if (mode === 'report') {
        const rows = result.preview as AttendanceRow[];
        setDecisions(Object.fromEntries(rows.filter(row => row.status === 'invalid').map(row => [row.rowNumber, undefined])));
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'The CSV could not be previewed.'); }
    finally { setBusy(false); }
  }

  const rosterRows = mode === 'roster' ? (preview as RosterRow[]|null) : null;
  const reportRows = mode === 'report' ? (preview as AttendanceRow[]|null) : null;
  const hasInvalid = mode === 'roster'
    ? Boolean(rosterRows?.some(row => row.status !== 'new'))
    : Boolean(reportRows?.some(row => row.status === 'invalid' || decisions[row.rowNumber] === undefined));
  const selectedParticipantIds = reportRows?.map(row => decisions[row.rowNumber]).filter((id): id is string => typeof id === 'string') || [];
  const hasDuplicateParticipantChoice = new Set(selectedParticipantIds).size !== selectedParticipantIds.length;

  async function confirmImport() {
    if (!preview || hasInvalid || hasDuplicateParticipantChoice) return;
    const subject = mode === 'roster' ? `${rosterRows?.length || 0} participant roster row(s)` : `${reportRows?.length || 0} reviewed attendance row(s)`;
    if (!window.confirm(`Confirm importing ${subject} for the selected ${mode === 'roster' ? 'cohort' : 'session'}? Only explicitly matched attendance rows will be recorded; unmatched rows will not be treated as absences.`)) return;
    setError(''); setMessage(''); setBusy(true);
    try {
      const action = mode === 'roster' ? 'roster-confirm' : 'report-confirm';
      const body = requestBody(action) as Record<string, unknown>;
      body.confirm = true;
      if (mode === 'report') body.decisions = reportRows!.map(row => {
        const participantId = decisions[row.rowNumber];
        return { rowNumber: row.rowNumber, participantId: participantId === null ? null : participantId, ...(participantId === null ? { unmatched: true } : {}) };
      });
      const result = await adminRequest<ImportResponse>('attendance/imports', { method: 'POST', body: JSON.stringify(body) });
      const imported = result.import?.rowCount ?? preview.length;
      setMessage(mode === 'roster' ? `Imported ${imported} participant(s).` : `Saved the attendance review for ${imported} CSV row(s). Only confirmed matches create attendance records.`);
      resetFile(); setPreview(null); setCounts({}); setDecisions({});
    } catch (e) { setError(e instanceof Error ? e.message : 'The import could not be saved. Review the source file and try again.'); }
    finally { setBusy(false); }
  }

  async function downloadAttendance() {
    if (!selectedSession) return;
    setError(''); setBusy(true);
    try {
      const query = `cohort=${encodeURIComponent(cohortId)}&session=${encodeURIComponent(selectedSession.id)}&export=csv`;
      await adminDownload(`attendance/imports?${query}`, `attendance-session-${selectedSession.session_number}.csv`);
    } catch (e) { setError(e instanceof Error ? e.message : 'The attendance export could not be prepared.'); }
    finally { setBusy(false); }
  }

  return <section className="attendance-import-workflow" aria-labelledby="attendance-import-title">
    <div className="attendance-list-toolbar"><div><span className="eyebrow"><i /> PRIVATE COORDINATOR WORKFLOW</span><h4 id="attendance-import-title">Roster &amp; attendance imports</h4><p>CSV files are parsed in memory, previewed by the server and never retained as uploaded files.</p></div><ClipboardCheck size={23} aria-hidden="true"/></div>
    <div className="attendance-import-mode" role="group" aria-label="Import type"><button type="button" aria-pressed={mode==='roster'} className={mode==='roster'?'active':''} onClick={() => { setMode('roster'); setMessage(''); setError(''); }}>Participant roster</button><button type="button" aria-pressed={mode==='report'} className={mode==='report'?'active':''} onClick={() => { setMode('report'); setMessage(''); setError(''); }}>Attendance report</button></div>
    <div className="admin-panel attendance-import-panel">
      <div className="admin-form-grid">
        <div><label htmlFor="import-cohort">Cohort</label><select id="import-cohort" value={cohortId} onChange={event => setCohortId(event.target.value)}><option value="">Select a cohort</option>{cohorts.map(cohort => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></div>
        {mode === 'report' && <div><label htmlFor="import-session">Session</label><select id="import-session" value={sessionId} onChange={event => setSessionId(event.target.value)}><option value="">Select a session</option>{selectedSessions.map(session => <option key={session.id} value={session.id}>Session {session.session_number}: {session.title}</option>)}</select></div>}
        <div className="attendance-field-wide"><label htmlFor="attendance-csv">{mode === 'roster' ? 'Participant roster CSV' : 'Attendance tracker CSV'}</label><input id="attendance-csv" type="file" accept=".csv,text/csv" onChange={event => void chooseFile(event)} disabled={busy}/><span className="attendance-field-hint">CSV only · 500 KB maximum · 1,000 data rows maximum · not saved in the website.</span></div>
        {headers.length > 0 && <>
          <div><label htmlFor="csv-name-header">Participant name column</label><select id="csv-name-header" value={nameHeader} onChange={event => setNameHeader(event.target.value)}>{headers.map(header => <option key={header} value={header}>{header}</option>)}</select></div>
          {mode === 'roster' ? <div><label htmlFor="csv-email-header">Email column (optional)</label><select id="csv-email-header" value={emailHeader} onChange={event => setEmailHeader(event.target.value)}><option value="">No email column</option>{headers.map(header => <option key={header} value={header}>{header}</option>)}</select></div> : <>
            <div><label htmlFor="csv-duration-header">Duration attended column</label><select id="csv-duration-header" value={durationHeader} onChange={event => setDurationHeader(event.target.value)}><option value="">Select a duration column</option>{headers.map(header => <option key={header} value={header}>{header}</option>)}</select></div>
            <div><label htmlFor="csv-joined-header">Joined-at column (optional)</label><select id="csv-joined-header" value={joinedAtHeader} onChange={event => setJoinedAtHeader(event.target.value)}><option value="">No join-time column</option>{headers.map(header => <option key={header} value={header}>{header}</option>)}</select></div>
          </>}
        </>}
      </div>
      {mode === 'report' && selectedSession && <p className="attendance-field-hint">Attendance is compared with the planned {selectedSession.duration_minutes}-minute session. Stop time is not used to infer presence or absence.</p>}
      <div className="attendance-form-actions"><button type="button" className="button button--dark" onClick={() => void makePreview()} disabled={busy || !cohortId || !csv || !nameHeader || (mode==='report' && (!sessionId || !durationHeader))}><FileUp size={16}/>{busy ? 'Working…' : 'Preview CSV'}</button><button type="button" className="button button--outline" onClick={resetFile} disabled={busy || !csv}>Clear file</button></div>
    </div>

    {error && <p className="admin-error" role="alert">{error}</p>}{message && <p className="admin-success" role="status">{message}</p>}
    {mode === 'report' && summary && summary.imports.length > 0 && <aside className="attendance-next-step"><strong>Latest confirmed report</strong><p>{summary.confirmedMatches} confirmed participant record(s). {summary.participantCount ?? 0} active participant(s) have no attendance row in that report; this is not a claim of absence.</p>{summary.confirmedMatches > 0 && <button type="button" className="button button--outline" disabled={busy} onClick={() => void downloadAttendance()}>Download minimal attendance CSV</button>}</aside>}
    {preview && <div className="attendance-preview" aria-labelledby="csv-preview-title">
      <div className="attendance-preview-heading"><div><h5 id="csv-preview-title">Review before saving: {fileName}</h5><p>{preview.length} data row(s). No data is stored until you confirm.</p></div><Users size={20} aria-hidden="true"/></div>
      <div className="attendance-import-counts" aria-label="Preview status summary">{Object.entries(counts).map(([status,count]) => <span key={status}><strong>{count}</strong> {status}</span>)}</div>
      {mode === 'roster' && rosterRows && <div className="attendance-preview-table-wrap"><table className="attendance-preview-table"><thead><tr><th scope="col">Row</th><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Review</th></tr></thead><tbody>{rosterRows.map(row => <tr key={row.rowNumber}><th scope="row">{row.rowNumber}</th><td>{row.name || '—'}</td><td>{row.email || '—'}</td><td><span className={`admin-status ${row.status==='new'?'admin-status--approved':''}`}>{row.status}</span>{row.issues.length > 0 && <small>{row.issues.join(' ')}</small>}</td></tr>)}</tbody></table></div>}
      {mode === 'report' && reportRows && <div className="attendance-report-preview">{reportRows.map(row => <article className="attendance-report-row" key={row.rowNumber}><div className="attendance-report-row__facts"><strong>Row {row.rowNumber}: {row.name || 'Name missing'}</strong><span>{row.duration === null ? 'Duration invalid' : `${row.duration} seconds attended`}{row.joinedAt ? ` · Joined at ${row.joinedAt}` : ''}</span><span className={`admin-status ${row.status==='suggested'?'admin-status--approved':''}`}>{row.status}{row.duplicateSourceName ? ' · repeated name in report' : ''}</span>{row.issues.length > 0 && <small>{row.issues.join(' ')}</small>}{row.suggestedMatch && <small>Suggested exact-name match: {row.suggestedMatch.name}. Please confirm the participant below.</small>}</div>{row.status !== 'invalid' && <div><label htmlFor={`match-row-${row.rowNumber}`}>Coordinator decision for row {row.rowNumber}</label><select id={`match-row-${row.rowNumber}`} value={decisions[row.rowNumber] === null ? '__unmatched__' : decisions[row.rowNumber] || ''} onChange={event => setDecisions(current => ({ ...current, [row.rowNumber]: event.target.value === '__unmatched__' ? null : event.target.value || undefined }))}><option value="">Choose an exact-name match or leave unmatched</option>{row.candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}<option value="__unmatched__">Leave unmatched (no attendance record)</option></select></div>}</article>)}</div>}
      {hasDuplicateParticipantChoice && <p className="admin-error" role="alert">One participant is selected on more than one row. Choose only one attendance row per participant; no durations are combined automatically.</p>}
      {hasInvalid && <p className="attendance-field-hint"><AlertCircle size={15} aria-hidden="true"/> Resolve invalid rows or make an explicit decision for every attendance row before confirmation. Roster duplicate/invalid rows must be corrected in the CSV and previewed again.</p>}
      <div className="attendance-form-actions"><button type="button" className="button button--dark" disabled={busy || hasInvalid || hasDuplicateParticipantChoice || preview.length===0} onClick={() => void confirmImport()}><CheckCircle2 size={16}/>{busy ? 'Saving…' : 'Confirm and import'}</button><button type="button" className="button button--outline" disabled={busy} onClick={() => { setPreview(null); setDecisions({}); }}>Cancel review</button></div>
    </div>}
    <aside className="attendance-next-step"><strong>Review rules</strong><p>Rows match only by exact normalized participant name. The coordinator must confirm each match. Unmatched rows stay unmatched; the system never creates absent records or infers absence. Repeated names must be resolved to distinct participants or explicitly left unmatched.</p></aside>
  </section>;
}
