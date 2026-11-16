import { adminInviteMember } from '../lib/session-portal.ts';
export default adminInviteMember;
export const config = { path: '/api/admin/member-invite', rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
