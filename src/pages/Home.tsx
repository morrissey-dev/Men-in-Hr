import { ArrowRight, ArrowUpRight, Compass, Handshake, Lightbulb, MoveUpRight, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { topics, values } from '../data/content';
import TopicCard from '../components/TopicCard';
import SectionHeading from '../components/SectionHeading';

const pillarIcons = [Compass, Lightbulb, Handshake];

export default function Home() {
  return <>
    <section className="hero">
      <div className="hero__wash" aria-hidden="true" />
      <div className="container hero__inner">
        <div className="hero__copy">
          <span className="pill"><span className="pill__dot" /> An initiative for aspiring HR professionals</span>
          <h1>Growth begins<br />when we <em>connect.</em></h1>
          <p className="hero__lead">A space for male HR students to find direction, build confidence and grow through meaningful mentorship and professional connections.</p>
          <div className="hero__actions">
            <Link to="/programme" className="button button--primary">Explore Cohort 1 <ArrowUpRight size={19} aria-hidden="true" /></Link>
            <Link to="/about" className="text-link">Discover our story <ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
          <div className="hero__smallprint"><span className="hero__smallprint-mark" aria-hidden="true"><Users size={18} /></span><span>Student-informed. Mentorship-focused.<br />Built with the future in mind.</span></div>
        </div>
        <div className="hero__visual" aria-label="Cohort 1, an eight-topic mentorship journey">
          <div className="visual-grid" aria-hidden="true" />
          <div className="hero__visual-top"><span className="hero__visual-mono">MIH / 001</span><span className="hero__visual-icon"><MoveUpRight size={19}/></span></div>
          <div className="orbit orbit--one" aria-hidden="true" /><div className="orbit orbit--two" aria-hidden="true" /><div className="orbit orbit--three" aria-hidden="true" />
          <div className="hero__visual-core"><span>01 — 08</span><strong>Your journey.<br />Your next chapter.</strong><p>Discover yourself. Build your career. Lead with purpose.</p></div>
          <div className="hero__visual-bottom"><span><span className="tiny-star">✳</span> COHORT 01</span><span>PROPOSED PROGRAMME <ArrowUpRight size={14}/></span></div>
        </div>
      </div>
      <div className="container hero__foot"><span>LEARN / CONNECT / GROW</span><span>Scroll to explore <span aria-hidden="true">↓</span></span></div>
    </section>

    <section className="section about-preview">
      <div className="container">
        <div className="intro-layout">
          <div className="intro-side"><span className="eyebrow"><i aria-hidden="true" /> WHY WE EXIST</span><div className="intro-side__flourish" aria-hidden="true">↗</div></div>
          <div className="intro-main"><h2>More than a programme.<br /><span>A place to belong.</span></h2><p>Men in HR was born from a simple observation: more male HR students needed opportunities to participate, connect and see what's possible in the profession. We're building a student-informed pathway to meaningful personal and professional growth.</p><Link to="/about" className="text-link text-link--dark">Read our story <ArrowUpRight size={18} /></Link></div>
        </div>
        <div className="value-grid">
          {values.map((value, index) => { const Icon = pillarIcons[index]; return <article className="value-card" key={value.heading}><span className="value-card__icon"><Icon size={26} strokeWidth={1.6}/></span><div><span className="value-card__num">0{index + 1} / 03</span><h3>{value.heading}</h3><p>{value.text}</p></div></article>; })}
        </div>
      </div>
    </section>

    <section className="section programme-preview">
      <div className="container">
        <div className="section-topline"><SectionHeading tag="COHORT ONE" title="A journey with purpose.">Eight proposed themes. Real conversations. Practical preparation for the world of HR and beyond.</SectionHeading><Link className="text-link text-link--dark" to="/programme">View the full programme <ArrowUpRight size={18}/></Link></div>
        <div className="topic-grid topic-grid--preview">{topics.slice(0,4).map(topic => <TopicCard key={topic.slug} topic={topic} compact />)}</div>
        <div className="programme-note"><span><Sparkles size={18} /> Four more themes to discover</span><Link to="/programme">Explore all eight <ArrowRight size={17}/></Link></div>
      </div>
    </section>

    <section className="section journey-section">
      <div className="container journey-layout">
        <div><SectionHeading tag="THE APPROACH" title="Learn together. Move forward.">We're shaping a mentorship experience grounded in student interests, practical guidance and genuine professional relationships.</SectionHeading><Link to="/get-involved" className="button button--outline">Be part of the journey <ArrowUpRight size={17}/></Link></div>
        <div className="journey-steps"><div className="journey-line" aria-hidden="true" />{[
          ['01','Discover','Explore your strengths and the possibilities within HR.'],
          ['02','Connect','Meet peers and learn from experienced professionals.'],
          ['03','Grow','Turn insight into goals, practical action and confidence.'],
        ].map(([num,heading,desc]) => <div className="journey-step" key={num}><span className="journey-step__num">{num}</span><div><h3>{heading}</h3><p>{desc}</p></div></div>)}</div>
      </div>
    </section>

    <section className="container section-cta-wrap">
      <div className="section-cta"><div className="cta-ornament" aria-hidden="true"><span>↗</span></div><div className="section-cta__content"><span className="eyebrow"><i aria-hidden="true" /> THE NEXT CHAPTER</span><h2>Your potential deserves<br />room to grow.</h2><p>Follow the journey as we shape our first mentorship cohort.</p><Link className="button button--cream" to="/get-involved">Get involved <ArrowUpRight size={18}/></Link></div><span className="section-cta__footnote">MEN IN HR / CONNECT · GROW · LEAD</span></div>
    </section>
  </>;
}
