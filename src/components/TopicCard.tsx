import { ArrowUpRight } from 'lucide-react';
import type { Topic } from '../data/content';

export default function TopicCard({ topic, compact = false }: { topic: Topic; compact?: boolean }) {
  return <article className={`topic-card${compact ? ' topic-card--compact' : ''}`} id={compact ? undefined : topic.slug}>
    <div className="topic-card__top"><span className="topic-card__number">{String(topic.number).padStart(2, '0')}</span><ArrowUpRight size={20} aria-hidden="true" /></div>
    <div><span className="eyebrow topic-card__focus">{topic.focus}</span><h3>{topic.title}</h3>{!compact && <p>{topic.summary}</p>}</div>
  </article>;
}
