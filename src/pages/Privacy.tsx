import { useEffect, useState } from 'react';
import { getApplicationStatus, type ApplicationStatus } from '../lib/application-status';

export default function Privacy() {
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  useEffect(() => { let active = true; getApplicationStatus().then(value => { if (active) setStatus(value); }); return () => { active = false; }; }, []);
  return <><section className="page-hero page-hero--short"><div className="container"><span className="eyebrow"><i /> TRUST & TRANSPARENCY</span><h1>Privacy <em>matters.</em></h1><p>How Men in HR Connect approaches student information.</p></div></section>
    <section className="section"><div className="container readable-content">
      <h2>Current application status</h2>
      <p>{status?.open ? `Applications are currently open for ${status.cohortName ?? 'the mentorship programme'}.` : 'Applications are currently closed. No student registration information is collected or stored through the website while applications are closed.'}</p>
      <h2>What we collect when applications are open</h2>
      <p>We ask for a name, email address, university or institution, year or level of study, up to three mentorship interests and an optional short motivation. We record eligibility confirmation, privacy notice version, time of consent and submission time. We do not request national identity numbers, passwords, financial details or medical information.</p>
      <h2>Purpose and permission</h2>
      <p>We use applications to review interest, coordinate a Men in HR mentorship cohort and communicate through approved programme channels. Participation is optional, and applicants review this notice and give explicit permission before submitting. Application does not guarantee admission.</p>
      <h2>Who is responsible</h2>
      {status?.open && status.privacyController && status.privacyEmail ? <p>Responsible organisation: <strong>{status.privacyController}</strong>. Privacy enquiries, access, corrections, objections, withdrawal and deletion requests: <a href={`mailto:${status.privacyEmail}`}>{status.privacyEmail}</a>.</p> : <p>The responsible organisation and its approved privacy contact will be published here before applications are opened. Do not send personal application information through unofficial channels.</p>}
      <h2>Access, storage and security</h2>
      <p>Application data is sent over HTTPS through a server-side form endpoint and stored in a private PostgreSQL database hosted by Supabase. Access to the database is restricted to authorised programme coordinators. Netlify provides website hosting and application processing. Cloudflare Turnstile checks submissions for abuse. Service providers may process technical request details as part of service delivery. Personal submissions are not displayed on public pages.</p>
      <h2>Retention and deletion</h2>
      <p>{status?.open && status.retentionDays ? `Application records are intended to be retained for up to ${status.retentionDays} days from submission, subject to lawful exceptions and an operational deletion process.` : 'A specific retention period and deletion process must be formally approved and configured before applications open.'} The programme team must perform and verify deletion; software configuration alone does not automatically erase records.</p>
      <h2>Data rights and international processing</h2>
      <p>Under Kenyan data protection law, applicants may request information about use of their personal data and exercise applicable access, correction, objection and deletion rights. Before launch, organisers must review contractual safeguards and any transfers or hosting outside Kenya with the appropriate institutional authority.</p>
      <h2>Photography and mentoring</h2>
      <p>Mentor biographies, contact details and personal photographs will only be published with appropriate permission. This application does not authorise publicity or marketing use of an applicant's information.</p>
      <p className="privacy-note">Notice version: {status?.noticeVersion ?? 'draft — not yet approved'}. The responsible organisation must verify this notice and provider arrangements before real applications are accepted.</p>
    </div></section></>;
}
