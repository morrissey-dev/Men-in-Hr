import { describe, expect, it } from 'vitest';
import { facilitationSessions } from '../data/facilitation-content';
import { createChatGPTPrompt, createFacilitationPlan, makeAgenda } from './facilitation-planner';

describe('personal facilitation planner', () => {
  it('covers two preliminary engagements and all eight mentorship weeks', () => {
    expect(facilitationSessions.map(s=>s.id)).toEqual(['preliminary-1','preliminary-2',...Array.from({length:8}, (_,i)=>`week-${i+1}`)]);
  });
  it('creates exactly 60 minutes for each session, emphasis and guest status', () => {
    for (const session of facilitationSessions) {
      for (const emphasis of ['balanced','discussion','practical'] as const) {
        for (const withGuest of [true,false]) {
          const blocks=makeAgenda({sessionId:session.id,guest:withGuest?'confirmed':'no',emphasis,attendance:20},withGuest);
          expect(blocks.reduce((sum,block)=>sum+block.minutes,0)).toBe(60);
          expect(blocks.every(block=>block.minutes>0)).toBe(true);
        }
      }
    }
  });
  it('does not invent a schedule for preliminary engagement meetings', () => {
    const p=createFacilitationPlan({sessionId:'preliminary-1',guest:'no',emphasis:'balanced',attendance:20});
    expect(p).toContain('date and time to be confirmed');
    expect(p).not.toContain('Thursdays at 8:00 pm');
  });
  it('gives both complete fallback agendas for unconfirmed guests', () => {
    const plan = createFacilitationPlan({sessionId:'week-2',guest:'uncertain',emphasis:'balanced',attendance:20});
    expect(plan).toContain('Plan A: guest attends');
    expect(plan).toContain('Plan B: guest unavailable');
    expect(plan).toContain('CHRP');
    expect(plan).toContain('4.');
    expect(plan).toContain('60-minute virtual session');
  });
  it('uses relevant, low-pressure and privacy-conscious examples', () => {
    const plan=createFacilitationPlan({sessionId:'week-7',guest:'no',emphasis:'practical',attendance:5});
    expect(plan).toContain('KSh 2,000');
    expect(plan).toContain('Cameras are optional');
    expect(plan).toContain('small');
    expect(plan).toContain('privately record');
  });
  it('produces a self-contained ChatGPT improvement prompt without making API calls', () => {
    const options={sessionId:'week-3',guest:'no' as const,emphasis:'balanced' as const,attendance:20};
    const draft=createFacilitationPlan(options);
    expect(createChatGPTPrompt(options,draft)).toContain('DRAFT TO IMPROVE:');
    expect(createChatGPTPrompt(options,draft)).toContain('Never fabricate guest availability');
  });
});
