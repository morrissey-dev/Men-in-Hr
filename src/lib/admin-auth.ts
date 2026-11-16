import { createClient } from '@supabase/supabase-js';

// Only a public project URL and PUBLISHABLE key are exposed to the browser.
// Admin membership and private database keys are checked ONLY in Netlify functions.
const url = import.meta.env.VITE_SUPABASE_URL || '';
const publishable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const adminLoginAvailable = import.meta.env.VITE_ADMIN_LOGIN_ENABLED === 'true'
  && /^https:\/\/[\w-]+\.supabase\.co\/?$/.test(url)
  && Boolean(publishable);

export const memberLoginAvailable = import.meta.env.VITE_MEMBER_LOGIN_ENABLED === 'true'
  && /^https:\/\/[\w-]+\.supabase\.co\/?$/.test(url)
  && Boolean(publishable);

export const adminAuth = (adminLoginAvailable || memberLoginAvailable) ? createClient(url, publishable, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

async function authenticatedRequest<T>(urlPath: string, init: RequestInit): Promise<T> {
  if (!adminAuth) throw new Error('Administration has not been configured.');
  const { data: { session }, error } = await adminAuth.auth.getSession();
  if (error || !session?.access_token) throw new Error('Session expired. Sign in again.');
  const response = await fetch(urlPath, {
    ...init,
    headers: { Authorization: `Bearer ${session.access_token}`, Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error || 'The action could not be completed.');
  return body as T;
}

export async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!adminLoginAvailable) throw new Error('Administration has not been configured.');
  return authenticatedRequest<T>(`/api/admin/${path}`, init);
}

export async function adminDownload(path: string, filename: string): Promise<void> {
  if (!adminLoginAvailable || !adminAuth) throw new Error('Administration has not been configured.');
  const { data: { session }, error } = await adminAuth.auth.getSession();
  if (error || !session?.access_token) throw new Error('Session expired. Sign in again.');
  const response = await fetch(`/api/admin/${path}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || 'The download could not be prepared.');
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function memberRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!memberLoginAvailable) throw new Error('Member access has not been configured.');
  return authenticatedRequest<T>(`/api/member/${path}`, init);
}
