import { ArrowUpRight, CalendarCheck2, ClipboardList, LockKeyhole, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function GetInvolved() {
  return <>
    <section className="page-hero"><div className="container"><span className="eyebrow"><i /> GET INVOLVED</span><h1>There's a place<br />for <em>your growth.</em></h1><p>Whether you're a student exploring the profession or a practitioner interested in contributing, here's where our journey stands.</p></div></section>
    <section className="section"><div className="container"><div className="participation-grid">
      <article className="participation-card"><div className="participation-card__top"><span className="participation-card__icon"><Users size={27}/></span><span className="status-chip">Check application status</span></div><h2>For students</h2><p>Our proposed first cohort focuses on self-discovery, career readiness, communication, leadership, networking and more.</p><div className="participation-card__callout"><ClipboardList size={19}/><span>Review the application requirements and check whether registration is open.</span></div><Link className="text-link text-link--dark" to="/apply">Student applications <ArrowUpRight size={18}/></Link></article>
      <article className="participation-card participation-card--dark"><div className="participation-card__top"><span className="participation-card__icon"><CalendarCheck2 size={27}/></span><span className="status-chip status-chip--dark">Programme in development</span></div><h2>For mentors</h2><p>We welcome meaningful contributions from HR practitioners interested in guiding students through professional and personal development.</p><div className="participation-card__callout"><LockKeyhole size={19}/><span>Public mentor profiles and contact channels will be added only after permission and details are confirmed.</span></div><Link className="text-link" to="/contact">Contact information <ArrowUpRight size={18}/></Link></article>
    </div></div></section>
    <section className="section section--tint"><div className="container centered-outro"><span className="eyebrow"><i /> BEHIND THE SCENES</span><h2>We are building this with care.</h2><p>Student privacy, straightforward applications and a meaningful mentorship experience come before rushing to launch a form.</p><Link to="/privacy" className="button button--outline">Read our privacy approach <ArrowUpRight size={17}/></Link></div></section>
  </>;
}
