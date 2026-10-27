import { createClient } from '@supabase/supabase-js';

// Only a public project URL and PUBLISHABLE key are exposed to the browser.
// Admin membership and private database keys are checked ONLY in Netlify functions.
const url = import.meta.env.VITE_SUPABASE_URL || '';
const publishable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const adminLoginAvailable = import.meta.env.VITE_ADMIN_LOGIN_ENABLED === 'true'
  && /^https:\/\/[\w-]+\.supabase\.co\/?$/.test(url)
  && Boolean(publishable);

export const adminAuth = adminLoginAvailable ? createClient(url, publishable, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

export async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!adminAuth) throw new Error('Administration has not been configured.');
  const { data: { session }, error } = await adminAuth.auth.getSession();
  if (error || !session?.access_token) throw new Error('Session expired. Sign in again.');
  const response = await fetch(`/api/admin/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${session.access_token}`, Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error || 'The action could not be completed.');
  return body as T;
}
