import { ArrowUpRight, BookOpen, CircleCheck, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import TopicCard from '../components/TopicCard';
import { topics } from '../data/content';

export default function Programme() {
  return <>
    <section className="page-hero page-hero--programme"><div className="container"><span className="eyebrow"><i /> THE PROGRAMME / COHORT 01</span><h1>Eight themes.<br /><em>One direction.</em></h1><p>A proposed mentorship journey designed around the areas students have said matter to their development.</p><div className="programme-metrics"><span><BookOpen size={18}/> 8 proposed topics</span><span><Clock3 size={18}/> Schedule to be confirmed</span><span><CircleCheck size={18}/> Student-informed</span></div></div></section>
    <section className="section programme-body"><div className="container"><div className="programme-heading"><div><span className="eyebrow"><i /> THE LEARNING PATHWAY</span><h2>What we'll explore.</h2></div><p>These are the working Cohort 1 topics. Final session details, speakers and schedules will be communicated after confirmation.</p></div><div className="topic-grid">{topics.map(topic => <TopicCard key={topic.slug} topic={topic}/>)}</div><div className="disclaimer-banner"><strong>Programme status: in development</strong><p>Topics are proposed. No mentor assignments, cohort dates or attendance promises are being presented as confirmed.</p></div></div></section>
    <section className="section section--tint"><div className="container centered-outro"><span className="eyebrow"><i /> BE PART OF THE JOURNEY</span><h2>Curious about Cohort 1?</h2><p>Learn how to get involved and check the latest application status.</p><Link to="/get-involved" className="button button--primary">Get involved <ArrowUpRight size={18}/></Link></div></section>
  </>;
}
