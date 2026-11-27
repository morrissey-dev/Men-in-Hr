import { ArrowUpRight, BookOpen, CalendarDays, CheckCircle2, Clock3, MapPin, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { deliveryApproach, evaluationApproach, expectedOutcomes, programmeModules, programmeObjective, programmeObjectives, targetParticipants } from '../data/content';

function sessionDate(value: string) {
  return new Intl.DateTimeFormat('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Nairobi' }).format(new Date(value));
}

export default function Programme() {
  return <>
    <section className="page-hero page-hero--programme"><div className="container"><span className="eyebrow"><i /> THE PROGRAMME / COHORT 01</span><h1>Eight sessions.<br /><em>One direction.</em></h1><p>A four-week mentorship programme helping male HR students and young professionals grow personally, professionally, financially and as leaders.</p><div className="programme-metrics"><span><BookOpen size={18}/> 8 sessions</span><span><Clock3 size={18}/> 4 weeks · 8–9 p.m. EAT</span><span><MapPin size={18}/> Online</span></div></div></section>

    <section className="section programme-overview"><div className="container"><div className="programme-objective"><span className="eyebrow"><i /> PROGRAMME OBJECTIVE</span><p>{programmeObjective}</p><details className="programme-objectives"><summary>See the programme's specific objectives</summary><ol>{programmeObjectives.map(objective => <li key={objective}>{objective}</li>)}</ol></details></div><div className="programme-heading"><div><span className="eyebrow"><i /> THE LEARNING PATHWAY</span><h2>Full timetable and modules.</h2></div><p>The timetable below follows the Cohort 1 programme schedule. Each session is listed with its focus, discussion topics and speaker.</p></div>
      <div className="programme-session-grid">{programmeModules.map(module => <article className="programme-session" key={module.id}>
        <div className="programme-session__top"><span className="programme-session__number">SESSION {String(module.number).padStart(2, '0')}</span><span className="programme-session__focus">{module.focus}</span></div>
        <h3>{module.title}</h3>
        <p className="programme-session__summary">{module.summary}</p>
        <div className="programme-session__meta"><span><CalendarDays size={16}/><time dateTime={module.scheduledAt}>{sessionDate(module.scheduledAt)}</time></span><span><Clock3 size={16}/>8:00–9:00 p.m. EAT</span><span><MapPin size={16}/>Online</span><span><UserRound size={16}/>{module.speaker}</span></div>
        <h4>Subtopics</h4><ul>{module.subtopics.map(subtopic => <li key={subtopic}>{subtopic}</li>)}</ul>
      </article>)}</div>
    </div></section>

    <section className="section section--tint"><div className="container"><div className="programme-heading"><div><span className="eyebrow"><i /> HOW THE PROGRAMME WORKS</span><h2>Experience-led learning.</h2></div><p>The concept note combines practitioner guidance with active participation and reflection.</p></div><ul className="programme-detail-grid">{deliveryApproach.map(item => <li key={item}><CheckCircle2 size={18}/><span>{item}</span></li>)}</ul></div></section>

    <section className="section"><div className="container programme-two-column"><div><span className="eyebrow"><i /> WHO IT SERVES</span><h2>Built for emerging HR professionals.</h2><p className="programme-section-intro">The programme primarily supports:</p><ul className="programme-list">{targetParticipants.map(item => <li key={item}>{item}</li>)}</ul><p className="programme-section-intro">Selected guests and mentors from related professional fields may also contribute their expertise.</p></div><div><span className="eyebrow"><i /> EXPECTED OUTCOMES</span><h2>Growth participants can carry forward.</h2><ul className="programme-list">{expectedOutcomes.map(item => <li key={item}>{item}</li>)}</ul></div></div></section>

    <section className="section section--tint"><div className="container programme-evaluation"><div><span className="eyebrow"><i /> MONITORING AND EVALUATION</span><h2>Learn, reflect and improve.</h2><p>The concept note proposes reviewing participant engagement and programme outcomes to guide future cohorts.</p></div><ul className="programme-list">{evaluationApproach.map(item => <li key={item}>{item}</li>)}</ul></div></section>

    <section className="section"><div className="container centered-outro"><span className="eyebrow"><i /> BE PART OF THE JOURNEY</span><h2>Support the next generation of HR professionals.</h2><p>Explore participant information and ways practitioners can contribute.</p><Link to="/get-involved" className="button button--primary">Get involved <ArrowUpRight size={18}/></Link></div></section>
  </>;
}
