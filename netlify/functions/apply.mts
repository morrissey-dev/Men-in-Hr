import { submitApplication } from '../lib/application-server.ts';

export default submitApplication;

// Netlify enforces IP/domain request limits before executing the serverless function.
export const config = { path: '/api/applications', rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
