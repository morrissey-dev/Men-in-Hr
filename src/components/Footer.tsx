import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import Brand from './Brand';

export default function Footer() {
  return <footer className="footer">
    <div className="container footer__main">
      <div className="footer__intro"><Brand inverse /><p>Creating room for connection, growth and leadership among aspiring HR professionals.</p><span className="footer__label">A student mentorship initiative within JKUAT HRSA</span></div>
      <div className="footer__links"><strong>Explore</strong><Link to="/about">Our story</Link><Link to="/programme">Cohort 1 programme</Link><Link to="/events">Events</Link><Link to="/get-involved">Get involved <ArrowUpRight size={14} aria-hidden="true" /></Link></div>
      <div className="footer__links"><strong>Information</strong><Link to="/contact">Contact</Link><Link to="/privacy">Privacy</Link><span>Juja, Kenya</span></div>
    </div>
    <div className="container footer__bottom"><span>© {new Date().getFullYear()} Men in HR Connect</span><span>Built around people. Designed for growth.</span></div>
  </footer>;
}
