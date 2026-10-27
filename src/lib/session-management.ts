/** Facilitation-owned material ONLY. No student names, individual feedback, or contact details. */
import { facilitationSessions } from '../data/facilitation-content';
import type { PlanOptions } from './facilitation-planner';

export const WORKSPACE_KEY = 'men-in-hr:facilitation-workspace:v1';
const MAX_TEXT = 30_000;
const MAX_SUMMARY = 700;
const MAX_BACKUP_BYTES = 400_000;
const validIds = new Set(facilitationSessions.map(item => item.id));
export type DeliveryStatus = 'draft' | 'delivered';
export type SessionRecord = {
  sessionId: string;
  options: PlanOptions;
  plan: string;
  commitment: string;
  meetingDate: string;
  status: DeliveryStatus;
  turnout: number | null;
  feedbackSummary: string;
  savedAt: string;
};
export type SessionWorkspace = { version: 1; sessions: Record<string, SessionRecord> };
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function emptyWorkspace(): SessionWorkspace { return { version: 1, sessions: {} }; }
function assertRecord(value: unknown): SessionRecord {
  if (!value || typeof value !== 'object') throw new Error('Invalid session entry');
  const s = value as Record<string, unknown>;
  if (typeof s.sessionId !== 'string' || !validIds.has(s.sessionId)) throw new Error('Unknown session');
  if (typeof s.plan !== 'string' || s.plan.length === 0 || s.plan.length > MAX_TEXT) throw new Error('Invalid plan length');
  const opts = s.options as Partial<PlanOptions> | undefined;
  if (!opts || opts.sessionId !== s.sessionId || !['confirmed','no','uncertain'].includes(String(opts.guest)) || !['balanced','practical','discussion'].includes(String(opts.emphasis)) || typeof opts.attendance !== 'number' || !Number.isInteger(opts.attendance) || opts.attendance < 1 || opts.attendance > 80 || (opts.previousCommitment !== undefined && (typeof opts.previousCommitment !== 'string' || opts.previousCommitment.length > 180))) throw new Error('Invalid session options');
  if (typeof s.commitment !== 'string' || s.commitment.length > 220) throw new Error('Invalid commitment');
  if (typeof s.meetingDate !== 'string' || (s.meetingDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(s.meetingDate))) throw new Error('Invalid meeting date');
  if (s.status !== 'draft' && s.status !== 'delivered') throw new Error('Invalid delivery status');
  if (s.turnout !== null && (typeof s.turnout !== 'number' || !Number.isInteger(s.turnout) || s.turnout < 0 || s.turnout > 80)) throw new Error('Invalid attendance');
  if (typeof s.feedbackSummary !== 'string' || s.feedbackSummary.length > MAX_SUMMARY) throw new Error('Invalid feedback summary');
  if (typeof s.savedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(s.savedAt) || Number.isNaN(Date.parse(s.savedAt))) throw new Error('Invalid save timestamp');
  return { sessionId: s.sessionId, options: { sessionId: opts.sessionId, guest: opts.guest as PlanOptions['guest'], emphasis: opts.emphasis as PlanOptions['emphasis'], attendance: opts.attendance, previousCommitment: opts.previousCommitment || '' }, plan: s.plan, commitment: s.commitment, meetingDate: s.meetingDate, status: s.status, turnout: s.turnout as number | null, feedbackSummary: s.feedbackSummary, savedAt: s.savedAt };
}
export function parseWorkspace(json: string): SessionWorkspace {
  if (json.length > MAX_BACKUP_BYTES) throw new Error('Backup is too large');
  const value: unknown = JSON.parse(json);
  if (!value || typeof value !== 'object' || (value as {version?: unknown}).version !== 1) throw new Error('Unsupported workspace format');
  const sessions = (value as {sessions?: unknown}).sessions;
  if (!sessions || typeof sessions !== 'object' || Array.isArray(sessions)) throw new Error('Missing sessions');
  const entries = Object.entries(sessions);
  if (entries.length > facilitationSessions.length) throw new Error('Too many sessions');
  const records: Record<string,SessionRecord> = {};
  for (const [key, data] of entries) {
    const record = assertRecord(data);
    if (record.sessionId !== key) throw new Error('Session key mismatch');
    records[key] = record;
  }
  return {version:1, sessions:records};
}
export function loadWorkspace(store: KeyValueStore): SessionWorkspace {
  const saved = store.getItem(WORKSPACE_KEY);
  return saved ? parseWorkspace(saved) : emptyWorkspace();
}
export function saveWorkspace(store: KeyValueStore, workspace: SessionWorkspace): void {
  const safe = parseWorkspace(JSON.stringify(workspace));
  store.setItem(WORKSPACE_KEY, JSON.stringify(safe));
}
export function addOrReplace(workspace: SessionWorkspace, record: SessionRecord): SessionWorkspace {
  const clean = assertRecord(record);
  return parseWorkspace(JSON.stringify({ version:1, sessions:{...workspace.sessions, [clean.sessionId]:clean} }));
}
export function removeSession(store: KeyValueStore, workspace: SessionWorkspace, sessionId: string): SessionWorkspace {
  if (!validIds.has(sessionId)) throw new Error('Unknown session');
  const next = { ...workspace.sessions };
  delete next[sessionId];
  const updated = { version:1 as const, sessions:next };
  saveWorkspace(store, updated);
  return updated;
}
export function previousSessionId(sessionId: string): string | null {
  const index = facilitationSessions.findIndex(t => t.id === sessionId);
  if (index <= 0) return null;
  return facilitationSessions[index - 1].id;
}
export function continuityFor(sessionId: string, workspace: SessionWorkspace): {label:string; commitment:string; checkIn:string; source:'saved'|'template'} | null {
  const prevId = previousSessionId(sessionId);
  if (!prevId) return null;
  const previous = facilitationSessions.find(t => t.id === prevId)!;
  const saved = workspace.sessions[prevId];
  return {label: previous.label, commitment: saved?.commitment.trim() || previous.commitment, checkIn: previous.nextCheckIn, source:saved?.commitment.trim()?'saved':'template'};
}
export function getSessionTemplate(sessionId:string) {
  const session = facilitationSessions.find(t=>t.id===sessionId);
  if (!session) throw new Error('Unknown session');
  return session;
}
function schedule(sessionId: string, date: string): string {
  getSessionTemplate(sessionId);
  const dateText = date ? `${date} (confirm EAT schedule)` : 'date to be confirmed';
  return sessionId.startsWith('preliminary-') ? dateText : `${dateText}; planned Thursdays, 8:00–9:00 PM EAT`;
}
export function makeReminder(sessionId:string, date = '', guest:'confirmed'|'no'|'uncertain'='uncertain'):string {
  const t = getSessionTemplate(sessionId);
  const guestPart = guest === 'confirmed' ? 'We hope to have a guest HR practitioner joining us; final details will be confirmed.' : '';
  return `Hello everyone! 👋\n\nA reminder about our Men in HR ${t.label.toLowerCase()}: *${t.title}*.\n\n📅 ${schedule(sessionId,date)}\n💻 Virtual session; the joining link will be shared through our official channel.\n\nWe'll have an interactive conversation, a short practical activity and a takeaway for the week. Feel free to join by voice or chat; cameras are optional.\n\n${guestPart ? guestPart+'\n\n' : ''}Please come ready with one question or idea. See you there!\n\n— Men in HR coordination`.trim();
}
export function makeFollowUp(sessionId:string, commitment:string):string {
  const t = getSessionTemplate(sessionId);
  const action = commitment.trim() || t.commitment;
  return `Hello everyone! Thank you for taking part in our Men in HR ${t.label.toLowerCase()} discussion on *${t.title}*.\n\nOur suggested takeaway is: ${action}\n\nBefore our next meeting, try that one practical action at your own pace. You can keep your reflection private; there's no need to post personal details in the group.\n\nAt our next check-in we'll consider: ${t.nextCheckIn}\n\nThanks for being part of the journey!`;
}
export function makeGuestBrief(sessionId:string, date = ''):string {
  const t = getSessionTemplate(sessionId);
  return `# Optional guest-speaker brief — ${t.label}: ${t.title}\n\n**Proposed session:** ${schedule(sessionId,date)}\n**Format:** One-hour virtual student mentorship session; guest segment approximately 13–16 minutes depending on the agenda.\n**Goal:** ${t.goal}\n\n## Suggested facilitator questions\n${t.guestQuestions.map((q,i)=>`${i+1}. ${q}`).join('\n')}\n\n## Before confirming\n- Ask about the guest's availability and preferred contribution.\n- Confirm what professional biography, credentials and photo (if any) may be published.\n- Share the proposed questions and expected time allocation.\n- Agree a backup facilitator-led plan if the guest is unavailable.\n\n*This is an internal draft, not a confirmed invitation or announcement.*`;
}
export function makeFeedbackQuestions(sessionId:string):string {
  const t = getSessionTemplate(sessionId);
  return `# Quick feedback — ${t.label}: ${t.title}\n\n1. How useful was today's session? (1 = not useful, 5 = very useful)\n2. Which idea or activity helped you most? (optional, short answer)\n3. What should we change to make the next online session more useful? (optional)\n4. Do you feel you have one achievable next action? (yes / partly / not yet)\n\n*Please don't include names, health details, personal finances or identifiable workplace stories. Responses should be optional and anonymised before the facilitator records aggregate themes.*`;
}
