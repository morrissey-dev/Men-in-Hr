import { ArrowUpRight, CalendarDays, Clock3, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { publishedEvents } from '../data/content';

function formatDate(date: string) { return new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Nairobi' }).format(new Date(date)); }
export default function Events() {
  return <>
    <section className="page-hero"><div className="container"><span className="eyebrow"><i /> EVENTS & ENGAGEMENTS</span><h1>Where connections<br /><em>come alive.</em></h1><p>Sessions, conversations and opportunities to learn together. Only confirmed public events appear here.</p></div></section>
    <section className="section"><div className="container"><div className="programme-heading"><div><span className="eyebrow"><i /> THE CALENDAR</span><h2>Upcoming events.</h2></div><p>All event times will be shown in East Africa Time (EAT).</p></div>{publishedEvents.length === 0 ? <div className="empty-state"><span className="empty-state__icon"><CalendarDays size={35} strokeWidth={1.4}/></span><h3>Something meaningful is taking shape.</h3><p>Our session calendar is being finalised. Confirmed dates and event details will be shared here as soon as they are approved.</p><Link to="/programme" className="button button--outline">Explore the programme <ArrowUpRight size={17}/></Link></div> : <div className="event-list">{publishedEvents.map(event => <article key={event.id} className="event-item"><span className="event-item__date"><CalendarDays size={18}/>{formatDate(event.startUtc)} EAT</span><h3>{event.title}</h3><p>{event.description}</p><span><MapPin size={16}/>{event.locationLabel}</span></article>)}</div>}<p className="timezone-note"><Clock3 size={16}/> Kenya uses EAT (UTC+3) all year.</p></div></section>
  </>;
}
