/** Programme-owned prompts for the personal facilitator desk. No participant data. */
export type SessionTemplate = {
  id: string;
  label: string;
  title: string;
  goal: string;
  icebreaker: string;
  questions: [string, string, string, string];
  activity: string;
  sharing: string;
  guestQuestions: [string, string, string];
  commitment: string;
  nextCheckIn: string;
  tip: string;
};

export const facilitationSessions: SessionTemplate[] = [
  {
    id: 'preliminary-1', label: 'Preliminary engagement 1', title: 'Getting to Know Men in HR',
    goal: 'Participants understand why Men in HR exists and feel comfortable contributing to the conversation.',
    icebreaker: 'In chat, share one word you associate with a supportive university community; passing is fine.',
    questions: ['What comes to mind when you hear “Men in HR”?', 'What makes students feel welcome at a campus activity?', 'What might stop a male HR student from joining a mentorship programme?', 'What would make these sessions worth returning to?'],
    activity: 'In pairs or individually, write one expectation and one practical way to make the programme welcoming; collect themes without attaching names.',
    sharing: 'Invite volunteers to name one expectation; allow chat replies and do not call on someone without permission.',
    guestQuestions: ['What value can students gain from mentorship before their first attachment?', 'What makes an effective learning community?', 'How can students contribute even if they are quiet at first?'],
    commitment: 'Choose one topic you would like to explore during the cohort and submit it through the agreed channel.',
    nextCheckIn: 'Which expectation from our first engagement should shape the programme?',
    tip: 'Explain that this is a conversation, not a test; collect broad themes instead of pressuring individuals to speak.'
  },
  {
    id: 'preliminary-2', label: 'Preliminary engagement 2', title: 'How the Mentorship Cohort Will Work',
    goal: 'Interested students understand the proposed cohort structure, participation expectations and ways to contribute.',
    icebreaker: 'Ask for a reaction or chat reply: which learning format helps you most—discussion, examples or short activities?',
    questions: ['What would a useful one-hour virtual session look like?', 'What can members contribute even without professional experience?', 'How can we keep each other accountable without creating pressure?', 'What commitments should we make as a respectful learning community?'],
    activity: 'Co-create five short participation principles: respect, punctuality, privacy, optional sharing and practical follow-through.',
    sharing: 'Read each proposed principle and invite quick chat reactions or suggested edits.',
    guestQuestions: ['What do mentors realistically expect from student participants?', 'How should students prepare a question before meeting an HR practitioner?', 'What is one mistake new mentees can avoid?'],
    commitment: 'Decide whether you want to apply when the approved cohort registration opens, and note one question to clarify.',
    nextCheckIn: 'Which participation principle should we remember as our first cohort begins?',
    tip: 'Do not imply selection is guaranteed; distinguish programme information from formal applications.'
  },
  {
    id: 'week-1', label: 'Week 1', title: 'Self-Discovery, Personal Growth and Goal Setting',
    goal: 'Members identify personal strengths and set one achievable development goal.',
    icebreaker: 'Ask everyone to choose, without explanation, one strength from a short list: listening, organising, patience, curiosity or teamwork.',
    questions: ['What does personal growth mean to a university student?', 'Which strength has helped you navigate a class or group assignment?', 'What makes it hard to stay consistent with goals during a busy semester?', 'What small habit could help you move towards the HR professional you want to become?'],
    activity: 'Create a private three-column note: one strength, one skill to improve, and one specific action to take in the next seven days.',
    sharing: 'Invite members to share only their action, by voice or chat, or keep it private.',
    guestQuestions: ['What personal habit helped you most early in your HR career?', 'How did you identify a strength that employers value?', 'What would you tell an HR student unsure of their direction?'],
    commitment: 'Write one measurable seven-day goal and choose when you will act on it.',
    nextCheckIn: 'What progress did you make on your seven-day goal, and what got in the way?',
    tip: 'Do not turn self-discovery into public confession; private writing is a valid way to participate.'
  },
  {
    id: 'week-2', label: 'Week 2', title: 'Understanding the HR Profession and Career Pathways',
    goal: 'Members can explain two HR career pathways and identify one next step towards a preferred pathway.',
    icebreaker: 'Use a quick chat poll: recruitment, employee relations, learning and development, payroll or HR analytics—which sounds interesting?',
    questions: ['What work does an HR professional actually do?', 'Which HR specialisation appeals to you, and why?', 'What can attachments, professional bodies such as IHRM and CHRP preparation contribute to a career plan?', 'How would you explore an HR role before committing to it?'],
    activity: 'Draw a mini career map: HR specialisation → skills needed → possible Kenyan internship or attachment setting → one action to explore it; verify certification details from HRMPEB/IHRM rather than guessing.',
    sharing: 'Ask a few volunteers to share one pathway or research question.',
    guestQuestions: ['Which entry-level competencies are employers looking for in Kenya?', 'How do attachments and CHRP fit into early HR career development?', 'What misconceptions do students have about working in HR?'],
    commitment: 'Research one HR specialisation and identify one credible source or professional to learn from.',
    nextCheckIn: 'What did you learn about your chosen HR pathway?',
    tip: 'Avoid making claims about current certification requirements without checking the official bodies.'
  },
  {
    id: 'week-3', label: 'Week 3', title: 'Personal Branding, CV Writing and Employability',
    goal: 'Members can improve one part of their CV or professional profile for an attachment or internship.',
    icebreaker: 'Ask which is harder: describing your skills, choosing CV content or preparing for an interview; respond in chat.',
    questions: ['What makes a student CV credible before full-time work experience?', 'How can coursework, volunteering or HRSA participation demonstrate transferable skills?', 'What should a professional LinkedIn profile communicate?', 'How can you tailor an application to an attachment or internship opportunity?'],
    activity: 'Rewrite one CV bullet using action + contribution + result, or draft a two-sentence LinkedIn summary. Use fictional examples in group discussion.',
    sharing: 'Invite volunteers to share an anonymised before-and-after bullet.',
    guestQuestions: ['What CV mistakes commonly weaken Kenyan internship applications?', 'What do recruiters want to see when students have limited experience?', 'How should a student prepare for their first HR interview?'],
    commitment: 'Improve one CV section or LinkedIn headline and proofread it before next week.',
    nextCheckIn: 'Which CV or profile improvement did you complete?',
    tip: 'Do not ask members to paste phone numbers or full CVs into the meeting chat.'
  },
  {
    id: 'week-4', label: 'Week 4', title: 'Communication, Confidence and Public Speaking',
    goal: 'Members practise one clear professional message and gain confidence expressing an idea.',
    icebreaker: 'Offer an optional five-word introduction in chat: name not required, just five words about a hobby or skill.',
    questions: ['When do you feel comfortable speaking in a group?', 'What makes a message professional rather than merely formal?', 'How can you communicate confidently to a lecturer, attachment supervisor or recruiter?', 'How might you handle being interrupted or challenged respectfully?'],
    activity: 'Prepare a 30-second introduction for an HR networking event. Practise privately, in pairs or through a written version in chat.',
    sharing: 'Take two or three volunteer introductions; give specific, encouraging feedback.',
    guestQuestions: ['How did you develop confidence in professional conversations?', 'How should students introduce themselves when networking?', 'What communication habit has the greatest workplace impact?'],
    commitment: 'Practise and refine your 30-second professional introduction once this week.',
    nextCheckIn: 'Where did you practise your introduction, and what would you change?',
    tip: 'Never force camera-on speaking; offer chat or private rehearsal to reduce anxiety.'
  },
  {
    id: 'week-5', label: 'Week 5', title: 'Mentorship, Networking and Professional Relationships',
    goal: 'Members understand how to begin and maintain respectful professional connections.',
    icebreaker: 'Ask for a yes/no chat response: have you ever asked someone for career advice?',
    questions: ['What is the difference between a mentor and someone you only ask for a favour?', 'Where can students meet HR professionals ethically?', 'What would you say in a first LinkedIn or email outreach?', 'How can you maintain a relationship without being demanding?'],
    activity: 'Draft a short respectful networking message to a hypothetical HR professional, including context, one specific question and thanks.',
    sharing: 'Read volunteer messages with fictional names only, then suggest one improvement.',
    guestQuestions: ['What makes a student mentorship request worth responding to?', 'How should mentees follow up after advice?', 'Which professional communities can Kenyan HR students explore?'],
    commitment: 'Identify one appropriate professional contact and prepare a respectful, specific outreach question.',
    nextCheckIn: 'What did you learn while preparing or sending your outreach?',
    tip: 'Explain that networking is relationship-building, not requesting jobs or confidential referrals.'
  },
  {
    id: 'week-6', label: 'Week 6', title: 'Leadership, Professional Ethics and Workplace Readiness',
    goal: 'Members practise responding to a realistic ethical or teamwork dilemma.',
    icebreaker: 'Chat poll: what earns trust fastest—being punctual, listening, following through or admitting mistakes?',
    questions: ['What does leadership look like when you have no official title?', 'What workplace conduct builds trust with colleagues?', 'How should an HR intern handle confidential employee information?', 'What should you do when a supervisor pressures you to act against your values?'],
    activity: 'Discuss a fictional county-office attachment dilemma: a friend asks for an employee’s private file. In pairs or chat, decide what you would say and who you would consult.',
    sharing: 'Compare responses without naming actual workplaces or people.',
    guestQuestions: ['What ethical challenges may HR interns encounter?', 'How can a new employee raise a concern professionally?', 'Which behaviour signals readiness for the workplace?'],
    commitment: 'Write one workplace boundary you will uphold and one action to strengthen reliability.',
    nextCheckIn: 'How did you practise reliability or an ethical boundary this week?',
    tip: 'Keep scenarios fictional; do not solicit identifiable allegations or sensitive workplace cases.'
  },
  {
    id: 'week-7', label: 'Week 7', title: "Financial Literacy, Resilience and Managing Life's Pressures",
    goal: 'Members develop one practical money habit and identify a healthy way to manage common student pressures.',
    icebreaker: 'Offer a low-stakes choice: which is easier to plan—time, airtime/data or transport money?',
    questions: ['What everyday expenses make student budgeting difficult?', 'How can you plan for attachment costs such as transport and data?', 'What helps you recover after a difficult week without hiding from responsibilities?', 'What support or habit could help you balance finances, study and personal growth?'],
    activity: 'Using an imaginary KSh 2,000 weekly budget, allocate money to essentials, data, transport and savings. Discuss trade-offs without disclosing personal finances.',
    sharing: 'Compare fictional budget choices, not actual financial situations.',
    guestQuestions: ['What financial habit helped you most after campus?', 'How can new graduates manage uncertainty while job hunting?', 'What healthy coping practices have been useful in demanding work?'],
    commitment: 'Choose one small budgeting or wellbeing habit to practise for seven days.',
    nextCheckIn: 'Which habit did you try, and what would make it easier to keep?',
    tip: 'Avoid pressuring students to reveal debt, family issues or mental health information.'
  },
  {
    id: 'week-8', label: 'Week 8', title: 'Personal Development Review, Career Action Planning and the Future',
    goal: 'Members reflect on their progress and leave with a realistic next-month career action plan.',
    icebreaker: 'In one word, describe something useful you gained from the cohort; members can respond in chat or pass.',
    questions: ['Which session changed how you think about your future?', 'What practical habit or professional skill improved?', 'Which goal still needs more attention?', 'What three realistic actions can you take in the next 30 days?'],
    activity: 'Complete a private 30-day action card with three steps, dates, likely barriers and a check-in partner or personal reminder.',
    sharing: 'Invite optional sharing of one action and thank contributors without ranking personal progress.',
    guestQuestions: ['What should an HR student focus on during the year after this cohort?', 'How can early-career professionals keep learning beyond certificates?', 'What makes a career action plan realistic?'],
    commitment: 'Write your first dated action for the next 30 days and decide how you will review it.',
    nextCheckIn: 'At the optional one-month follow-up, what action did you complete and what support would help next?',
    tip: 'Celebrate effort and concrete learning; do not present attendance alone as proof of professional competence.'
  },
];
