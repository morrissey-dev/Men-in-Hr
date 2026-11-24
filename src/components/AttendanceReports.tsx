import { useEffect, useState } from 'react';
import { Download, FileBarChart2, RefreshCcw } from 'lucide-react';
import { adminDownload, adminRequest } from '../lib/admin-auth';

type Cohort = { id: string; name: string };
type Participant = { id: string; name: string; active: boolean };
type SessionSummary = {
  id: string; session_number: number; title: string; scheduled_at: string;
  duration_minutes: number; status: string; confirmedImportCount: number;
  currentRosterCount: number; recordedParticipantCount: number;
  noAttendanceRecordCount: number | null; totalRecordedSeconds: number;
  averageRecordedPercent: number | null;
};
type CohortReport = { cohortId: string; participantCount: number; participants: Participant[]; sessions: SessionSummary[]; unmatched: unknown[] };
type HistorySession = Pick<SessionSummary, 'id'|'session_number'|'title'|'scheduled_at'|'duration_minutes'|'status'>;
type ParticipantHistory = {
  participant: Participant;
  sessions: Array<HistorySession & { attendedSeconds: number | null; attendancePercent: number | null; hasAttendanceRecord: boolean }>;
};

export default function AttendanceReports({ cohorts }: { cohorts: Cohort[] }) {
  const [cohortId, setCohortId] = useState('');
  const [report, setReport] = useState<CohortReport | null>(null);
  const [participantId, setParticipantId] = useState('');
  const [history, setHistory] = useState<ParticipantHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => { if (!cohortId && cohorts.length) setCohortId(cohorts[0]!.id); }, [cohortId, cohorts]);
  useEffect(() => {
    if (!cohortId) { setReport(null); setHistory(null); setParticipantId(''); return; }
    let active = true;
    setLoading(true); setError(''); setReport(null); setHistory(null); setParticipantId('');
    void adminRequest<CohortReport>(`attendance/imports?report=cohort&cohort=${encodeURIComponent(cohortId)}`)
      .then(value => { if (active) setReport(value); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Unable to load cohort attendance reports.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cohortId, refreshToken]);
  useEffect(() => {
    if (!cohortId || !participantId) { setHistory(null); return; }
    let active = true;
    setLoading(true); setError('');
    void adminRequest<ParticipantHistory>(`attendance/imports?report=participant&cohort=${encodeURIComponent(cohortId)}&participant=${encodeURIComponent(participantId)}`)
      .then(value => { if (active) setHistory(value); })
      .catch(e => { if (active) { setHistory(null); setError(e instanceof Error ? e.message : 'Unable to load participant attendance history.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cohortId, participantId, refreshToken]);

  async function download(path: string, fileName: string) {
    setExporting(true); setError('');
    try { await adminDownload(path, fileName); }
    catch (e) { setError(e instanceof Error ? e.message : 'The attendance export could not be prepared.'); }
    finally { setExporting(false); }
  }

  const query = `cohort=${encodeURIComponent(cohortId)}`;
  return <section className="attendance-reports" aria-labelledby="attendance-reports-title">
    <div className="attendance-list-toolbar">
      <div><span className="eyebrow"><i /> PRIVATE ATTENDANCE REPORTS</span><h4 id="attendance-reports-title">History &amp; cohort summaries</h4><p>Only confirmed attendance records are shown. A missing record is not treated as an absence.</p></div>
      <FileBarChart2 size={23} aria-hidden="true"/>
    </div>
    <div className="admin-panel attendance-report-panel">
      <div className="admin-form-grid">
        <div><label htmlFor="report-cohort">Cohort</label><select id="report-cohort" value={cohortId} onChange={event => setCohortId(event.target.value)}><option value="">Select a cohort</option>{cohorts.map(cohort => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></div>
        <div><label htmlFor="report-participant">Participant history</label><select id="report-participant" value={participantId} onChange={event => setParticipantId(event.target.value)} disabled={!report || report.participants.length === 0}><option value="">Select a participant</option>{report?.participants.map(person => <option key={person.id} value={person.id}>{person.name}{person.active ? '' : ' (inactive)'}</option>)}</select></div>
      </div>
      <div className="attendance-form-actions">
        <button type="button" className="button button--outline" disabled={loading || !cohortId} onClick={() => setRefreshToken(value => value + 1)}><RefreshCcw size={16}/> Refresh</button>
        <button type="button" className="button button--outline" disabled={exporting || !report} onClick={() => void download(`attendance/imports?report=cohort&${query}&export=csv`, 'attendance-cohort-summary.csv')}><Download size={16}/> Export cohort summary</button>
        <button type="button" className="button button--outline" disabled={exporting || !report?.unmatched.length} onClick={() => void download(`attendance/imports?report=unmatched&${query}&export=csv`, 'attendance-unmatched-rows.csv')}><Download size={16}/> Export unmatched rows ({report?.unmatched.length ?? 0})</button>
        <button type="button" className="button button--outline" disabled={exporting || !participantId || !history} onClick={() => void download(`attendance/imports?report=participant&${query}&participant=${encodeURIComponent(participantId)}&export=csv`, 'attendance-participant-history.csv')}><Download size={16}/> Export participant history</button>
      </div>
    </div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {loading && <p role="status">Loading attendance reports…</p>}
    {report && <>
      <div className="attendance-summary" aria-label="Cohort attendance summary">
        <article className="attendance-summary-card"><strong>{report.participantCount}</strong><span>Active roster participants</span></article>
        <article className="attendance-summary-card"><strong>{report.sessions.length}</strong><span>Programme sessions</span></article>
        <article className="attendance-summary-card"><strong>{report.unmatched.length}</strong><span>Unmatched report rows</span></article>
      </div>
      <div className="attendance-preview-table-wrap"><table className="attendance-preview-table"><thead><tr><th scope="col">Session</th><th scope="col">Topic</th><th scope="col">Scheduled</th><th scope="col">Confirmed reports</th><th scope="col">Attendance records</th><th scope="col">Active roster with no record</th><th scope="col">Total recorded time</th><th scope="col">Average recorded percent</th></tr></thead><tbody>{report.sessions.map(session => <tr key={session.id}><th scope="row">{session.session_number}</th><td>{session.title}</td><td>{new Date(session.scheduled_at).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}</td><td>{session.confirmedImportCount}</td><td>{session.recordedParticipantCount}</td><td>{session.noAttendanceRecordCount === null ? 'No report confirmed' : session.noAttendanceRecordCount}</td><td>{session.totalRecordedSeconds} sec</td><td>{session.averageRecordedPercent === null ? '—' : `${session.averageRecordedPercent}%`}</td></tr>)}</tbody></table></div>
      <aside className="attendance-next-step"><strong>Reading these totals</strong><p>“Active roster with no record” compares the current active register with confirmed records. It is not an absence decision. Percentages show recorded attendance duration divided by planned session duration; there are no present/partial/absent thresholds.</p></aside>
    </>}
    {history && <div className="attendance-participant-history"><div className="attendance-list-toolbar"><div><h5>{history.participant.name}</h5><p>{history.participant.active ? 'Active roster participant' : 'Inactive roster participant'} · one row per programme session</p></div></div><div className="attendance-preview-table-wrap"><table className="attendance-preview-table"><thead><tr><th scope="col">Session</th><th scope="col">Topic</th><th scope="col">Scheduled</th><th scope="col">Recorded duration</th><th scope="col">Percent of planned time</th><th scope="col">Record</th></tr></thead><tbody>{history.sessions.map(session => <tr key={session.id}><th scope="row">{session.session_number}</th><td>{session.title}</td><td>{new Date(session.scheduled_at).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}</td><td>{session.attendedSeconds === null ? '—' : `${session.attendedSeconds} sec`}</td><td>{session.attendancePercent === null ? '—' : `${session.attendancePercent}%`}</td><td>{session.hasAttendanceRecord ? 'Recorded' : 'No attendance record'}</td></tr>)}</tbody></table></div></div>}
  </section>;
}
