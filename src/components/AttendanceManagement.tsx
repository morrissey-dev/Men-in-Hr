import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, Clock3, Link2, Pencil, Plus, RefreshCcw, X } from 'lucide-react';
import { adminRequest } from '../lib/admin-auth';
import { PROGRAMME_MODULES } from '../lib/programme-modules';
import AttendanceImportWorkflow from './AttendanceImportWorkflow';
import AttendanceReports from './AttendanceReports';

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
  const [editingSessionId, setEditingSessionId] = useState('');
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
        method: editingSessionId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...(editingSessionId ? { sessionId: editingSessionId } : {}),
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
      setEditingSessionId('');
      setMessage(editingSessionId ? 'Session details updated.' : 'Session created. You can now review and import its attendance CSV below.');
      await loadSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create the session.');
    } finally {
      setSaving(false);
    }
  }

  function editSession(session: AttendanceSession) {
    const localDate = new Date(new Date(session.scheduled_at).getTime() - new Date(session.scheduled_at).getTimezoneOffset() * 60_000)
      .toISOString().slice(0, 16);
    setEditingSessionId(session.id);
    setCohortId(session.cohort_id);
    setSessionNumber(String(session.session_number));
    setTitle(session.title);
    setScheduledAt(localDate);
    setDurationMinutes(String(session.duration_minutes));
    setMeetingUrl(session.meeting_url || '');
    setError('');
    setMessage('');
    document.getElementById('attendance-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelEdit() {
    setEditingSessionId('');
    setTitle('');
    setScheduledAt('');
    setMeetingUrl('');
    setSessionNumber('1');
    setDurationMinutes('60');
  }

  const plannedCount = sessions.filter(session => session.status === 'planned').length;
  const completedCount = sessions.filter(session => session.status === 'completed').length;

  return <section className="attendance-management" aria-labelledby="attendance-heading">
    <div className="admin-list-header">
      <h3 id="attendance-heading">Attendance management</h3>
      <p>Create the programme sessions here, then import reviewed cohort rosters and tracker reports through the private coordinator workflow.</p>
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
        <div><span className="eyebrow"><i /> SESSION SETUP</span><h4>{editingSessionId ? 'Edit session details' : 'Create a session'}</h4></div>
        <CalendarDays size={25} aria-hidden="true"/>
      </div>
      <div className="admin-form-grid">
        <div>
          <label htmlFor="attendance-cohort">Cohort</label>
          <select id="attendance-cohort" required disabled={Boolean(editingSessionId)} value={cohortId} onChange={event => setCohortId(event.target.value)}>
            <option value="" disabled>Select a cohort</option>
            {cohorts.map(cohort => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="attendance-number">Session number</label>
          <input id="attendance-number" type="number" min="1" max="20" required value={sessionNumber} onChange={event => setSessionNumber(event.target.value)}/>
        </div>
        <div className="attendance-field-wide">
          <label htmlFor="attendance-module">Programme module</label>
          <select
            id="attendance-module"
            value={PROGRAMME_MODULES.find(module => module.title === title)?.id ?? 'custom'}
            onChange={event => {
              const module = PROGRAMME_MODULES.find(item => item.id === event.target.value);
              if (module) setTitle(module.title);
              else if (PROGRAMME_MODULES.some(item => item.title === title)) setTitle('');
            }}
            aria-describedby="attendance-module-hint"
          >
            <option value="custom">Custom topic</option>
            {PROGRAMME_MODULES.map(module => <option key={module.id} value={module.id}>{module.title}</option>)}
          </select>
          <span className="attendance-field-hint" id="attendance-module-hint">Choose one of the programme modules to fill the session title, or keep a custom topic.</span>
        </div>
        <div className="attendance-field-wide">
          <label htmlFor="attendance-title">Session topic / title</label>
          <input id="attendance-title" type="text" minLength={4} maxLength={160} required value={title} onChange={event => setTitle(event.target.value)} placeholder="Select a module above or enter a custom session title"/>
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
          {editingSessionId ? <Pencil size={16}/> : <Plus size={16}/>}{saving ? 'Saving…' : editingSessionId ? 'Save session' : 'Create session'}
        </button>
        {editingSessionId && <button className="button button--outline" type="button" disabled={saving} onClick={cancelEdit}><X size={16}/>Cancel edit</button>}
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
          <button type="button" className="button button--outline" onClick={() => editSession(session)}><Pencil size={16}/> Edit details</button>
        </article>)}
      </div>}

    <AttendanceImportWorkflow cohorts={cohorts} sessions={sessions}/>
    <AttendanceReports cohorts={cohorts}/>

    <aside className="attendance-next-step">
      <strong>Attendance import privacy</strong>
      <p>Only explicit, coordinator-confirmed participant matches are recorded. A participant without a row is not marked absent. The system does not connect to Google Meet or the association Gmail account.</p>
    </aside>
  </section>;
}
