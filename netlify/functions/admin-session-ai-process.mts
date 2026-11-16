import { adminAIProcess } from '../lib/session-ai.ts';
export default adminAIProcess;
export const config = { path: '/api/admin/session-ai-process', background: true, rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
