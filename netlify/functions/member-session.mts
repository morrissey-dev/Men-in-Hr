import { memberSession } from '../lib/session-portal.ts';
export default memberSession;
export const config = { path: '/api/member/session', rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
