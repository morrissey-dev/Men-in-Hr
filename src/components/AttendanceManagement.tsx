import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, Clock3, Link2, Plus, RefreshCcw } from 'lucide-react';
import { adminRequest } from '../lib/admin-auth';

type Cohort = { id: string; name: string };
type AttendanceSession = {
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

export default function AttendanceManagement({ cohorts }: { cohorts: Cohort[] }) {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [cohortFilter, setCohortFilter] = useState('');
  const [cohortId, setCohortId] = useState('');
  const [sessionNumber, setSessionNumber] = useState('1');
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!cohortId && cohorts.length) setCohortId(cohorts[0].id);
  }, [cohortId, cohorts]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = cohortFilter ? `?cohort=${encodeURIComponent(cohortFilter)}` : '';
      const result = await adminRequest<{ sessions: AttendanceSession[] }>(`attendance/sessions${query}`);
      setSessions(result.sessions);
    } catch (e) {
      setSessions([]);
      setError(e instanceof Error ? e.message : 'Unable to load attendance sessions.');
    } finally {
      setLoading(false);
    }
  }, [cohortFilter]);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  async function createSession(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await adminRequest<{ session: AttendanceSession }>('attendance/sessions', {
        method: 'POST',
        body: JSON.stringify({
          cohortId,
          sessionNumber: Number(sessionNumber),
          title,
          scheduledAt: new Date(scheduledAt).toISOString(),
          durationMinutes: Number(durationMinutes),
          meetingUrl: meetingUrl.trim() || null,
        }),
      });
      setTitle('');
      setScheduledAt('');
      setMeetingUrl('');
      setMessage('Session created. Attendance report import will be added in the next increment.');
      await loadSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create the session.');
    } finally {
      setSaving(false);
    }
  }

  const plannedCount = sessions.filter(session => session.status === 'planned').length;
  const completedCount = sessions.filter(session => session.status === 'completed').length;

  return <section className="attendance-management" aria-labelledby="attendance-heading">
    <div className="admin-list-header">
      <h3 id="attendance-heading">Attendance management</h3>
      <p>Create the programme sessions here. Reports from your attendance-tracker extension will be uploaded and matched to the participant register in the next increment.</p>
    </div>

    <div className="attendance-summary" aria-label="Session summary">
      <article className="attendance-summary-card"><strong>{sessions.length}</strong><span>Sessions listed</span></article>
      <article className="attendance-summary-card"><strong>{plannedCount}</strong><span>Planned</span></article>
      <article className="attendance-summary-card"><strong>{completedCount}</strong><span>Completed</span></article>
    </div>

    {error && <p className="admin-error" role="alert">{error}</p>}
    {message && <p className="admin-success" role="status">{message}</p>}

    <form className="admin-panel attendance-create-form" onSubmit={createSession}>
      <div className="attendance-form-heading">
        <div><span className="eyebrow"><i /> SESSION SETUP</span><h4>Create a session</h4></div>
        <CalendarDays size={25} aria-hidden="true"/>
      </div>
      <div className="admin-form-grid">
        <div>
          <label htmlFor="attendance-cohort">Cohort</label>
          <select id="attendance-cohort" required value={cohortId} onChange={event => setCohortId(event.target.value)}>
            <option value="" disabled>Select a cohort</option>
            {cohorts.map(cohort => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="attendance-number">Session number</label>
          <input id="attendance-number" type="number" min="1" max="20" required value={sessionNumber} onChange={event => setSessionNumber(event.target.value)}/>
        </div>
        <div className="attendance-field-wide">
          <label htmlFor="attendance-title">Session topic / title</label>
          <input id="attendance-title" type="text" minLength={4} maxLength={160} required value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Self-Discovery, Personal Growth and Goal Setting"/>
        </div>
        <div>
          <label htmlFor="attendance-date">Date and start time</label>
          <input id="attendance-date" type="datetime-local" required value={scheduledAt} onChange={event => setScheduledAt(event.target.value)}/>
          <span className="attendance-field-hint">Uses your device's local time.</span>
        </div>
        <div>
          <label htmlFor="attendance-duration">Planned duration (minutes)</label>
          <input id="attendance-duration" type="number" min="15" max="240" required value={durationMinutes} onChange={event => setDurationMinutes(event.target.value)}/>
        </div>
        <div className="attendance-field-wide">
          <label htmlFor="attendance-meet-link">Google Meet link (optional)</label>
          <input id="attendance-meet-link" type="url" maxLength={500} value={meetingUrl} onChange={event => setMeetingUrl(event.target.value)} placeholder="https://meet.google.com/xxx-xxxx-xxx"/>
          <span className="attendance-field-hint">Visible only inside the authorised admin dashboard.</span>
        </div>
      </div>
      <div className="attendance-form-actions">
        <button className="button button--dark" type="submit" disabled={saving || !cohortId || cohorts.length === 0 || !scheduledAt}>
          <Plus size={16}/>{saving ? 'Creating…' : 'Create session'}
        </button>
      </div>
    </form>

    <div className="attendance-list-toolbar">
      <div><h4>Programme sessions</h4><p>Sessions are kept private to authorised organisers.</p></div>
      <div className="attendance-toolbar-actions">
        <label className="sr-only" htmlFor="attendance-filter">Filter by cohort</label>
        <select id="attendance-filter" value={cohortFilter} onChange={event => setCohortFilter(event.target.value)}>
          <option value="">All cohorts</option>
          {cohorts.map(cohort => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}
        </select>
        <button type="button" className="button button--outline" onClick={() => void loadSessions()} disabled={loading}><RefreshCcw size={16}/> Refresh</button>
      </div>
    </div>

    {loading ? <p role="status">Loading sessions…</p>
      : sessions.length === 0 ? <div className="admin-panel attendance-empty"><CalendarDays size={25}/><p>No sessions have been created yet.</p><span>Create the first session using the form above.</span></div>
      : <div className="attendance-session-list">
        {sessions.map(session => <article className="admin-panel attendance-session-card" key={session.id}>
          <div className="attendance-session-main">
            <span className="attendance-session-number">SESSION {session.session_number}</span>
            <h5>{session.title}</h5>
            <div className="attendance-session-meta">
              <span><CalendarDays size={15}/>{new Date(session.scheduled_at).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              <span><Clock3 size={15}/>{session.duration_minutes} minutes</span>
              {session.meeting_url && <a href={session.meeting_url} target="_blank" rel="noreferrer"><Link2 size={15}/>Open Meet link</a>}
            </div>
          </div>
          <span className={`admin-status attendance-status attendance-status--${session.status}`}>{session.status}</span>
        </article>)}
      </div>}

    <aside className="attendance-next-step">
      <strong>Next: participant register and report import</strong>
      <p>Once you provide a sample export from the tracker extension (with participant details redacted if preferred), we can build the correct column mapping and matching logic. The system will not connect to Google Meet or the association Gmail account.</p>
    </aside>
  </section>;
}
