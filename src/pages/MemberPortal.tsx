import { useCallback, useEffect, useRef, useState } from 'react';
import { adminAuth, memberLoginAvailable, memberRequest } from '../lib/admin-auth';

type Member = { fullName: string };
type Resource = {
  id: string;
  sessionId: string;
  kind: string;
  status: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  content: string | null;
  createdAt: string;
};
type SessionResponse = { member: Member };
type ResourcesResponse = { resources: Resource[]; nextOffset: number; hasMore: boolean; limitReached: boolean };
type DownloadResponse = { url: string; expiresIn: number; fileName: string };
type ViewState = 'checking' | 'signed-out' | 'loading' | 'ready' | 'denied' | 'unavailable';

function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
  } catch {
    return 'Date unavailable';
  }
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'File size unavailable';
  if (bytes < 1024) return `${bytes} bytes`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(size)} ${units[unit]}`;
}

function resourceLabel(kind: string): string {
  const labels: Record<string, string> = {
    recording: 'Session recording',
    certificate: 'Certificate',
    summary: 'Session summary',
    transcript: 'Transcript',
    action_items: 'Action items',
    'action-items': 'Action items',
  };
  return labels[kind.toLowerCase()] || 'Programme resource';
}

function isDownloadable(kind: string): boolean {
  return ['recording', 'certificate'].includes(kind.toLowerCase());
}

function isReadable(kind: string): boolean {
  return ['summary', 'transcript', 'action_items', 'action-items'].includes(kind.toLowerCase());
}

export default function MemberPortal() {
  const [view, setView] = useState<ViewState>(adminAuth && memberLoginAvailable ? 'checking' : 'unavailable');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [member, setMember] = useState<Member | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [nextResourceOffset, setNextResourceOffset] = useState(0);
  const [hasMoreResources, setHasMoreResources] = useState(false);
  const [resourceLimitReached, setResourceLimitReached] = useState(false);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    const previousTitle = document.title;
    const previousRobots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previousRobotsContent = previousRobots?.content;
    const hadRobots = Boolean(previousRobots);
    const robots = previousRobots || document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    if (!hadRobots) document.head.appendChild(robots);
    document.title = 'Member space | Men in HR Connect';
    return () => {
      document.title = previousTitle;
      if (hadRobots && previousRobots) previousRobots.content = previousRobotsContent || '';
      else robots.remove();
    };
  }, []);

  const clearMemberContent = useCallback(() => {
    generation.current += 1;
    setMember(null);
    setResources([]);
    setNextResourceOffset(0);
    setHasMoreResources(false);
    setResourceLimitReached(false);
    setResourcesLoading(false);
    setDownloading(null);
    setView('signed-out');
  }, []);

  const loadMemberPortal = useCallback(async () => {
    const current = ++generation.current;
    setError('');
    setNotice('');
    setMember(null);
    setResources([]);
    setNextResourceOffset(0);
    setHasMoreResources(false);
    setResourceLimitReached(false);
    setResourcesLoading(false);
    setView('loading');
    try {
      const sessionData = await memberRequest<SessionResponse>('session');
      if (current !== generation.current) return;
      if (!sessionData?.member || typeof sessionData.member.fullName !== 'string') throw new Error('Access could not be verified.');
      setMember(sessionData.member);
      const resourceData = await memberRequest<ResourcesResponse>('resources');
      if (current !== generation.current) return;
      setResources(Array.isArray(resourceData?.resources) ? resourceData.resources : []);
      setNextResourceOffset(Number.isSafeInteger(resourceData?.nextOffset) ? resourceData.nextOffset : 0);
      setHasMoreResources(resourceData?.hasMore === true);
      setResourceLimitReached(resourceData?.limitReached === true);
      setView('ready');
    } catch {
      if (current !== generation.current) return;
      setMember(null);
      setResources([]);
      setView('denied');
    }
  }, []);

  async function loadMoreResources() {
    if (!hasMoreResources || resourcesLoading) return;
    const current = generation.current;
    setResourcesLoading(true);
    setError('');
    try {
      const page = await memberRequest<ResourcesResponse>(`resources?offset=${nextResourceOffset}`);
      if (current !== generation.current) return;
      setResources(existing => {
        const known = new Set(existing.map(resource => resource.id));
        return [...existing, ...page.resources.filter(resource => !known.has(resource.id))];
      });
      setNextResourceOffset(Number.isSafeInteger(page.nextOffset) ? page.nextOffset : nextResourceOffset);
      setHasMoreResources(page.hasMore === true);
      setResourceLimitReached(page.limitReached === true);
    } catch {
      if (current === generation.current) setError('More shared resources could not be loaded. Please try again.');
    } finally {
      if (current === generation.current) setResourcesLoading(false);
    }
  }

  useEffect(() => {
    if (!adminAuth || !memberLoginAvailable) {
      setView('unavailable');
      return;
    }
    let active = true;
    const { data: { subscription } } = adminAuth.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT' || !session) {
        clearMemberContent();
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
        void loadMemberPortal();
      }
    });
    adminAuth.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError || !data.session) clearMemberContent();
      else void loadMemberPortal();
    }).catch(() => { if (active) clearMemberContent(); });
    return () => { active = false; subscription.unsubscribe(); generation.current += 1; };
  }, [clearMemberContent, loadMemberPortal]);

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminAuth || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { error: authError } = await adminAuth.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
      if (authError) throw authError;
      setCodeSent(true);
      setNotice('If this email belongs to an invited participant, a sign-in code will arrive shortly.');
    } catch {
      setError('We could not send a code right now. Check the email address and try again.');
    } finally { setBusy(false); }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminAuth || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { error: authError } = await adminAuth.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' });
      if (authError) throw authError;
      setNotice('Checking your participant access…');
      await loadMemberPortal();
    } catch {
      setError('That code could not be verified. Request a new code or try again.');
    } finally { setBusy(false); }
  }

  async function download(resource: Resource) {
    if (downloading || !isDownloadable(resource.kind)) return;
    setDownloading(resource.id); setError(''); setNotice('');
    try {
      const result = await memberRequest<DownloadResponse>(`resources?download=${encodeURIComponent(resource.id)}`);
      if (!result?.url) throw new Error('Download unavailable');
      window.location.assign(result.url);
    } catch {
      setError('This file is not available to your account right now. Please try again later.');
    } finally { setDownloading(null); }
  }

  return <>
    <section className="page-hero page-hero--short">
      <div className="container">
        <span className="eyebrow"><i /> MEMBER SPACE</span>
        <h1>Your programme, <em>in one place.</em></h1>
        <p>Access materials shared with you as a Men in HR participant.</p>
      </div>
    </section>
    <section className="section">
      <div className="container readable-content" aria-live="polite">
        {view === 'unavailable' && <div role="status"><h2>Member access is unavailable</h2><p>Participant sign-in is not available right now. Please contact your programme coordinator through your usual channel.</p></div>}
        {view === 'checking' && <p role="status">Checking your sign-in…</p>}
        {view === 'loading' && <p role="status">Confirming your participant access…</p>}
        {view === 'signed-out' && <>
          <h2>Sign in to your member space</h2>
          <p>Use the email address associated with your invitation. Sign-in is available to invited participants; there is no self-registration.</p>
          {!codeSent ? <form onSubmit={requestCode}>
            <label htmlFor="member-email">Email address</label>
            <input id="member-email" name="email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} />
            <p><button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in code'}</button></p>
          </form> : <form onSubmit={verifyCode}>
            <p>Enter the code sent to <strong>{email}</strong>.</p>
            <label htmlFor="member-code">Email sign-in code</label>
            <input id="member-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" required value={token} onChange={event => setToken(event.target.value)} />
            <p><button type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify code'}</button></p>
            <button type="button" onClick={() => { setCodeSent(false); setToken(''); setError(''); setNotice(''); }}>Use a different email</button>
          </form>}
          {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
        </>}
        {view === 'denied' && <div role="status"><h2>We couldn’t confirm access</h2><p>This member space is for invited participants. If you believe you should have access, contact your programme coordinator through your usual channel.</p><button type="button" onClick={() => { setError(''); setNotice(''); void adminAuth?.auth.signOut(); }}>Return to sign in</button></div>}
        {view === 'ready' && member && <>
          <h2>Welcome, {member.fullName}</h2>
          <p>Here are the resources currently shared with you. If something you expected is missing, your programme coordinator can help.</p>
          {resources.length === 0 ? <div role="status"><h3>No resources to show yet</h3><p>When programme materials are shared with you, they’ll appear here.</p></div> : <div className="member-resource-list">
            {resources.map(resource => <article className="member-resource-card" key={resource.id}>
              <h3>{resourceLabel(resource.kind)}</h3>
              <p>{resource.fileName || resourceLabel(resource.kind)} · {formatDate(resource.createdAt)}{resource.sizeBytes >= 0 ? ` · ${formatSize(resource.sizeBytes)}` : ''}</p>
              {isDownloadable(resource.kind) && <button type="button" disabled={downloading !== null} onClick={() => void download(resource)} aria-label={`Download ${resourceLabel(resource.kind)}: ${resource.fileName || 'file'}`}>
                {downloading === resource.id ? 'Preparing download…' : `Download ${resourceLabel(resource.kind).toLowerCase()}`}
              </button>}
              {isReadable(resource.kind) && resource.status.toLowerCase() === 'approved' && typeof resource.content === 'string' && <div><p>{resource.content}</p></div>}
            </article>)}
          </div>}
          {hasMoreResources && <div className="member-resource-pagination" aria-live="polite">
            <p>Showing {resources.length} shared items.</p>
            <button type="button" disabled={resourcesLoading} onClick={() => void loadMoreResources()}>
              {resourcesLoading ? 'Loading…' : 'Load more shared resources'}
            </button>
          </div>}
          {resourceLimitReached && <p role="status">This member space has reached its 5,000-item safety limit. Contact your coordinator for help accessing older resources.</p>}
          {error && <p role="alert">{error}</p>}
          <p><button type="button" onClick={() => { setError(''); setNotice(''); void adminAuth?.auth.signOut(); }}>Sign out</button></p>
        </>}
      </div>
    </section>
  </>;
}
