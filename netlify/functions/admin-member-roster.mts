import { adminMemberRoster } from '../lib/session-portal.ts';
export default adminMemberRoster;
export const config = { path: '/api/admin/member-roster', rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
