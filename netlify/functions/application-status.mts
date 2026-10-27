import { readPublicStatus, json } from '../lib/application-server.ts';

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  return json(await readPublicStatus());
}

export const config = { path: '/api/application-status' };
