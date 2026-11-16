import { adminAttendanceImports } from '../lib/attendance-imports.ts';
export default adminAttendanceImports;
export const config = { path: '/api/admin/attendance/imports', rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
