import { ArrowUpRight, MessageSquareText, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Contact() {
  return <>
    <section className="page-hero"><div className="container"><span className="eyebrow"><i /> GET IN TOUCH</span><h1>Good things start<br />with a <em>conversation.</em></h1><p>We value students' ideas, mentors' perspectives and opportunities to collaborate.</p></div></section>
    <section className="section"><div className="container"><div className="contact-panel"><span className="contact-panel__icon"><MessageSquareText size={32}/></span><div><span className="eyebrow"><i /> OFFICIAL CONTACT</span><h2>Contact details are being confirmed.</h2><p>We will publish an approved Men in HR / JKUAT HRSA contact channel here. We don't want to share someone's personal phone number or email without permission.</p><div className="contact-note"><ShieldCheck size={19}/><span>For now, no contact form is collecting messages or personal information on this website.</span></div><Link to="/about" className="text-link text-link--dark">Learn more about the initiative <ArrowUpRight size={18}/></Link></div></div></div></section>
  </>;
}
