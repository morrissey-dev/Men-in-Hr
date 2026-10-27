import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ClipboardList, LockKeyhole, LogOut, RefreshCcw, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminAuth, adminLoginAvailable, adminRequest } from '../lib/admin-auth';

type Role = 'owner' | 'coordinator';
type Status = 'pending' | 'approved' | 'declined' | 'withdrawn';
type Application = {
  id: string; cohort_id: string; full_name: string; email: string; institution: string;
  year_of_study: string; interests: string[]; motivation: string; status: Status; created_at: string;
};
type Cohort = { id: string; slug: string; name: string; applications_open: boolean; created_at: string };
const statusChoices = ['pending','approved','declined'] as const;
const UUID_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function ApplicationRow({ item, onSaved }: { item: Application; onSaved: () => Promise<void> }) {
  const [decision, setDecision] = useState<Status>(item.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setDecision(item.status); setError(''); }, [item.id, item.status]);
  async function save() {
    setSaving(true); setError('');
    try { await adminRequest('applications', { method: 'PATCH', body: JSON.stringify({ applicationId: item.id, status: decision }) }); await onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to update application.'); }
    finally { setSaving(false); }
  }
  return <article className="admin-application-card">
    <div className="admin-card-head"><div><strong>{item.full_name}</strong><small>{item.email} · {item.institution}</small></div><span className={`admin-status admin-status--${item.status}`}>{item.status}</span></div>
    <div className="admin-card-meta"><span>Study year: {item.year_of_study}</span><span>Applied: {new Date(item.created_at).toLocaleDateString('en-KE', { dateStyle: 'medium' })}</span></div>
    <div className="admin-chip-row">{item.interests.map(interest => <span key={interest} className="admin-topic-chip">{interest.replace(/-/g, ' ')}</span>)}</div>
    {item.motivation && <details className="admin-notes"><summary>Read motivation</summary><p>{item.motivation}</p></details>}
    <div className="admin-row-actions">
      <label htmlFor={`decision-${item.id}`}>Decision</label>
      <select id={`decision-${item.id}`} disabled={saving || item.status === 'withdrawn'} value={decision} onChange={e => setDecision(e.target.value as Status)}>
        {item.status === 'withdrawn' && <option value="withdrawn">Withdrawn — locked</option>}
        {statusChoices.map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
      </select>
      <button type="button" className="button button--dark" disabled={saving || item.status === 'withdrawn' || decision === item.status} onClick={save}>{saving ? 'Saving…' : 'Save decision'}</button>
    </div>
    {error && <p className="admin-error" role="alert">{error}</p>}
  </article>;
}

export default function Admin() {
  const [signedIn, setSignedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [authError, setAuthError] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [tab, setTab] = useState<'applications' | 'cohorts'>('applications');
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [cohortFilter, setCohortFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftSlug, setDraftSlug] = useState('');

  useEffect(() => {
    let active = true;
    if (!adminAuth) { setChecking(false); return; }
    void adminAuth.auth.getSession().then(({ data }) => { if (active) { setSignedIn(Boolean(data.session)); setChecking(false); } });
    const { data: listener } = adminAuth.auth.onAuthStateChange((_event, session) => {
      if (active) { setSignedIn(Boolean(session)); if (!session) setRole(null); }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    setChecking(true); setAuthError('');
    void adminRequest<{ role: Role }>('session')
      .then(res => { if (active) setRole(res.role); })
      .catch(e => { if (active) { setRole(null); setAuthError(e instanceof Error ? e.message : 'Access denied.'); } })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [signedIn]);

  const loadCohorts = useCallback(async () => {
    const res = await adminRequest<{ cohorts: Cohort[] }>('cohorts');
    setCohorts(res.cohorts);
  }, []);

  const loadApplications = useCallback(async () => {
    setLoading(true); setListError('');
    const query = new URLSearchParams({ page: String(page) });
    if (cohortFilter) query.set('cohort', cohortFilter);
    if (statusFilter) query.set('status', statusFilter);
    try {
      const res = await adminRequest<{ applications: Application[]; hasMore: boolean }>(`applications?${query}`);
      setApplications(res.applications); setHasMore(res.hasMore);
    } catch (e) { setApplications([]); setHasMore(false); setListError(e instanceof Error ? e.message : 'Unable to load applications.'); }
    finally { setLoading(false); }
  }, [cohortFilter, statusFilter, page]);

  useEffect(() => { if (role) void loadCohorts().catch(e => setListError(String(e))); }, [role, loadCohorts]);
  useEffect(() => { if (role && tab === 'applications') void loadApplications(); }, [role, tab, loadApplications]);

  async function requestCode(event: FormEvent) {
    event.preventDefault(); if (!adminAuth || authBusy) return;
    setAuthBusy(true); setAuthError('');
    try {
      const { error } = await adminAuth.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
      if (error) throw error;
      setCodeSent(true);
    } catch { setAuthError('Unable to send a code. Confirm that your administrator account has been provisioned.'); }
    finally { setAuthBusy(false); }
  }
  async function verifyCode(event: FormEvent) {
    event.preventDefault(); if (!adminAuth || authBusy) return;
    setAuthBusy(true); setAuthError('');
    try {
      const { error } = await adminAuth.auth.verifyOtp({ email: email.trim(), token: otp.trim(), type: 'email' });
      if (error) throw error;
      setOtp('');
    } catch { setAuthError('Invalid or expired verification code. Request a new one if necessary.'); }
    finally { setAuthBusy(false); }
  }
  async function signOut() {
    await adminAuth?.auth.signOut(); setSignedIn(false); setRole(null); setApplications([]); setCohorts([]);
  }
  async function createDraft(event: FormEvent) {
    event.preventDefault(); setActionError(''); setActionMessage('');
    if (!UUID_SEGMENT.test(draftSlug)) { setActionError('Use lowercase letters, numbers and hyphens in the slug.'); return; }
    try {
      await adminRequest('cohorts', { method: 'POST', body: JSON.stringify({ name: draftName, slug: draftSlug }) });
      setDraftName(''); setDraftSlug(''); setActionMessage('Draft created. Applications remain closed.'); await loadCohorts();
    } catch (e) { setActionError(e instanceof Error ? e.message : 'Unable to create cohort.'); }
  }
  async function toggleCohort(cohort: Cohort) {
    const opening = !cohort.applications_open;
    if (opening && !window.confirm(`Open applications for ${cohort.name}? This must be institutionally approved and all privacy safeguards operational.`)) return;
    setActionError(''); setActionMessage('');
    try {
      await adminRequest('cohorts', { method: 'PATCH', body: JSON.stringify({ cohortId: cohort.id, applicationsOpen: opening }) });
      setActionMessage(opening ? 'Cohort opened for applications.' : 'Applications closed for this cohort.'); await loadCohorts();
    } catch (e) { setActionError(e instanceof Error ? e.message : 'Unable to update cohort.'); }
  }

  return <>
    <section className="page-hero page-hero--short"><div className="container">
      <span className="eyebrow"><i /> AUTHORISED ACCESS ONLY</span>
      <h1>Programme <em>administration.</em></h1>
      <p>Private coordination for approved Men in HR organisers. Student information is never displayed publicly.</p>
    </div></section>
    <section className="section"><div className="container admin-layout">
      <Link to="/" className="text-link text-link--dark"><ArrowLeft size={17} /> Return to public website</Link>
      {!adminLoginAvailable ? <div className="admin-panel admin-splash"><LockKeyhole size={32}/><h2>Administration not configured</h2><p>Administrator sign-in is disabled until the project operator sets up authorised accounts, secure authentication and the database. The public website remains available.</p></div>
      : checking ? <div className="admin-panel"><p role="status">Verifying administrator access…</p></div>
      : !signedIn ? <div className="admin-panel admin-login"><ShieldCheck size={30}/><h2>Coordinator sign-in</h2><p>Use your pre-approved email account. No public admin accounts can be created through this page.</p>
        {!codeSent ? <form onSubmit={requestCode}><label htmlFor="admin-email">Approved email address</label><input id="admin-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="coordinator@example.org"/><button className="button button--dark" disabled={authBusy}>{authBusy ? 'Sending…' : 'Send verification code'}</button></form>
        : <form onSubmit={verifyCode}><label htmlFor="admin-code">Verification code sent to {email}</label><input id="admin-code" type="text" required inputMode="numeric" pattern="[0-9]{6,10}" maxLength={10} autoComplete="one-time-code" value={otp} onChange={e => setOtp(e.target.value)} placeholder="6-digit code"/><div className="admin-inline"><button className="button button--dark" disabled={authBusy}>{authBusy ? 'Verifying…' : 'Verify and sign in'}</button><button className="admin-text-button" type="button" onClick={() => { setCodeSent(false); setOtp(''); setAuthError(''); }}>Use a different email</button></div></form>}
        {authError && <p className="admin-error" role="alert">{authError}</p>}
      </div>
      : !role ? <div className="admin-panel admin-splash"><LockKeyhole size={28}/><h2>Private workspace restricted</h2><p role="alert">{authError || 'Your account does not have administrator access.'}</p><button type="button" onClick={signOut} className="button button--outline">Sign out</button></div>
      : <div className="admin-workspace">
        <div className="admin-heading"><div><span className="eyebrow"><i /> PRIVATE WORKSPACE</span><h2>Welcome, coordinator</h2><p>Access level: {role === 'owner' ? 'Platform administrator' : 'Coordinator'}. Changes to application decisions are recorded.</p></div><button className="button button--outline" type="button" onClick={signOut}><LogOut size={16}/> Sign out</button></div>
        <div className="admin-tabs" role="tablist" aria-label="Administration sections"><button id="tab-applications" role="tab" aria-selected={tab==='applications'} aria-controls="panel-admin" type="button" className={tab==='applications' ? 'active' : ''} onClick={() => setTab('applications')}><ClipboardList size={18}/> Applications</button><button id="tab-cohorts" role="tab" aria-selected={tab==='cohorts'} aria-controls="panel-admin" type="button" className={tab==='cohorts' ? 'active' : ''} onClick={() => setTab('cohorts')}><Users size={18}/> Cohorts</button></div>
        <div id="panel-admin" role="tabpanel" aria-labelledby={tab === 'applications' ? 'tab-applications' : 'tab-cohorts'}>
        {tab === 'applications' ? <>
          <div className="admin-filters"><div><label htmlFor="cohort-filter">Cohort</label><select id="cohort-filter" value={cohortFilter} onChange={e => { setCohortFilter(e.target.value); setPage(0); }}><option value="">All cohorts</option>{cohorts.map(cohort => <option value={cohort.id} key={cohort.id}>{cohort.name}</option>)}</select></div><div><label htmlFor="status-filter">Status</label><select id="status-filter" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}><option value="">All statuses</option>{['pending','approved','declined','withdrawn'].map(s => <option key={s} value={s}>{s}</option>)}</select></div><button type="button" className="button button--outline" onClick={() => void loadApplications()}><RefreshCcw size={16}/> Refresh</button></div>
          <div className="admin-list-header"><h3>Student applications</h3><p>Information is confidential. Do not export or share it without authorisation.</p></div>
          {listError && <p role="alert" className="admin-error">{listError}</p>}
          {loading ? <p role="status">Loading applications…</p> : applications.length === 0 ? <div className="admin-panel"><p>No applications match these filters.</p></div> : <div className="admin-application-list">{applications.map(app => <ApplicationRow key={app.id} item={app} onSaved={loadApplications}/>)}</div>}
          <div className="admin-pagination"><button type="button" className="button button--outline" disabled={page === 0 || loading} onClick={() => setPage(p => p-1)}>Previous</button><span>Page {page+1}</span><button type="button" className="button button--outline" disabled={!hasMore || loading} onClick={() => setPage(p => p+1)}>Next</button></div>
        </> : <>
          <div className="admin-list-header"><h3>Programme cohorts</h3><p>New cohorts are created as drafts with registration closed. Only the platform administrator can change opening status.</p></div>
          {actionError && <p role="alert" className="admin-error">{actionError}</p>}{actionMessage && <p role="status" className="admin-success">{actionMessage}</p>}
          <div className="admin-cohort-list">{cohorts.map(cohort => <article className="admin-panel admin-cohort-card" key={cohort.id}><div><h4>{cohort.name}</h4><p>/{cohort.slug}</p><span className={`admin-status admin-status--${cohort.applications_open ? 'approved' : 'pending'}`}>{cohort.applications_open ? 'Applications open' : 'Applications closed'}</span></div>{role === 'owner' && <button type="button" className="button button--outline" onClick={() => void toggleCohort(cohort)}>{cohort.applications_open ? 'Close applications' : 'Request opening'}</button>}</article>)}</div>
          {role === 'owner' && <form className="admin-panel admin-create-cohort" onSubmit={createDraft}><h4>Create a future cohort (draft)</h4><div className="admin-form-grid"><div><label htmlFor="draft-name">Cohort name</label><input id="draft-name" required minLength={4} maxLength={120} value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="Men in HR — Cohort 2"/></div><div><label htmlFor="draft-slug">URL-friendly slug</label><input id="draft-slug" required maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={draftSlug} onChange={e => setDraftSlug(e.target.value)} placeholder="cohort-2"/></div></div><button className="button button--dark" type="submit">Create draft cohort</button><p className="admin-help">Future cohorts will need a separate approved registration configuration before applications can open.</p></form>}
        </>}
        </div>
      </div>}
    </div></section>
  </>;
}
