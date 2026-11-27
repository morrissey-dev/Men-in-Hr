import { describe, expect, it } from 'vitest';
import { cohortOne, programmeModules, publishedEvents, topics } from './content';

describe('Cohort 1 programme content', () => {
  it('contains the eight approved timetable modules in session order', () => {
    expect(topics).toHaveLength(8);
    expect(topics.map(topic => topic.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(programmeModules.map(module => module.id)).toEqual([
      'professional-identity', 'strategic-hr-leadership', 'professional-legacy',
      'mental-health-and-emotional-intelligence', 'power-and-workplace-relationships',
      'ethical-male-leadership', 'financial-independence', 'entrepreneurship-and-consultancy',
    ]);
  });

  it('contains the full, distinct titles and stable identifiers', () => {
    expect(new Set(topics.map(topic => topic.slug)).size).toBe(8);
    for (const topic of topics) {
      expect(topic.title.length).toBeGreaterThan(20);
      expect(topic.summary.trim().length).toBeGreaterThan(15);
    }
  });

  it('includes the complete timetable details and one named speaker for every session', () => {
    expect(programmeModules).toHaveLength(8);
    expect(programmeModules.every(module => module.subtopics.length >= 5)).toBe(true);
    expect(programmeModules.every(module => module.speaker.trim().length > 3)).toBe(true);
    expect(programmeModules.map(module => module.scheduledAt)).toEqual([
      '2026-11-04T20:00:00+03:00', '2026-11-06T20:00:00+03:00',
      '2026-11-11T20:00:00+03:00', '2026-11-13T20:00:00+03:00',
      '2026-11-18T20:00:00+03:00', '2026-11-20T20:00:00+03:00',
      '2026-11-25T20:00:00+03:00', '2026-11-27T20:00:00+03:00',
    ]);
    expect(programmeModules.map(module => module.speaker)).toEqual([
      'Eston Kariuki', 'Chris Fanaka', 'CHRP. Oscar Kisuya', 'Kephar Ojijo',
      'Mr. Itai Mbonda', 'Mr. Jay Walemba', 'Mr. Vincent Otumbo', 'Dr. Francis Kangure',
    ]);
  });

  it('reflects the four-week programme without implying registration or other events are live', () => {
    expect(cohortOne.duration).toBe('Four weeks');
    expect(cohortOne.statement).toContain('eight-session mentorship programme');
    expect(publishedEvents).toHaveLength(0);
  });
});
