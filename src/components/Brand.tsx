import { Link } from 'react-router-dom';

export default function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link className={`brand${inverse ? ' brand--inverse' : ''}`} to="/" aria-label="Men in HR Connect, home">
      <span className="brand__mark" aria-hidden="true"><span>M</span><i /></span>
      <span className="brand__name">MEN <small>IN</small> HR<span className="brand__connect">CONNECT</span></span>
    </Link>
  );
}
