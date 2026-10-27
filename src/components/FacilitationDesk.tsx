import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { BookOpenText, ClipboardCopy, Download, FilePenLine, Sparkles, Save, ArchiveRestore, Trash2, MessageSquareText, ClipboardCheck, UsersRound, ShieldAlert, Upload } from 'lucide-react';
import { facilitationSessions } from '../data/facilitation-content';
import { adminRequest } from '../lib/admin-auth';
import { createChatGPTPrompt, createFacilitationPlan, type GuestStatus, type SessionEmphasis, type PlanOptions } from '../lib/facilitation-planner';
import { addOrReplace, continuityFor, emptyWorkspace, loadWorkspace, makeFeedbackQuestions, makeFollowUp, makeGuestBrief, makeReminder, parseWorkspace, removeSession, saveWorkspace, type DeliveryStatus, type SessionRecord, type SessionWorkspace } from '../lib/session-management';

type CopyType = 'plan'|'prompt'|'reminder'|'recap'|'brief'|'feedback';
const fileDownload = (name:string, text:string, type:string) => {
  const blob=new Blob([text],{type});
  const href=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=href; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(href),1500);
};
function initialWorkspace(): SessionWorkspace {
  if (typeof window==='undefined') return emptyWorkspace();
  try { return loadWorkspace(window.localStorage); } catch { return emptyWorkspace(); }
}

export default function FacilitationDesk({canCloudSync=false}: {canCloudSync?:boolean}) {
  const [sessionId,setSessionId] = useState('week-1');
  const [guest,setGuest] = useState<GuestStatus>('uncertain');
  const [emphasis,setEmphasis] = useState<SessionEmphasis>('balanced');
  const [attendance,setAttendance] = useState('20');
  const [previousCommitment,setPreviousCommitment] = useState('');
  const [draft,setDraft] = useState('');
  const [draftOptions,setDraftOptions] = useState<PlanOptions|null>(null);
  const [workspace,setWorkspace] = useState<SessionWorkspace>(initialWorkspace);
  const [meetingDate,setMeetingDate] = useState('');
  const [commitment,setCommitment] = useState('');
  const [status,setStatus] = useState<DeliveryStatus>('draft');
  const [turnout,setTurnout] = useState('');
  const [feedbackSummary,setFeedbackSummary] = useState('');
  const [copied,setCopied] = useState<CopyType|null>(null);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [cloudRevision,setCloudRevision] = useState<number|null>(null);
  const [cloudBusy,setCloudBusy] = useState(false);
  const [cloudMessage,setCloudMessage] = useState('Cloud backup is optional, not automatic.');
  const [cloudCopy,setCloudCopy] = useState<SessionWorkspace|null>(null);
  const selected=useMemo(()=>facilitationSessions.find(s=>s.id===sessionId)!,[sessionId]);
  const saved=workspace.sessions[sessionId];
  const continuity=continuityFor(sessionId,workspace);
  const draftBelongsHere=Boolean(draftOptions?.sessionId===sessionId && draft);
  const options={ sessionId, guest, emphasis, attendance:Number(attendance), previousCommitment };

  function chooseSession(value:string) {
    setSessionId(value); setError(''); setNotice(''); setCopied(null);
    setMeetingDate('');setCommitment('');setStatus('draft');setTurnout('');setFeedbackSummary('');
  }
  function generate(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const count=Number(attendance);
    if(!Number.isInteger(count)||count<1||count>80){setError('Expected participants must be between 1 and 80.');return;}
    const current={...options};
    setDraft(createFacilitationPlan(current));setDraftOptions(current);
    setCommitment(selected.commitment);setStatus('draft');setTurnout('');setFeedbackSummary('');
    setError('');setNotice('Plan generated. Use Save draft to retain your edits after refreshing.');setCopied(null);
  }
  function loadSaved(){
    if(!saved)return;
    setDraft(saved.plan);setDraftOptions(saved.options);setGuest(saved.options.guest);
    setEmphasis(saved.options.emphasis);setAttendance(String(saved.options.attendance));
    setPreviousCommitment(saved.options.previousCommitment||'');setMeetingDate(saved.meetingDate);
    setCommitment(saved.commitment);setStatus(saved.status);
    setTurnout(saved.turnout===null?'':String(saved.turnout));setFeedbackSummary(saved.feedbackSummary);
    setError('');setCopied(null);setNotice(`${selected.label} draft restored from this browser.`);
  }
  function saveDraft(){
    setError('');setNotice('');
    if(!draftBelongsHere){setError('Generate or load a plan for the selected session before saving.');return;}
    if(!commitment.trim()){setError('Add a short programme-level commitment.');return;}
    if(feedbackSummary.length>700||commitment.length>220||draft.length>30_000){setError('Shorten the notes or plan before saving.');return;}
    if(turnout!==''&&(!Number.isInteger(Number(turnout))||Number(turnout)<0||Number(turnout)>80)){setError('Turnout must be 0–80 or blank.');return;}
    const record:SessionRecord={sessionId,options:draftOptions!,plan:draft,commitment:commitment.trim(),meetingDate,status,turnout:turnout===''?null:Number(turnout),feedbackSummary:feedbackSummary.trim(),savedAt:new Date().toISOString()};
    try {const updated=addOrReplace(workspace,record);saveWorkspace(window.localStorage,updated);setWorkspace(updated);setNotice('Saved on this device. Download a backup before switching browsers or clearing site data.');}
    catch {setError('Could not save this plan. Your browser may block storage or the storage space may be full. Download the plan instead.');}
  }
  function deleteSaved(){
    if(!saved||!window.confirm(`Delete the saved ${selected.label} record from this browser? This cannot be undone without a backup.`))return;
    try{setWorkspace(removeSession(window.localStorage,workspace,sessionId));setNotice('Saved record deleted from this browser.');setError('');}
    catch{setError('Unable to delete the saved record.');}
  }
  function exportBackup(){fileDownload('men-in-hr-facilitation-backup.json',JSON.stringify(workspace,null,2),'application/json;charset=utf-8');setNotice('Backup downloaded. Keep the file somewhere private.');}
  async function importBackup(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    if(file.size>400_000){setError('Backup exceeds the 400 KB limit.');return;}
    try{
      const parsed=parseWorkspace(await file.text());
      if(!window.confirm('Replace ALL locally saved session records with the imported backup? This will overwrite your current local drafts.'))return;
      saveWorkspace(window.localStorage,parsed);setWorkspace(parsed);setDraft('');setDraftOptions(null);setNotice('Backup imported. Select a session and use Load saved to restore its plan.');setError('');
    }catch {setError('Unable to import. Use a valid Men in HR facilitation backup JSON file.');}
  }
  async function checkCloud(){
    setCloudBusy(true);setError('');
    try{
      const result=await adminRequest<{workspace:SessionWorkspace;revision:number;updatedAt:string|null}>('facilitation-sync');
      setCloudCopy(parseWorkspace(JSON.stringify(result.workspace)));setCloudRevision(result.revision);
      setCloudMessage(result.revision===0?'No cloud copy exists yet. Your local plans were not changed.':`Cloud copy checked (revision ${result.revision}). Your local drafts were not changed.`);
    }catch(e){setCloudRevision(null);setCloudCopy(null);setError(e instanceof Error?e.message:'Cloud backup unavailable.');}
    finally{setCloudBusy(false);}
  }
  async function uploadCloud(){
    if(cloudRevision===null){setError('Check the cloud copy before uploading.');return;}
    if(!window.confirm('Upload all current local plans to the private cloud copy? This will replace the cloud version you checked. Do not include identifiable student details.'))return;
    setCloudBusy(true);setError('');
    try{
      const result=await adminRequest<{revision:number}>('facilitation-sync',{method:'PUT',body:JSON.stringify({workspace,expectedRevision:cloudRevision})});
      setCloudRevision(result.revision);setCloudCopy(workspace);
      setCloudMessage(`Private cloud backup saved (revision ${result.revision}). This is a manual copy, not automatic sync.`);
    }catch(e){setCloudRevision(null);setCloudCopy(null);setError(e instanceof Error?e.message:'Cloud upload failed. Recheck the cloud copy.');}
    finally{setCloudBusy(false);}
  }
  function restoreCloud(){
    if(cloudRevision===null||!cloudCopy||cloudRevision===0){setError('There is no cloud copy to restore.');return;}
    if(!window.confirm('Replace every local saved plan with the checked cloud copy? Download a local backup first if needed.'))return;
    try{saveWorkspace(window.localStorage,cloudCopy);setWorkspace(cloudCopy);setDraft('');setDraftOptions(null);setNotice('Cloud copy restored in this browser.');setError('');}
    catch{setError('Unable to restore cloud copy to this browser.');}
  }
  async function copyText(text:string,kind:CopyType){
    try{await navigator.clipboard.writeText(text);setCopied(kind);setError('');}
    catch{setError('Clipboard unavailable. Select and copy the text manually.');}
  }
  const shareOptions=[
    {id:'reminder' as CopyType,label:'WhatsApp reminder',icon:MessageSquareText,text:makeReminder(sessionId,meetingDate,guest)},
    {id:'recap' as CopyType,label:'Post-session follow-up',icon:ClipboardCheck,text:makeFollowUp(sessionId,commitment)},
    {id:'brief' as CopyType,label:'Guest speaker brief',icon:UsersRound,text:makeGuestBrief(sessionId,meetingDate)},
    {id:'feedback' as CopyType,label:'Feedback questions',icon:ClipboardCheck,text:makeFeedbackQuestions(sessionId)},
  ];

  return <section className="facilitation-desk" aria-label="Personal facilitation and session-management workspace">
    <div className="facilitation-intro"><div><span className="eyebrow"><i/> PERSONAL WORKSPACE · V0.6</span><h3><BookOpenText size={22}/> My facilitation desk</h3><p>Plan, save, prepare communications and review each session from one place. Nothing is sent to members automatically.</p></div><span className="facilitation-private">Restricted to approved facilitator</span></div>
    <div className="facilitation-grid">
      <form className="admin-panel facilitation-form" onSubmit={generate}>
        <h4>Session preparation</h4>
        <label htmlFor="facilitation-session">Choose session</label><select id="facilitation-session" value={sessionId} onChange={e=>chooseSession(e.target.value)}>{facilitationSessions.map(s=><option key={s.id} value={s.id}>{s.label} — {s.title}</option>)}</select>
        <label htmlFor="facilitation-guest">Guest speaker availability</label><select id="facilitation-guest" value={guest} onChange={e=>setGuest(e.target.value as GuestStatus)}><option value="uncertain">Not confirmed — both agendas</option><option value="confirmed">Confirmed — verify details</option><option value="no">No guest expected</option></select>
        <label htmlFor="facilitation-emphasis">Session emphasis</label><select id="facilitation-emphasis" value={emphasis} onChange={e=>setEmphasis(e.target.value as SessionEmphasis)}><option value="balanced">Balanced</option><option value="practical">Practical activity</option><option value="discussion">Guided discussion</option></select>
        <label htmlFor="facilitation-attendance">Expected participants</label><input id="facilitation-attendance" type="number" min={1} max={80} step={1} required value={attendance} onChange={e=>setAttendance(e.target.value)}/>
        {continuity&&<div className="facilitation-continuity"><strong>From {continuity.label} ({continuity.source==='saved'?'saved':'suggested'})</strong><p>{continuity.commitment}</p><p><em>Next check-in:</em> {continuity.checkIn}</p><button type="button" className="admin-text-button" onClick={()=>setPreviousCommitment(continuity.commitment)}>Use this commitment</button></div>}
        <label htmlFor="facilitation-previous">Previous commitment (optional)</label><textarea id="facilitation-previous" rows={2} maxLength={180} value={previousCommitment} onChange={e=>setPreviousCommitment(e.target.value)} placeholder="Programme-level action only, no member names"/>
        <p className="admin-help">Avoid names, personal disclosures, email addresses and confidential student information.</p>
        <button type="submit" className="button button--dark"><FilePenLine size={17}/> Generate 60-minute plan</button>
      </form>
      <div className="admin-panel facilitation-result">
        <h4>Editable facilitation plan</h4>
        {saved && <div className="facilitation-saved"><span><Save size={15}/> Saved {new Date(saved.savedAt).toLocaleString('en-KE', {dateStyle:'medium',timeStyle:'short'})}</span><button type="button" className="button button--outline" onClick={loadSaved}><ArchiveRestore size={15}/> Load saved</button><button type="button" className="admin-text-button" onClick={deleteSaved}><Trash2 size={15}/> Delete saved</button></div>}
        {!draft?<div className="facilitation-empty"><Sparkles size={32}/><p>Prepare a new plan, or load one you saved in this browser.</p></div>:<><label htmlFor="facilitation-draft">Edit your plan (Markdown)</label><textarea id="facilitation-draft" className="facilitation-editor" rows={21} spellCheck value={draft} onChange={e=>{setDraft(e.target.value);setCopied(null)}}/>
          {!draftBelongsHere&&<p className="admin-help" role="status">This editor contains a plan for {facilitationSessions.find(s=>s.id===draftOptions?.sessionId)?.label}; choose that session or load/generate a plan for the current one before saving.</p>}
          <div className="facilitation-actions"><button type="button" className="button button--outline" onClick={()=>void copyText(draft,'plan')}><ClipboardCopy size={17}/> Copy plan</button><button type="button" className="button button--outline" onClick={()=>fileDownload(`men-in-hr-${draftOptions?.sessionId||sessionId}-plan.md`,draft,'text/markdown;charset=utf-8')}><Download size={17}/> Download .md</button><button type="button" className="button button--dark" onClick={()=>draftOptions&&void copyText(createChatGPTPrompt(draftOptions,draft),'prompt')}><Sparkles size={17}/> Copy ChatGPT prompt</button></div>
        </>}
      </div>
    </div>
    <div className="admin-panel facilitation-management"><div className="facilitation-management-heading"><div><h4>Session record & continuity</h4><p>Only programme-level notes. A saved draft stays on this device; it is not synced to Supabase.</p></div><span>{Object.keys(workspace.sessions).length} of 10 sessions saved</span></div>
      <div className="facilitation-metadata">
        <div><label htmlFor="session-date">Meeting date (optional, confirm first)</label><input id="session-date" type="date" value={meetingDate} onChange={e=>setMeetingDate(e.target.value)}/></div>
        <div><label htmlFor="session-state">Session status</label><select id="session-state" value={status} onChange={e=>setStatus(e.target.value as DeliveryStatus)}><option value="draft">Preparing</option><option value="delivered">Delivered</option></select></div>
        <div><label htmlFor="session-turnout">Actual turnout (optional count only)</label><input id="session-turnout" type="number" min={0} max={80} value={turnout} onChange={e=>setTurnout(e.target.value)} placeholder="No names or attendance list"/></div>
        <div className="facilitation-metadata-wide"><label htmlFor="session-commitment">One programme-level commitment</label><textarea id="session-commitment" rows={2} maxLength={220} value={commitment} onChange={e=>setCommitment(e.target.value)} placeholder={selected.commitment}/></div>
        <div className="facilitation-metadata-wide"><label htmlFor="session-summary">Anonymous overall feedback themes (optional)</label><textarea id="session-summary" rows={3} maxLength={700} value={feedbackSummary} onChange={e=>setFeedbackSummary(e.target.value)} placeholder="Example: Members requested more CV examples; shorten the opening discussion."/><p className="admin-help">Do not record individual responses or identifying details. These notes are manually summarised, not submissions collected by this website.</p></div>
      </div>
      <div className="facilitation-actions"><button type="button" className="button button--dark" onClick={saveDraft} disabled={!draftBelongsHere}><Save size={17}/> Save on this device</button><button type="button" className="button button--outline" onClick={exportBackup}><Download size={17}/> Export backup</button><label className="button button--outline facilitation-import"><Upload size={17}/> Import backup<input type="file" accept=".json,application/json" aria-label="Import facilitation backup" onChange={e=>void importBackup(e)}/></label></div>
      {error&&<p className="admin-error" role="alert">{error}</p>}{notice&&<p className="admin-help" role="status">{notice}</p>}
    </div>
    <div className="admin-panel facilitation-management"><h4>Communication & reflection toolkit</h4><p>Review and copy these drafts manually. No message is sent, no link or guest appearance is invented, and no feedback responses are collected by this tool.</p>
      <div className="facilitation-toolkit">{shareOptions.map(tool=><article className="facilitation-tool" key={tool.id}><h5><tool.icon size={17}/>{tool.label}</h5><textarea readOnly aria-label={tool.label+' draft'} value={tool.text} rows={tool.id==='brief'?12:8}/><button type="button" className="button button--outline" onClick={()=>void copyText(tool.text,tool.id)} disabled={tool.id==='recap'&&status!=='delivered'}><ClipboardCopy size={15}/>{tool.id==='recap'&&status!=='delivered'?'Mark delivered to copy':'Copy draft'}</button></article>)}</div>
      {copied&&<p className="admin-help" role="status">{copied==='prompt'?'ChatGPT refinement prompt':copied==='plan'?'Facilitation plan':shareOptions.find(s=>s.id===copied)?.label} copied. Review before sharing.</p>}
    </div>
    {canCloudSync && <div className="admin-panel facilitation-cloud">
      <h4>Private cloud backup (manual)</h4>
      <p>Only your authorised account can access this backup. Check the cloud version before uploading or restoring. This does not automatically synchronise changes across devices.</p>
      <div className="facilitation-cloud-actions">
        <button type="button" className="button button--outline" disabled={cloudBusy} onClick={()=>void checkCloud()}>Check cloud copy</button>
        <button type="button" className="button button--dark" disabled={cloudBusy||cloudRevision===null} onClick={()=>void uploadCloud()}>Upload local plans</button>
        <button type="button" className="button button--outline" disabled={cloudBusy||cloudRevision===null||cloudRevision===0} onClick={restoreCloud}>Restore checked copy</button>
      </div>
      <p className="admin-help" role="status">{cloudMessage}</p>
    </div>}
    <div className="facilitation-note"><ShieldAlert size={19}/><div><strong>Privacy and backups:</strong> Saved notes use this browser's local storage, not a protected central database. Avoid shared devices and sensitive data. Clearing browser data can erase saved work; download an offline backup regularly. ChatGPT Plus can help refine plans using the copy prompt, but never paste identifiable student feedback into AI.</div></div>
  </section>;
}
