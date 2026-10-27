export type ApplicationStatus = {
  open: boolean;
  cohortName?: string;
  privacyController?: string;
  privacyEmail?: string;
  retentionDays?: number;
  turnstileSiteKey?: string;
  noticeVersion?: string;
};

export async function getApplicationStatus(): Promise<ApplicationStatus> {
  try {
    const response = await fetch('/api/application-status', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('application/json')) return { open: false };
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null || !('open' in body)) return { open: false };
    return body as ApplicationStatus;
  } catch { return { open: false }; }
}
