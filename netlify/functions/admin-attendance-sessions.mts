import { adminAttendanceSessions } from '../lib/admin-attendance.ts';
export default adminAttendanceSessions;
export const config = { path: '/api/admin/attendance/sessions', rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
