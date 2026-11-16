import { adminSessionResources } from '../lib/session-portal.ts';
export default adminSessionResources;
export const config = { path: '/api/admin/session-resources', rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
