import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { FileAudio2, FileText, LockKeyhole, RefreshCcw, Share2, ShieldCheck, Users, Video } from 'lucide-react';
import { Upload } from 'tus-js-client';
import { adminRequest } from '../lib/admin-auth';

type Cohort = { id: string; name: string };
type Session = { id: string; cohort_id: string; session_number: number; title: string; scheduled_at: string };
type Participant = { id: string; full_name: string; email: string | null; normalized_email: string | null };
type MemberRosterPage = { participants: Participant[]; nextOffset: number; hasMore: boolean; limitReached: boolean };
type Resource = { id: string; cohort_id: string; session_id: string | null; participant_id: string | null; source_resource_id: string | null; kind: 'recording'|'transcript'|'summary'|'action_items'|'certificate'; status: string; file_name: string | null; content_type: string | null; size_bytes: number | null; content_text: string | null; created_at: string; reviewed_at: string | null };
type Job = { id: string; source_resource_id: string; status: 'queued'|'processing'|'completed'|'failed'; error_code: string | null; created_at: string };
type UploadTicket = { resourceId: string; bucketName: string; objectName: string; uploadToken: string; storageHost: string; contentType: string };

function formatBytes(bytes: number | null) {
  if (!bytes || bytes < 1) return 'Size unavailable';
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function localDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function SessionResources({ cohorts }: { cohorts: Cohort[] }) {
  const [cohortId, setCohortId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantOffset, setParticipantOffset] = useState(0);
  const [hasMoreParticipants, setHasMoreParticipants] = useState(false);
  const [participantLimitReached, setParticipantLimitReached] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [certificateParticipant, setCertificateParticipant] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [shareWithCohort, setShareWithCohort] = useState(true);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const activeUpload = useRef<Upload | null>(null);

  useEffect(() => { if (!cohortId && cohorts.length) setCohortId(cohorts[0].id); }, [cohortId, cohorts]);

  const loadResources = useCallback(async () => {
    if (!cohortId) { setResources([]); setJobs([]); return; }
    try {
      const result = await adminRequest<{ resources: Resource[]; jobs: Job[] }>(`session-resources?cohort=${encodeURIComponent(cohortId)}`);
      setResources(result.resources || []);
      setJobs(result.jobs || []);
    } catch (e) {
      setResources([]);
      setJobs([]);
      setError(e instanceof Error ? e.message : 'Unable to load session resources.');
    }
  }, [cohortId]);

  useEffect(() => {
    if (!cohortId) return;
    let active = true;
    void adminRequest<{ sessions: Session[] }>(`attendance/sessions?cohort=${encodeURIComponent(cohortId)}`)
      .then(result => { if (active) { setSessions(result.sessions || []); setSessionId(current => (result.sessions || []).some(item => item.id === current) ? current : result.sessions?.[0]?.id || ''); } })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Sessions are unavailable.'); });
    setParticipants([]); setParticipantOffset(0); setHasMoreParticipants(false); setParticipantLimitReached(false);
    void adminRequest<MemberRosterPage>(`member-roster?cohort=${encodeURIComponent(cohortId)}`)
      .then(result => { if (active) { setParticipants(result.participants || []); setParticipantOffset(result.nextOffset || 0); setHasMoreParticipants(Boolean(result.hasMore)); setParticipantLimitReached(Boolean(result.limitReached)); setSelectedParticipants([]); setCertificateParticipant(''); } })
      .catch(e => { if (active) { setParticipants([]); setError(e instanceof Error ? e.message : 'Member roster is unavailable.'); } });
    setError('');
    void loadResources();
    return () => { active = false; };
  }, [cohortId, loadResources]);

  useEffect(() => {
    if (!jobs.some(job => job.status === 'queued' || job.status === 'processing')) return;
    const timer = window.setInterval(() => { void loadResources(); }, 5000);
    return () => window.clearInterval(timer);
  }, [jobs, loadResources]);

  useEffect(() => () => { void activeUpload.current?.abort(true); }, []);

  async function uploadFile(kind: 'recording'|'certificate', event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(''); setMessage(''); setBusy(true); setUploadPercent(0);
    try {
      if (kind === 'recording' && !recordingConsent) throw new Error('Confirm that the required recording notice and consent were obtained before uploading.');
      if (kind === 'certificate' && (!certificateParticipant || file.type !== 'application/pdf')) throw new Error('Select a participant and a PDF certificate.');
      const ticket = await adminRequest<UploadTicket>('session-resources', {
        method: 'POST', body: JSON.stringify({
          action: 'sign-upload', kind, cohortId,
          ...(kind === 'recording' ? { sessionId, recordingNoticeAttested: true } : { participantId: certificateParticipant }),
          fileName: file.name, contentType: file.type, size: file.size,
        }),
      });
      await new Promise<void>((resolve, reject) => {
        const upload = new Upload(file, {
          endpoint: `${ticket.storageHost}/storage/v1/upload/resumable`,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: { 'x-signature': ticket.uploadToken },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          metadata: { bucketName: ticket.bucketName, objectName: ticket.objectName, contentType: ticket.contentType, cacheControl: '3600' },
          chunkSize: 6 * 1024 * 1024,
          onProgress: (sent, total) => setUploadPercent(total ? Math.floor(sent / total * 100) : 0),
          onError: () => reject(new Error('The private upload did not complete. Check your connection and try again.')),
          onSuccess: () => resolve(),
        });
        activeUpload.current = upload;
        upload.start();
      });
      await adminRequest('session-resources', { method: 'POST', body: JSON.stringify({ action: 'complete-upload', resourceId: ticket.resourceId }) });
      activeUpload.current = null;
      setUploadPercent(100);
      if (kind === 'recording') setRecordingConsent(false);
      setMessage(kind === 'certificate' ? 'Certificate uploaded and assigned to the selected participant.' : 'Recording uploaded to private storage. The site does not record live meetings.');
      await loadResources();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The upload could not be completed.');
    } finally { setBusy(false); }
  }

  async function loadMoreParticipants() {
    if (!hasMoreParticipants || busy || !cohortId) return;
    setError(''); setBusy(true);
    try {
      const result = await adminRequest<MemberRosterPage>(`member-roster?cohort=${encodeURIComponent(cohortId)}&offset=${participantOffset}`);
      setParticipants(current => {
        const known = new Set(current.map(person => person.id));
        return [...current, ...(result.participants || []).filter(person => !known.has(person.id))];
      });
      setParticipantOffset(result.nextOffset || participantOffset);
      setHasMoreParticipants(Boolean(result.hasMore));
      setParticipantLimitReached(Boolean(result.limitReached));
    } catch (e) { setError(e instanceof Error ? e.message : 'More cohort members could not be loaded.'); }
    finally { setBusy(false); }
  }

  async function resourceAction(resource: Resource, action: string, extra: Record<string, unknown> = {}) {
    setError(''); setMessage(''); setBusy(true);
    try {
      if (action === 'download') {
        const result = await adminRequest<{ url: string }>(`session-resources?download=${encodeURIComponent(resource.id)}`);
        window.location.assign(result.url);
      } else {
        const result = await adminRequest<{ message?: string; recipientCount?: number }>('session-resources', { method: 'POST', body: JSON.stringify({ action, resourceId: resource.id, ...extra }) });
        setMessage(action === 'share' && Number.isSafeInteger(result.recipientCount)
          ? `Shared with ${result.recipientCount} active participant(s).`
          : result.message || 'Action completed.');
        await loadResources();
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'The action could not be completed.'); }
    finally { setBusy(false); }
  }

  async function startAI(resource: Resource) {
    setError(''); setMessage(''); setBusy(true);
    try {
      const { job } = await adminRequest<{ job: Job }>('session-ai-jobs', { method: 'POST', body: JSON.stringify({ resourceId: resource.id }) });
      await adminRequest('session-ai-process', { method: 'POST', body: JSON.stringify({ jobId: job.id }) });
      setMessage('AI processing queued. Any transcript or notes will remain private until you review and approve them.');
      await loadResources();
    } catch (e) { setError(e instanceof Error ? e.message : 'AI processing is unavailable.'); }
    finally { setBusy(false); }
  }

  async function invite(participant: Participant) {
    if (!window.confirm(`Send a member invitation to ${participant.email || 'this participant'}?`)) return;
    setError(''); setMessage(''); setBusy(true);
    try {
      const result = await adminRequest<{ message: string }>('member-invite', { method: 'POST', body: JSON.stringify({ participantId: participant.id }) });
      setMessage(result.message);
    } catch (e) { setError(e instanceof Error ? e.message : 'The member invitation could not be sent.'); }
    finally { setBusy(false); }
  }

  const latestJob = useMemo(() => {
    const latest = new Map<string, Job>();
    for (const job of jobs) if (!latest.has(job.source_resource_id)) latest.set(job.source_resource_id, job);
    return latest;
  }, [jobs]);
  const cohortName = cohorts.find(cohort => cohort.id === cohortId)?.name || 'selected cohort';

  return <section className="session-resource-manager" aria-labelledby="session-resources-heading">
    <div className="admin-list-header">
      <h3 id="session-resources-heading">Recordings, session notes &amp; certificates</h3>
      <p>Record in Google Meet, download the completed file, then upload it here. The site does not join or capture live meetings. Private files are shared only after an organiser chooses recipients.</p>
    </div>
    <div className="resource-scope">
      <div><label htmlFor="resource-cohort">Cohort</label><select id="resource-cohort" value={cohortId} onChange={event => setCohortId(event.target.value)}>{cohorts.map(cohort => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></div>
      <button type="button" className="button button--outline" onClick={() => void loadResources()} disabled={busy}><RefreshCcw size={16}/> Refresh library</button>
    </div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {message && <p className="admin-success" role="status">{message}</p>}
    {busy && uploadPercent > 0 && uploadPercent < 100 && <div className="resource-progress" role="status"><span>Uploading securely: {uploadPercent}%</span><progress max="100" value={uploadPercent}>{uploadPercent}%</progress><button type="button" className="admin-text-button" onClick={() => { void activeUpload.current?.abort(true); activeUpload.current = null; setBusy(false); }}>Cancel upload</button></div>}

    <div className="resource-forms">
      <form className="admin-panel resource-form" onSubmit={event => event.preventDefault()}>
        <div className="attendance-form-heading"><div><span className="eyebrow"><i /> PRIVATE SESSION MEDIA</span><h4>Upload a Meet recording</h4></div><Video size={24} aria-hidden="true"/></div>
        <label htmlFor="recording-session">Session</label>
        <select id="recording-session" required value={sessionId} onChange={event => setSessionId(event.target.value)}><option value="">Choose a session</option>{sessions.map(session => <option key={session.id} value={session.id}>Session {session.session_number}: {session.title}</option>)}</select>
        <label htmlFor="meeting-recording">Audio or video file</label>
        <input id="meeting-recording" type="file" accept="video/mp4,video/webm,audio/mp4,audio/mpeg,audio/wav,audio/webm" disabled={busy || !sessionId} onChange={event => void uploadFile('recording', event)}/>
        <span className="attendance-field-hint">MP4, WebM, MP3 or WAV · maximum 500 MB · resumable private upload. Draft AI processing accepts up to 100 MB by default and needs separate provider/privacy approval.</span>
        <label className="resource-consent"><input type="checkbox" checked={recordingConsent} onChange={event => setRecordingConsent(event.target.checked)}/><span>I confirm the required participant recording notice and consent were obtained before this upload.</span></label>
        <p className="resource-privacy-note"><LockKeyhole size={15}/> Uploads are private. Recording/retention approval must also be enabled by the site operator.</p>
      </form>

      <form className="admin-panel resource-form" onSubmit={event => event.preventDefault()}>
        <div className="attendance-form-heading"><div><span className="eyebrow"><i /> MEMBER CERTIFICATES</span><h4>Upload a certificate</h4></div><FileText size={24} aria-hidden="true"/></div>
        <label htmlFor="certificate-member">Assign to participant</label>
        <select id="certificate-member" required value={certificateParticipant} onChange={event => setCertificateParticipant(event.target.value)}><option value="">Choose a participant</option>{participants.map(person => <option key={person.id} value={person.id}>{person.full_name}{person.email ? ` — ${person.email}` : ''}</option>)}</select>
        <label htmlFor="certificate-file">PDF certificate</label>
        <input id="certificate-file" type="file" accept="application/pdf,.pdf" disabled={busy || !certificateParticipant} onChange={event => void uploadFile('certificate', event)}/>
        <span className="attendance-field-hint">PDF only · maximum 10 MB · visible to the assigned member after sign-in.</span>
        <p className="resource-privacy-note"><ShieldCheck size={15}/> Certificates are stored privately and scoped to the selected member account.</p>
      </form>
    </div>

    <div className="admin-panel resource-members">
      <div className="resource-section-head"><div><h4>Member access</h4><p>Only participants in {cohortName} with a unique approved email can be invited. Up to 200 members are shown per page.</p></div><Users size={21} aria-hidden="true"/></div>
      {participants.length ? <div className="resource-member-list">{participants.map(participant => <div className="resource-member-row" key={participant.id}><div><strong>{participant.full_name}</strong><small>{participant.email || 'No email on the approved roster'}</small></div><button type="button" className="button button--outline" disabled={busy || !participant.normalized_email} onClick={() => void invite(participant)}>Invite member</button></div>)}</div> : <p className="attendance-field-hint">No active roster participants are available for this cohort yet.</p>}
      {hasMoreParticipants && <p><button type="button" className="button button--outline" disabled={busy} onClick={() => void loadMoreParticipants()}>Load next 200 members</button></p>}
      {participantLimitReached && <p className="attendance-field-hint" role="status">The member-management view reached its 5,000-participant safety limit. Whole-cohort sharing will stop rather than silently omit members.</p>}
    </div>

    <div className="resource-share-panel">
      <div className="resource-section-head"><div><h4>Choose member recipients</h4><p>Used when sharing approved recordings or reviewed notes. Certificates are assigned to one participant during upload.</p></div><Share2 size={21} aria-hidden="true"/></div>
      <label className="resource-consent"><input type="checkbox" checked={shareWithCohort} onChange={event => { setShareWithCohort(event.target.checked); setSelectedParticipants([]); }}/><span>Share with the whole active cohort</span></label>
      {!shareWithCohort && <><p className="attendance-field-hint">Selected-member sharing is limited to 200 recipients per request. For a larger audience, share with the full active cohort.</p><div className="resource-recipient-list">{participants.map(person => <label key={person.id}><input type="checkbox" checked={selectedParticipants.includes(person.id)} onChange={event => setSelectedParticipants(current => event.target.checked ? [...current, person.id] : current.filter(id => id !== person.id))}/><span>{person.full_name}</span></label>)}</div></>}
    </div>

    <div className="resource-section-head"><div><h4>Private resource library</h4><p>Coordinator-only until explicitly approved and shared.</p></div><FileAudio2 size={21} aria-hidden="true"/></div>
    {resources.length === 0 ? <div className="admin-panel attendance-empty"><LockKeyhole size={25}/><p>No session resources are available.</p><span>Uploads, transcripts, notes and assigned certificates will appear here.</span></div> : <div className="resource-list">{resources.map(resource => {
      const job = resource.kind === 'recording' ? latestJob.get(resource.id) : null;
      return <article className="admin-panel resource-card" key={resource.id}>
        <div className="resource-card-header"><div><span className="resource-kind">{resource.kind.replace('_', ' ')}</span><h5>{resource.file_name || (resource.kind === 'summary' ? 'Draft session summary' : resource.kind === 'action_items' ? 'Draft action items' : resource.kind === 'transcript' ? 'Draft transcript' : 'Session resource')}</h5><p>{localDate(resource.created_at)} · {formatBytes(resource.size_bytes)}</p></div><span className={`admin-status ${resource.status === 'approved' || resource.status === 'ready' ? 'admin-status--approved' : ''}`}>{resource.status.replace('_', ' ')}</span></div>
        {resource.kind === 'recording' && job && <p className="resource-job" role="status">AI notes: {job.status === 'failed' ? 'processing failed — check approval/provider configuration' : job.status}</p>}
        {resource.content_text && <details className="admin-notes resource-note-content"><summary>Review {resource.kind.replace('_', ' ')}</summary><pre>{resource.content_text}</pre></details>}
        <div className="resource-actions">
          {(resource.kind === 'recording' || resource.kind === 'certificate') && resource.status === 'ready' && <button type="button" className="button button--outline" disabled={busy} onClick={() => void resourceAction(resource, 'download')}>Download securely</button>}
          {resource.kind === 'recording' && resource.status === 'ready' && (!job || job.status === 'failed') && (resource.size_bytes === null || resource.size_bytes <= 100 * 1024 * 1024) && <button type="button" className="button button--outline" disabled={busy} onClick={() => void startAI(resource)}>Generate draft transcript &amp; notes</button>}
          {resource.kind === 'recording' && resource.status === 'ready' && resource.size_bytes !== null && resource.size_bytes > 100 * 1024 * 1024 && !job && <p className="attendance-field-hint">Stored and shareable, but larger than the default AI-processing limit.</p>}
          {['transcript','summary','action_items'].includes(resource.kind) && resource.status === 'pending_review' && <button type="button" className="button button--dark" disabled={busy} onClick={() => void resourceAction(resource, 'approve')}>Approve for sharing</button>}
          {resource.kind !== 'certificate' && (resource.status === 'ready' || resource.status === 'approved') && <button type="button" className="button button--outline" disabled={busy || (!shareWithCohort && (selectedParticipants.length === 0 || selectedParticipants.length > 200))} onClick={() => void resourceAction(resource, 'share', shareWithCohort ? { allParticipants: true } : { participantIds: selectedParticipants })}>Share with {shareWithCohort ? 'cohort' : 'selected members'}</button>}
          {resource.kind !== 'certificate' && <button type="button" className="admin-text-button" disabled={busy} onClick={() => void resourceAction(resource, 'unshare')}>Revoke all member access</button>}
          <button type="button" className="admin-text-button resource-delete" disabled={busy} onClick={() => { if (window.confirm('Permanently remove this private resource and its metadata?')) void resourceAction(resource, 'delete'); }}>Delete resource</button>
        </div>
      </article>;
    })}</div>}
    <aside className="attendance-next-step"><strong>Privacy boundary</strong><p>Recording, AI-provider processing, member access and certificates are disabled until the operator approves the privacy notice, recording-consent process, provider/data terms, retention policy, and production storage/authentication setup. AI outputs remain drafts until coordinator approval.</p></aside>
  </section>;
}
