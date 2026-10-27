import { adminFacilitationSync } from '../lib/facilitation-cloud-server.ts';
export default adminFacilitationSync;
export const config = { path: '/api/admin/facilitation-sync', rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
