import type { ReactNode } from 'react';
export default function SectionHeading({ tag, title, children }: { tag: string; title: string; children?: ReactNode }) {
  return <div className="section-heading"><span className="eyebrow"><i aria-hidden="true" />{tag}</span><h2>{title}</h2>{children && <p>{children}</p>}</div>;
}
