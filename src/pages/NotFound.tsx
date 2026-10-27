import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
export default function NotFound() {return <section className="section"><div className="container centered-outro error-page"><span className="eyebrow"><i /> 404 / PAGE NOT FOUND</span><h1>We couldn't find that page.</h1><p>The link may have changed. You can return to the homepage or explore the mentorship programme.</p><Link to="/" className="button button--primary">Back to home <ArrowUpRight size={18}/></Link></div></section>}
