import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import Turnstile from '../components/Turnstile';
import { topics } from '../data/content';
import { getApplicationStatus, type ApplicationStatus } from '../lib/application-status';
import { initialApplication, validateApplication, type ApplicationInput, type ApplicationErrors } from '../lib/application-validation';

const studyYears = [
  ['1', 'Year 1'], ['2', 'Year 2'], ['3', 'Year 3'], ['4', 'Year 4'],
  ['5', 'Year 5'], ['6+', 'Year 6 or later'], ['postgraduate', 'Postgraduate'], ['other', 'Other'],
] as const;

export default function Apply() {
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [form, setForm] = useState<ApplicationInput>({ ...initialApplication });
  const [errors, setErrors] = useState<ApplicationErrors>({});
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverMessage, setServerMessage] = useState('');
  const [challengeVersion, setChallengeVersion] = useState(0);

  useEffect(() => {
    let active = true;
    getApplicationStatus().then(result => { if (active) setStatus(result); });
    return () => { active = false; };
  }, []);

  function setField<Key extends keyof ApplicationInput>(field: Key, value: ApplicationInput[Key]) {
    setForm(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
  }

  function toggleInterest(slug: string, checked: boolean) {
    setForm(current => ({ ...current, interests: checked ? [...current.interests, slug] : current.interests.filter(value => value !== slug) }));
    setErrors(current => ({ ...current, interests: undefined }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!status?.open || busy) return;
    const result = validateApplication(form);
    if (!result.value) { setErrors(result.errors); setServerMessage('Please correct the highlighted fields.'); return; }
    if (!form.turnstileToken) { setServerMessage('Complete the security verification before submitting.'); return; }
    setErrors({}); setServerMessage(''); setBusy(true);
    try {
      const response = await fetch('/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await response.json() as { message?: string; error?: string; fields?: ApplicationErrors };
      if (response.ok) { setSubmitted(true); setServerMessage(body.message ?? 'Application received.'); }
      else { setServerMessage(body.error ?? 'Submission failed. Please try again.'); if (body.fields) setErrors(body.fields); setField('turnstileToken', ''); setChallengeVersion(current => current + 1); }
    } catch { setServerMessage('Connection problem. Please check your internet and try again.'); setField('turnstileToken', ''); setChallengeVersion(current => current + 1); }
    finally { setBusy(false); }
  }

  return <>
    <section className="page-hero page-hero--short"><div className="container">
      <span className="eyebrow"><i /> STUDENT PARTICIPATION</span>
      <h1>Your next chapter <em>starts here.</em></h1>
      <p>Express your interest in a Men in HR mentorship cohort. We only collect applications when registration has been officially opened.</p>
    </div></section>
    <section className="section"><div className="container apply-layout">
      <aside className="apply-sidebar">
        <Link to="/get-involved" className="text-link text-link--dark"><ArrowLeft size={17}/> Back to Get Involved</Link>
        <div className="apply-sidebar__panel"><ClipboardList size={24}/><h2>What to expect</h2><p>A simple application designed around student interests, not lengthy paperwork.</p><ul><li>Provide your basic contact details.</li><li>Choose up to three areas of interest.</li><li>Submit once registration is open.</li><li>Await updates through official channels.</li></ul></div>
        <div className="apply-privacy"><ShieldCheck size={22}/><p>No payment is required to apply. Avoid sharing ID numbers, passwords, financial information or medical information in your response.</p></div>
      </aside>
      <div className="apply-main">
        {status === null && <div className="application-state" role="status"><h2>Checking registration status…</h2><p>We are checking whether applications are currently open.</p></div>}
        {status && !status.open && <div className="application-state" role="status"><span className="application-state__icon"><LockKeyhole size={30}/></span><span className="status-chip">Not yet open</span><h2>Applications are currently closed.</h2><p>The registration process is being prepared. The form will open here only after programme approval, data protection arrangements and technical checks are complete.</p><p className="field-hint">No application data is being requested or saved on this page right now.</p><Link className="button button--dark" to="/programme">Explore Cohort 1 topics <ArrowRight size={17}/></Link></div>}
        {status?.open && submitted && <div className="application-state" role="status"><span className="application-state__icon"><CheckCircle2 size={32}/></span><h2>Thank you for your interest.</h2><p>{serverMessage}</p><p className="field-hint">Submission does not guarantee selection. Please refer to official programme announcements.</p><Link className="button button--dark" to="/programme">View the programme <ArrowRight size={16}/></Link></div>}
        {status?.open && !submitted && <form className="application-form" onSubmit={onSubmit} noValidate>
          <div className="form-intro"><span className="eyebrow"><i /> {status.cohortName ?? 'COHORT APPLICATION'}</span><h2>Student interest form</h2><p>Fields marked * are required. Your information is used to review your application and coordinate cohort participation.</p></div>
          <div className="form-grid">
            <div className="form-field"><label htmlFor="full-name">Full name *</label><input id="full-name" autoComplete="name" value={form.fullName} maxLength={100} onChange={event => setField('fullName', event.target.value)} aria-invalid={!!errors.fullName} aria-describedby={errors.fullName ? 'full-name-error' : undefined} required />{errors.fullName && <span className="field-error" id="full-name-error">{errors.fullName}</span>}</div>
            <div className="form-field"><label htmlFor="email">Email address *</label><input id="email" type="email" autoComplete="email" value={form.email} maxLength={254} onChange={event => setField('email', event.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} required />{errors.email && <span className="field-error" id="email-error">{errors.email}</span>}</div>
            <div className="form-field"><label htmlFor="institution">University or institution *</label><input id="institution" value={form.institution} maxLength={120} onChange={event => setField('institution', event.target.value)} aria-invalid={!!errors.institution} aria-describedby={errors.institution ? 'institution-error' : undefined} required />{errors.institution && <span className="field-error" id="institution-error">{errors.institution}</span>}</div>
            <div className="form-field"><label htmlFor="year">Year / level of study *</label><select id="year" value={form.yearOfStudy} onChange={event => setField('yearOfStudy', event.target.value)} aria-invalid={!!errors.yearOfStudy} aria-describedby={errors.yearOfStudy ? 'year-error' : undefined} required><option value="">Select a level</option>{studyYears.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{errors.yearOfStudy && <span className="field-error" id="year-error">{errors.yearOfStudy}</span>}</div>
          </div>
          <fieldset className="interest-fieldset" aria-describedby="interests-hint interests-error"><legend>Areas you would like mentorship in *</legend><p id="interests-hint">Choose 1–3 topics. These choices help coordinators understand participant interests.</p><div className="interest-options">{topics.map(topic => <label key={topic.slug} className={`interest-option ${form.interests.includes(topic.slug) ? 'selected' : ''}`}><input type="checkbox" checked={form.interests.includes(topic.slug)} disabled={!form.interests.includes(topic.slug) && form.interests.length >= 3} onChange={event => toggleInterest(topic.slug, event.target.checked)} /><span><strong>{topic.title}</strong><small>{topic.focus}</small></span></label>)}</div>{errors.interests && <span className="field-error" id="interests-error">{errors.interests}</span>}</fieldset>
          <div className="form-field"><label htmlFor="motivation">What would you like to gain? <span className="optional-label">Optional</span></label><textarea id="motivation" rows={4} maxLength={400} value={form.motivation} onChange={event => setField('motivation', event.target.value)} placeholder="A few sentences about what you hope to learn…" aria-invalid={!!errors.motivation} aria-describedby="motivation-hint"/><span className="field-hint" id="motivation-hint">Do not include sensitive personal information. {form.motivation.length}/400 characters</span>{errors.motivation && <span className="field-error">{errors.motivation}</span>}</div>
          <div className="bot-trap" aria-hidden="true"><label htmlFor="website-field">Leave this field blank</label><input id="website-field" name="website" autoComplete="off" tabIndex={-1} value={form.website} onChange={event => setField('website', event.target.value)} /></div>
          <div className="consent-panel"><h3>Privacy and eligibility</h3><p>Data controller: <strong>{status.privacyController}</strong>. Privacy requests: <a href={`mailto:${status.privacyEmail}`}>{status.privacyEmail}</a>. Submitted information is retained for up to {status.retentionDays} days from submission, subject to any applicable legal obligations and an approved deletion process.</p><label className="checkbox-row"><input type="checkbox" checked={form.isAdult} onChange={event => setField('isAdult', event.target.checked)} required/><span>I confirm I am at least 18 years old. *</span></label>{errors.isAdult && <span className="field-error">{errors.isAdult}</span>}<label className="checkbox-row"><input type="checkbox" checked={form.privacyAccepted} onChange={event => setField('privacyAccepted', event.target.checked)} required/><span>I have read the <Link to="/privacy" target="_blank" rel="noopener noreferrer">privacy notice</Link> and agree to the use of my information for this application and cohort coordination. *</span></label>{errors.privacyAccepted && <span className="field-error">{errors.privacyAccepted}</span>}</div>
          {status.turnstileSiteKey && <Turnstile key={challengeVersion} siteKey={status.turnstileSiteKey} onToken={value => setField('turnstileToken', value)} />}
          {serverMessage && <p className="submission-message" role="alert">{serverMessage}</p>}
          <button className="button button--dark application-submit" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'} {!busy && <ArrowRight size={17}/>}</button>
          <p className="field-hint">Please submit only once. No account or password is required.</p>
        </form>}
      </div>
    </div></section>
  </>;
}
