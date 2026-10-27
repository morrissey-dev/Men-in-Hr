import { describe,expect,it } from 'vitest';
import { facilitationSessions } from '../data/facilitation-content';
import type { PlanOptions } from './facilitation-planner';
import { addOrReplace, continuityFor, emptyWorkspace, getSessionTemplate, loadWorkspace, makeFeedbackQuestions, makeFollowUp, makeGuestBrief, makeReminder, parseWorkspace, previousSessionId, removeSession, saveWorkspace, WORKSPACE_KEY, type KeyValueStore, type SessionRecord } from './session-management';
const options:PlanOptions={sessionId:'week-1',guest:'no',emphasis:'balanced',attendance:20};
const sample:SessionRecord={sessionId:'week-1',options,plan:'# A safe programme-only plan',commitment:'Identify one seven-day goal',meetingDate:'',status:'draft',turnout:null,feedbackSummary:'',savedAt:'2026-10-28T09:00:00.000Z'};
function fakeStore():KeyValueStore {
  const values=new Map<string,string>();
  return {getItem:(k)=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v)},removeItem:(k)=>{values.delete(k)}};
}
describe('session workspace v0.6',()=>{
  it('initialises an empty workspace without storing private details',()=>{
    const s=fakeStore();expect(loadWorkspace(s)).toEqual({version:1,sessions:{}});expect(s.getItem(WORKSPACE_KEY)).toBeNull();
  });
  it('saves and restores a single editable plan after reload',()=>{
    const s=fakeStore();const updated=addOrReplace(emptyWorkspace(),sample);saveWorkspace(s,updated);
    expect(loadWorkspace(s).sessions['week-1']).toEqual(sample);
    expect(s.getItem(WORKSPACE_KEY)).not.toContain('secret_key');
  });
  it('overwrites only the selected session without losing other weeks',()=>{
    const first=addOrReplace(emptyWorkspace(),sample);
    const second={...sample,sessionId:'week-2',options:{...options,sessionId:'week-2'},plan:'# Week 2'};
    const result=addOrReplace(first,second);
    expect(Object.keys(result.sessions)).toEqual(['week-1','week-2']);
    expect(result.sessions['week-1'].plan).toContain('Week');
    const s=fakeStore();saveWorkspace(s,result);expect(removeSession(s,result,'week-1').sessions['week-2']).toBeDefined();
    expect(loadWorkspace(s).sessions['week-1']).toBeUndefined();
  });
  it('rejects invalid, oversized and mismatched imported files',()=>{
    expect(()=>parseWorkspace('{bad')).toThrow();
    expect(()=>parseWorkspace(JSON.stringify({version:2,sessions:{}}))).toThrow();
    expect(()=>parseWorkspace(JSON.stringify({version:1,sessions:{'week-2':sample}}))).toThrow();
    expect(()=>parseWorkspace(JSON.stringify({version:1,sessions:{'week-1':{...sample,plan:'x'.repeat(30001)}}}))).toThrow();
    expect(()=>parseWorkspace('x'.repeat(400001))).toThrow('too large');
    expect(()=>parseWorkspace(JSON.stringify({version:1,sessions:{'week-1':{...sample,turnout:300}}}))).toThrow();
  });
  it('links a session to the previous saved commitment or template',()=>{
    expect(previousSessionId('preliminary-1')).toBeNull();
    expect(previousSessionId('week-1')).toBe('preliminary-2');
    expect(continuityFor('week-2',emptyWorkspace())?.source).toBe('template');
    const w=addOrReplace(emptyWorkspace(),sample);
    expect(continuityFor('week-2',w)?.commitment).toBe(sample.commitment);
    expect(continuityFor('week-2',w)?.source).toBe('saved');
    expect(continuityFor('preliminary-1',w)).toBeNull();
  });
  it('creates credible guest briefs, WhatsApp and reflection templates for all ten sessions',()=>{
    expect(facilitationSessions).toHaveLength(10);
    for(const session of facilitationSessions){
      const reminder=makeReminder(session.id,'','uncertain');
      expect(reminder).toContain(session.title);
      expect(reminder).not.toMatch(/https?:\/\//);
      const guest=makeGuestBrief(session.id);
      for(const q of session.guestQuestions)expect(guest).toContain(q);
      expect(makeFollowUp(session.id,'')).toContain(session.nextCheckIn);
      expect(makeFeedbackQuestions(session.id)).toContain('optional');
    }
    expect(makeReminder('preliminary-1')).toContain('date to be confirmed');
    expect(makeReminder('week-3')).toContain('8:00–9:00 PM EAT');
    expect(makeGuestBrief('week-2')).toContain('not a confirmed invitation');
    expect(getSessionTemplate('week-7').activity).toContain('KSh');
  });
});
