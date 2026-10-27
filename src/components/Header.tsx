import { useEffect, useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Brand from './Brand';

const links = [
  { href: '/about', label: 'About' },
  { href: '/programme', label: 'The programme' },
  { href: '/events', label: 'Events' },
  { href: '/contact', label: 'Contact' },
];

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setIsOpen(false), [location.pathname]);
  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          {links.map(link => <NavLink key={link.href} to={link.href} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>{link.label}</NavLink>)}
        </nav>
        <Link to="/get-involved" className="button button--dark desktop-cta">Get involved <ArrowUpRight size={17} aria-hidden="true" /></Link>
        <button
          type="button"
          className="menu-toggle"
          aria-expanded={isOpen}
          aria-controls="mobile-navigation"
          aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setIsOpen(current => !current)}
        >{isOpen ? <X size={23} /> : <Menu size={23} />}</button>
      </div>
      {isOpen && <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">
        {links.map(link => <NavLink key={link.href} to={link.href} className={({ isActive }) => isActive ? 'mobile-nav__link active' : 'mobile-nav__link'}>{link.label}</NavLink>)}
        <Link to="/get-involved" className="button button--dark">Get involved <ArrowUpRight size={17} /></Link>
      </nav>}
    </header>
  );
}
