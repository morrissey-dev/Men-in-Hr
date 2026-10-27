import { adminApplications } from '../lib/admin-server.ts';
export default adminApplications;
export const config = { path: '/api/admin/applications', rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
