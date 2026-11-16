import { adminAIJobs } from '../lib/session-ai.ts';
export default adminAIJobs;
export const config = { path: '/api/admin/session-ai-jobs', rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
