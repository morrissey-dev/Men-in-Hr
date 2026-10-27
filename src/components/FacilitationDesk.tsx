import { useState, type FormEvent } from 'react';
import { BookOpenText, ClipboardCopy, Download, FilePenLine, Sparkles } from 'lucide-react';
import { facilitationSessions } from '../data/facilitation-content';
import { createChatGPTPrompt, createFacilitationPlan, type GuestStatus, type SessionEmphasis } from '../lib/facilitation-planner';

type ClipboardState = 'idle' | 'plan' | 'prompt' | 'error';
export default function FacilitationDesk() {
  const [sessionId, setSessionId] = useState('week-1');
  const [guest, setGuest] = useState<GuestStatus>('uncertain');
  const [emphasis, setEmphasis] = useState<SessionEmphasis>('balanced');
  const [attendance, setAttendance] = useState('20');
  const [previousCommitment, setPreviousCommitment] = useState('');
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState<ClipboardState>('idle');
  const [error, setError] = useState('');
  const options = { sessionId, guest, emphasis, attendance: Number(attendance), previousCommitment };

  function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number.isInteger(Number(attendance)) || Number(attendance) < 1 || Number(attendance) > 80) {
      setError('Enter an expected attendance from 1 to 80.'); return;
    }
    setDraft(createFacilitationPlan(options)); setError(''); setCopied('idle');
  }
  async function copyText(text: string, kind: ClipboardState) {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); setCopied(kind); }
    catch { setCopied('error'); }
  }
  function download() {
    if (!draft) return;
    const file = new Blob([draft], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = `men-in-hr-${sessionId}-facilitation-plan.md`;
    a.click(); URL.revokeObjectURL(url);
  }
  const copyPrompt = () => void copyText(createChatGPTPrompt(options, draft), 'prompt');

  return <section className="facilitation-desk" aria-label="Personal facilitation planner">
    <div className="facilitation-intro">
      <div><span className="eyebrow"><i/> PERSONAL WORKSPACE</span><h3><BookOpenText size={22}/> My facilitation desk</h3>
        <p>Prepare one-hour Men in HR sessions with structured plans. Your drafts stay in this browser tab unless you choose to copy or download them.</p></div>
      <span className="facilitation-private">Restricted to one approved facilitator</span>
    </div>
    <div className="facilitation-grid">
      <form className="admin-panel facilitation-form" onSubmit={generate}>
        <h4>Session details</h4>
        <label htmlFor="facilitation-session">Choose session</label>
        <select id="facilitation-session" value={sessionId} onChange={event=>setSessionId(event.target.value)}>{facilitationSessions.map(s=><option key={s.id} value={s.id}>{s.label} — {s.title}</option>)}</select>
        <label htmlFor="facilitation-guest">Guest speaker</label>
        <select id="facilitation-guest" value={guest} onChange={e=>setGuest(e.target.value as GuestStatus)}><option value="uncertain">Not confirmed (produce both plans)</option><option value="confirmed">Confirmed</option><option value="no">No guest speaker</option></select>
        <label htmlFor="facilitation-emphasis">Session emphasis</label>
        <select id="facilitation-emphasis" value={emphasis} onChange={e=>setEmphasis(e.target.value as SessionEmphasis)}><option value="balanced">Balanced</option><option value="practical">More practical activity</option><option value="discussion">More discussion</option></select>
        <label htmlFor="facilitation-attendance">Expected attendance</label>
        <input id="facilitation-attendance" type="number" min={1} max={80} step={1} required value={attendance} onChange={e=>setAttendance(e.target.value)}/>
        <label htmlFor="facilitation-previous">Previous week's commitment (optional)</label>
        <textarea id="facilitation-previous" rows={3} maxLength={180} value={previousCommitment} onChange={e=>setPreviousCommitment(e.target.value)} placeholder="Example: identify a personal strength and set a seven-day goal"/>
        <p className="admin-help">Use only programme-level wording. Do not enter students' names, personal experiences or confidential information.</p>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <button type="submit" className="button button--dark"><FilePenLine size={17}/> Prepare 60-minute plan</button>
      </form>
      <div className="admin-panel facilitation-result">
        <h4>Editable facilitation plan</h4>
        {!draft ? <div className="facilitation-empty"><Sparkles size={32}/><p>Choose a session and prepare your first plan. You can edit the entire result before saving or using ChatGPT to refine it.</p></div> : <>
          <label htmlFor="facilitation-draft">Edit your plan (Markdown)</label>
          <textarea id="facilitation-draft" className="facilitation-editor" rows={24} spellCheck value={draft} onChange={e=>{setDraft(e.target.value);setCopied('idle')}}/>
          <div className="facilitation-actions"><button type="button" className="button button--outline" onClick={()=>void copyText(draft, 'plan')}><ClipboardCopy size={17}/> Copy plan</button><button type="button" className="button button--outline" onClick={download}><Download size={17}/> Download .md</button><button type="button" className="button button--dark" onClick={copyPrompt}><Sparkles size={17}/> Copy prompt for ChatGPT</button></div>
          <p role="status" className="admin-help">{copied==='plan'?'Plan copied.':copied==='prompt'?'ChatGPT prompt copied. Open ChatGPT, paste it and ask for improvements.':copied==='error'?'Clipboard unavailable here; select the text manually.':'Plans are not saved to the server. Download before refreshing this page.'}</p>
        </>}
      </div>
    </div>
    <div className="facilitation-note"><strong>About AI:</strong> This first release creates plans from reviewed programme templates. It does not call a paid AI API. Use “Copy prompt for ChatGPT” to refine the draft with your ChatGPT Plus trial; nothing is sent automatically, and you should review all suggested changes.</div>
  </section>;
}
