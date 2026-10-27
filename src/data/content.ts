export type Topic = {
  number: number;
  slug: string;
  title: string;
  summary: string;
  focus: string;
};

// Current working programme from the Men in HR Cohort 1 design document.
// Organisers should approve changes before publication.
export const topics: Topic[] = [
  { number: 1, slug: 'self-discovery', title: 'Self-Discovery, Personal Growth and Goal Setting', summary: 'Understand your strengths, values and ambitions, and set meaningful personal development goals.', focus: 'Personal growth' },
  { number: 2, slug: 'hr-career-pathways', title: 'Understanding the HR Profession and Career Pathways', summary: 'Explore HR specialisations, professional expectations, certifications, examinations and continuous professional development.', focus: 'Career clarity' },
  { number: 3, slug: 'personal-branding', title: 'Personal Branding, CV Writing and Employability', summary: 'Build your professional identity and prepare for internships, applications and career opportunities.', focus: 'Employability' },
  { number: 4, slug: 'communication', title: 'Communication, Confidence and Public Speaking', summary: 'Develop the confidence and communication skills to express your ideas in professional settings.', focus: 'Confidence' },
  { number: 5, slug: 'mentorship', title: 'Mentorship, Networking and Professional Relationships', summary: 'Learn from HR practitioners and build valuable, lasting professional connections.', focus: 'Connections' },
  { number: 6, slug: 'leadership', title: 'Leadership, Professional Ethics and Workplace Readiness', summary: 'Strengthen your leadership, integrity, teamwork and understanding of workplace conduct.', focus: 'Leadership' },
  { number: 7, slug: 'financial-literacy', title: "Financial Literacy, Resilience and Managing Life's Pressures", summary: 'Build healthy financial habits and practical approaches to everyday challenges.', focus: 'Resilience' },
  { number: 8, slug: 'review-and-action', title: 'Personal Development Review, Career Action Planning and the Future', summary: 'Reflect on your progress and define practical next steps for your personal and professional future.', focus: 'Next steps' },
];

export const values = [
  { heading: 'Purposeful growth', text: 'Discover strengths, develop confidence and set personal goals that matter.' },
  { heading: 'Professional exposure', text: 'Understand the HR profession and prepare for opportunities beyond campus.' },
  { heading: 'Meaningful connections', text: 'Learn through mentorship, peer support and professional relationships.' },
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
  status: 'planning' as const,
  statement: 'A proposed eight-topic journey in personal growth and professional readiness.',
};
