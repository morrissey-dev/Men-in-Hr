export type ProgrammeModule = {
  number: number;
  id: string;
  title: string;
  summary: string;
  focus: string;
  subtopics: string[];
  scheduledAt: string;
  speaker: string;
};

// Canonical Cohort 1 curriculum and timetable, drawn from the approved programme documents.
export const programmeModules: ProgrammeModule[] = [
  {
    number: 1, id: 'professional-identity',
    title: 'Men in a Female-Dominated Profession: Breaking Stereotypes and Establishing Professional Identity',
    summary: 'Build confidence and a clear professional identity while navigating gender stereotypes in HR.',
    focus: 'Professional identity',
    subtopics: [
      'Understanding the experiences of men in HR.',
      'Challenging gender stereotypes and misconceptions.',
      'Building professional confidence and credibility.',
      'Developing personal identity, values and purpose.',
      'Setting personal and professional goals.',
    ],
    scheduledAt: '2026-11-04T20:00:00+03:00', speaker: 'Eston Kariuki',
  },
  {
    number: 2, id: 'strategic-hr-leadership',
    title: 'From Practitioner to Executive: Preparing Men for Strategic HR Leadership',
    summary: 'Explore HR career pathways and the strategic capabilities required for executive leadership.',
    focus: 'Strategic HR leadership',
    subtopics: [
      'Evolution of HR into a strategic function.',
      'Exploring HR specialisations and career pathways.',
      'Developing strategic thinking and decision-making.',
      'Executive presence and professional influence.',
      'Professional certifications and career progression.',
    ],
    scheduledAt: '2026-11-06T20:00:00+03:00', speaker: 'Mr. Richard J. Magoma',
  },
  {
    number: 3, id: 'professional-legacy',
    title: 'The Making of a Respected Man: Integrity, Character, Personal Branding and Professional Legacy',
    summary: 'Develop a credible professional reputation grounded in integrity, discipline and accountability.',
    focus: 'Character and professional brand',
    subtopics: [
      'Building a distinctive professional brand.',
      'CV writing and LinkedIn optimisation.',
      'Professional grooming and etiquette.',
      'Integrity, discipline and accountability.',
      'Reputation management and career positioning.',
    ],
    scheduledAt: '2026-11-11T20:00:00+03:00', speaker: 'CHRP. Oscar Kisuya',
  },
  {
    number: 4, id: 'mental-health-and-emotional-intelligence',
    title: "The Silent Pressure: Men's Mental Health, Emotional Intelligence and Workplace Expectations",
    summary: 'Discuss emotional well-being, workplace pressure and healthy ways to seek support.',
    focus: 'Well-being and emotional intelligence',
    subtopics: [
      'Masculinity and emotional expression.',
      "Men's mental health and emotional vulnerability.",
      'Managing stress, anger and burnout.',
      'Developing emotional intelligence.',
      'Healthy communication and seeking support.',
    ],
    scheduledAt: '2026-11-13T20:00:00+03:00', speaker: 'Kephar Ojijo',
  },
  {
    number: 5, id: 'power-and-workplace-relationships',
    title: 'Navigating Power, Influence and Workplace Relationships as a Male HR Professional',
    summary: 'Build respectful workplace relationships and exercise influence with professional responsibility.',
    focus: 'Workplace relationships',
    subtopics: [
      'Understanding workplace politics and power dynamics.',
      'Building meaningful professional relationships.',
      'Professional boundaries and ethical conduct.',
      'Navigating gender dynamics at work.',
      'Networking, mentorship and professional influence.',
    ],
    scheduledAt: '2026-11-18T20:00:00+03:00', speaker: 'Mr. Itai Mbonda',
  },
  {
    number: 6, id: 'ethical-male-leadership',
    title: 'Leadership, Manhood and Responsibility: Becoming an Ethical and Accountable Male Leader',
    summary: 'Prepare for responsible leadership through accountability, empathy and professional ethics.',
    focus: 'Ethical leadership',
    subtopics: [
      'Responsible masculinity and leadership.',
      'Leadership confidence and accountability.',
      'Balancing authority, empathy and humility.',
      'Professional ethics and workplace integrity.',
      'Gender equality and creating safe workplaces.',
      'Legal responsibilities of HR practitioners.',
    ],
    scheduledAt: '2026-11-20T20:00:00+03:00', speaker: 'Mr. Jay Walemba',
  },
  {
    number: 7, id: 'financial-independence',
    title: 'The Modern Man and Financial Independence: Wealth Creation, Investments and Financial Discipline',
    summary: 'Build financial literacy and consider practical paths to long-term independence.',
    focus: 'Financial independence',
    subtopics: [
      'Budgeting, saving and financial discipline.',
      'Investment opportunities and wealth creation.',
      'Societal expectations of men as providers.',
      'Financial independence and planning.',
      'Marriage, fatherhood and family responsibilities.',
      'Balancing career, relationships and personal life.',
    ],
    scheduledAt: '2026-11-25T20:00:00+03:00', speaker: 'Mr. Vincent Otumbo',
  },
  {
    number: 8, id: 'entrepreneurship-and-consultancy',
    title: 'Beyond Employment: Entrepreneurship, HR Consultancy and Multiple Income Streams for Men',
    summary: 'Explore entrepreneurship and sustainable income opportunities within and beyond HR.',
    focus: 'Entrepreneurship and consultancy',
    subtopics: [
      'Entrepreneurship in the HR profession.',
      'Establishing HR consultancy and recruitment businesses.',
      'HR technology and digital opportunities.',
      'Developing multiple income streams.',
      'Business networking and client acquisition.',
      'Five-year career and financial planning.',
      'Mentorship and building a professional legacy.',
    ],
    scheduledAt: '2026-11-27T20:00:00+03:00', speaker: 'Dr. Francis Kangure',
  },
];

export type Topic = { number: number; slug: string; title: string; summary: string; focus: string };
export const topics: Topic[] = programmeModules.map(({ number, id, title, summary, focus }) => ({ number, slug: id, title, summary, focus }));

export const programmeObjective = 'Equip male HR students and young professionals with the personal, professional, financial and leadership competencies to navigate the HR profession and become responsible, influential and ethical leaders.';

export const programmeObjectives = [
  'Strengthen self-awareness, confidence, personal growth and professional identity.',
  'Expose participants to HR career pathways, professional expectations and strategic leadership.',
  'Build professional branding, employability, communication and relationship-management skills.',
  "Create a supportive space to discuss men's mental health, emotional intelligence and well-being.",
  'Connect participants with experienced practitioners, industry leaders, entrepreneurs and mentors.',
  'Promote integrity, accountability, ethical leadership and responsible masculinity.',
  'Develop financial literacy, investment awareness, entrepreneurship and long-term planning.',
  'Encourage mentorship, professional networks and the development of future HR leaders.',
];

export const targetParticipants = [
  'Male students pursuing Human Resource Management and related courses.',
  'Male graduates aspiring to build careers in HR.',
  'Young male HR practitioners seeking professional development.',
  'Emerging male leaders interested in strategic HR management.',
];

export const deliveryApproach = [
  'Expert-led mentorship sessions with experienced HR practitioners and other professionals.',
  'Interactive discussions that invite questions, shared experience and constructive conversation.',
  'Case studies, reflection activities and practical exercises based on real situations.',
  'Mentorship and networking with practitioners, mentors and fellow participants.',
  'Personal-development activities that turn learning into individual action plans.',
];

export const expectedOutcomes = [
  'Greater self-awareness, confidence and personal accountability.',
  'A stronger understanding of the HR profession and available career pathways.',
  'More credible professional brands and improved employability.',
  'Stronger emotional intelligence, communication and interpersonal skills.',
  'Meaningful mentorship relationships and professional networks.',
  'Responsible leadership, ethical conduct and professional integrity.',
  'Improved financial awareness and understanding of wealth-creation opportunities.',
  'Ability to identify entrepreneurial opportunities and alternative HR career paths.',
  'Practical personal and professional action plans for continued growth.',
];

export const evaluationApproach = [
  'Session registration, attendance and participation.',
  'Session feedback and participant evaluation forms.',
  'Pre-programme and post-programme self-assessments.',
  'Completion of personal-development and career action plans.',
  'Follow-up on mentorship relationships and longer-term outcomes.',
];

export const values = [
  { heading: 'Professional identity', text: 'Build confidence and prepare for the opportunities and expectations of HR work.' },
  { heading: 'Whole-person growth', text: 'Explore well-being, leadership, financial responsibility and professional development together.' },
  { heading: 'Mentorship and networks', text: 'Learn through practitioner experience, peer support and purposeful professional relationships.' },
];

export type PublicEvent = {
  id: string;
  title: string;
  startUtc: string;
  locationLabel: string;
  description: string;
};

// Publish only confirmed, approved public events. Never place private meeting links here.
export const publishedEvents: PublicEvent[] = [];

export const cohortOne = {
  label: 'Cohort 01',
  duration: 'Four weeks',
  statement: 'An eight-session mentorship programme supporting the personal, professional, financial and leadership development of male HR students and young professionals.',
};
