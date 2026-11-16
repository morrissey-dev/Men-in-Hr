import { memberResources } from '../lib/session-portal.ts';
export default memberResources;
export const config = { path: '/api/member/resources', rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
