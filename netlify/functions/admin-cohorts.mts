import { adminCohorts } from '../lib/admin-server.ts';
export default adminCohorts;
export const config = { path: '/api/admin/cohorts', rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
