import { describe, expect, it } from 'vitest';
import { cohortOne, publishedEvents, topics } from './content';

describe('Cohort 1 programme content', () => {
  it('contains eight topics in the agreed order', () => {
    expect(topics).toHaveLength(8);
    expect(topics.map(topic => topic.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('contains the full, distinct titles and stable identifiers', () => {
    expect(new Set(topics.map(topic => topic.slug)).size).toBe(8);
    for (const topic of topics) {
      expect(topic.title.length).toBeGreaterThan(20);
      expect(topic.summary.trim().length).toBeGreaterThan(15);
    }
  });

  it('does not imply the registration or event calendar is live', () => {
    expect(cohortOne.status).toBe('planning');
    expect(publishedEvents).toHaveLength(0);
  });
});
