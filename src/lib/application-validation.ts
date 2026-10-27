import { topics } from '../data/content.ts';

export const NOTICE_VERSION = '2026-10-v1';
export const TOPIC_IDS = topics.map(topic => topic.slug);

export type ApplicationInput = {
  fullName: string;
  email: string;
  institution: string;
  yearOfStudy: string;
  interests: string[];
  motivation: string;
  isAdult: boolean;
  privacyAccepted: boolean;
  website: string;
  turnstileToken: string;
};

export type ApplicationFields = Omit<ApplicationInput, 'turnstileToken'>;
export type ApplicationErrors = Partial<Record<keyof ApplicationInput, string>>;

export const initialApplication: ApplicationInput = {
  fullName: '', email: '', institution: '', yearOfStudy: '', interests: [], motivation: '',
  isAdult: false, privacyAccepted: false, website: '', turnstileToken: '',
};

const years = ['1', '2', '3', '4', '5', '6+', 'postgraduate', 'other'];
const own = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

/** Shared client/server validation. The server alone decides whether submissions are accepted. */
export function validateApplication(input: unknown): { value?: ApplicationInput; errors: ApplicationErrors } {
  const errors: ApplicationErrors = {};
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { errors: { fullName: 'Please complete the application form.' } };
  }
  const payload = input as Record<string, unknown>;
  const fullName = text(payload.fullName).replace(/\s+/g, ' ');
  const email = text(payload.email).toLowerCase();
  const institution = text(payload.institution).replace(/\s+/g, ' ');
  const yearOfStudy = text(payload.yearOfStudy);
  const motivation = text(payload.motivation);
  const website = text(payload.website);
  const turnstileToken = text(payload.turnstileToken);
  const interests = Array.isArray(payload.interests) ? payload.interests : [];

  if (fullName.length < 3 || fullName.length > 100 || /[<>\x00-\x1f]/.test(fullName)) errors.fullName = 'Enter your full name (3–100 characters).';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
  if (institution.length < 2 || institution.length > 120 || /[<>\x00-\x1f]/.test(institution)) errors.institution = 'Enter an institution (2–120 characters).';
  if (!years.includes(yearOfStudy)) errors.yearOfStudy = 'Select your year or level of study.';
  if (interests.length < 1 || interests.length > 3 || new Set(interests).size !== interests.length || interests.some(item => typeof item !== 'string' || !TOPIC_IDS.includes(item))) errors.interests = 'Choose 1 to 3 mentorship interests.';
  if (motivation.length > 400 || /[<>\x00-\x08\x0b\x0c\x0e-\x1f]/.test(motivation)) errors.motivation = 'Keep your message under 400 characters and do not include HTML.';
  if (payload.isAdult !== true) errors.isAdult = 'Applicants must confirm that they are at least 18.';
  if (payload.privacyAccepted !== true) errors.privacyAccepted = 'Please review and accept the privacy notice.';
  if (website.length > 0) errors.website = 'Invalid submission.'; // honeypot, server also checks
  if (turnstileToken.length > 2048) errors.turnstileToken = 'Security verification failed.';
  if (!own(payload, 'interests')) errors.interests = 'Choose at least one interest.';

  if (Object.keys(errors).length) return { errors };
  return {
    errors: {},
    value: { fullName, email, institution, yearOfStudy, motivation, interests: interests as string[], website, isAdult: true, privacyAccepted: true, turnstileToken },
  };
}
