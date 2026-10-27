import { facilitationSessions, type SessionTemplate } from '../data/facilitation-content.ts';
export type GuestStatus = 'confirmed' | 'no' | 'uncertain';
export type SessionEmphasis = 'balanced' | 'practical' | 'discussion';
export type PlanOptions = {
  sessionId: string;
  guest: GuestStatus;
  emphasis: SessionEmphasis;
  attendance: number;
  previousCommitment?: string;
};

type Segment = { minutes: number; description: string };
const sessionById = (id: string): SessionTemplate => {
  const found = facilitationSessions.find(s => s.id === id);
  if (!found) throw new Error('Unknown session');
  return found;
};

function agenda(guest: boolean, emphasis: SessionEmphasis, t: SessionTemplate): Segment[] {
  const dialogue = guest ? (emphasis === 'practical' ? 13 : 16) : 0;
  const discussion = guest ? (emphasis === 'discussion' ? 16 : emphasis === 'practical' ? 7 : 10)
    : (emphasis === 'discussion' ? 22 : emphasis === 'practical' ? 10 : 15);
  const practical = guest ? (emphasis === 'discussion' ? 9 : emphasis === 'practical' ? 21 : 15)
    : (emphasis === 'discussion' ? 13 : emphasis === 'practical' ? 25 : 20);
  const concluding = guest ? 3 : 4;
  const peer = guest ? 4 : 9;
  // 5 + 7 + discussion + dialogue + practical + peer + concluding = 60
  const practicalAdjusted = practical;
  return [
    { minutes: 5, description: 'Welcome, check-in and one-sentence session goal' },
    { minutes: 7, description: `Low-pressure icebreaker: ${t.icebreaker}` },
    { minutes: discussion, description: 'Guided group conversation: start with questions 1–2 below' },
    ...(guest ? [{ minutes: dialogue, description: 'Guest HR practitioner dialogue: use the three suggested questions' }] : []),
    { minutes: practicalAdjusted, description: `Live practical activity: ${t.activity}` },
    { minutes: peer, description: `Peer sharing and final reflection: ${t.sharing} Bring in questions 3–4.` },
    { minutes: concluding, description: `One commitment and closing: ${t.commitment}` },
  ];
}

export function makeAgenda(options: PlanOptions, withGuest: boolean): Segment[] {
  const t = sessionById(options.sessionId);
  if (!['balanced','practical','discussion'].includes(options.emphasis)) throw new Error('Invalid session emphasis');
  const segments = agenda(withGuest, options.emphasis, t);
  if (segments.reduce((n, x) => n + x.minutes, 0) !== 60) throw new Error('Agenda must add up to 60 minutes');
  return segments;
}

function formatAgenda(segments: Segment[]): string {
  let elapsed = 0;
  return segments.map(s => {
    const from = elapsed;
    elapsed += s.minutes;
    return `- **${String(from).padStart(2, '0')}–${String(elapsed).padStart(2,'0')} min** (${s.minutes} min): ${s.description}`;
  }).join('\n');
}

export function createFacilitationPlan(options: PlanOptions): string {
  const t = sessionById(options.sessionId);
  const count = Math.max(1, Math.min(80, Math.round(Number.isFinite(options.attendance) ? options.attendance : 20)));
  const previous = (options.previousCommitment || '').trim().slice(0, 180);
  const meetingTime = options.sessionId.startsWith('preliminary-') ? '60-minute preliminary virtual engagement (date and time to be confirmed)' : '60-minute virtual session; Thursdays at 8:00 pm EAT (confirm the actual date)';
  const header = `# Men in HR — ${t.label}: ${t.title}\n\n**Format:** ${meetingTime}.  **Expected participants:** ${count}.\n**Facilitator:** Morris Njeru.  **Guest:** ${options.guest === 'confirmed' ? 'confirmed (verify speaker and availability)' : options.guest === 'uncertain' ? 'not yet confirmed; both agenda options provided' : 'no guest expected'}.\n\n## 1. Session goal\n${t.goal}`;
  const guestAgenda = options.guest === 'confirmed' || options.guest === 'uncertain';
  const agendas = options.guest === 'uncertain'
    ? `## 2. Timed agenda — Plan A: guest attends\n${formatAgenda(makeAgenda(options,true))}\n\n### Plan B: guest unavailable\n${formatAgenda(makeAgenda(options,false))}`
    : `## 2. Timed agenda — ${guestAgenda ? 'guest joins' : 'facilitator-led'}\n${formatAgenda(makeAgenda(options, guestAgenda))}`;
  const prev = previous ? `\n\n**Link to last week:** Ask, without naming anyone, “How did we do on our previous commitment: ${previous.replace(/[\r\n]/g,' ')}?” Participation is optional.` : '';
  const small = count < 8 ? 'Because turnout may be small, keep everyone in one group and invite optional chat responses.' : 'If a group feels too large or quiet, use pairs or chat responses; no breakout room is essential.';
  return `${header}${prev}\n\n${agendas}\n\n## 3. Icebreaker\n${t.icebreaker}\n\n## 4. Four discussion questions (easy → deeper)\n${t.questions.map((q,i)=>`${i+1}. ${q}`).join('\n')}\n\n## 5. Live practical activity\n${t.activity}\n**Peer-learning close:** ${t.sharing}\n\n## 6. If a guest HR professional joins\n${t.guestQuestions.map((q,i)=>`${i+1}. ${q}`).join('\n')}\n**If the guest cannot join:** Use the facilitator-led agenda. Do not present an unconfirmed guest as attending.\n\n## 7. One commitment and next check-in\n**Commitment:** ${t.commitment}\n**Next check-in:** ${t.nextCheckIn}\nMembers may state their action, type it in chat, or privately record it.\n\n## 8. Facilitator tip\n${t.tip}\n\n## Low-bandwidth and small-group fallback\n${small} Cameras are optional. Read key instructions aloud and paste a short activity prompt into chat; avoid downloads or long videos.\n\n## Facilitation notes\n- Invite participation without making anyone disclose personal experiences, health, finances or private workplace issues.\n- Do not share identifiable participant responses with AI services.\n- All timings are suggestions; adjust in the moment, while aiming to finish at 60 minutes.\n`;
}

export function createChatGPTPrompt(options: PlanOptions, draft: string): string {
  const t = sessionById(options.sessionId);
  return `Act as a practical, culturally aware facilitation coach supporting Morris Njeru, Vice President of JKUAT HRSA, with the Men in HR mentorship initiative. Review and strengthen the following DRAFT session plan. Preserve its accurate programme details and 60-minute structure, improve flow and clarity, and return a complete ready-to-use plan with a low-pressure icebreaker, four progressive questions, a feasible live activity, optional guest questions, a no-guest fallback, a concrete commitment, next-week check-in, and a facilitator tip. Use Kenyan university life and HR career examples (attachment, internships, HRMPEB, IHRM, CHRP). Keep it realistic for about ${Math.max(1, Math.min(80, Math.round(options.attendance || 20)))} virtual participants and low data costs. Topic: ${t.label} — ${t.title}. Guest status: ${options.guest}. Never fabricate guest availability, student information, credentials, or current certification requirements. Do not request sensitive participant details. Ask one brief question only if absolutely necessary.\n\nDRAFT TO IMPROVE:\n\n${draft.slice(0, 26000)}`;
}
