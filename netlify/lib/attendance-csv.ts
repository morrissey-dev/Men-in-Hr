export const DEFAULT_MAX_CSV_BYTES = 500 * 1024;
export const DEFAULT_MAX_DATA_ROWS = 1_000;

export type CsvLimits = { maxBytes?: number; maxRows?: number };
export type RosterStatus = 'new' | 'duplicate' | 'invalid';
export type RosterPreviewRow = {
  rowNumber: number;
  source: string[];
  name: string;
  normalizedName: string;
  email: string;
  normalizedEmail: string;
  status: RosterStatus;
  issues: string[];
};
export type RosterCandidate = { name: string; email?: string; id?: string };
export type AttendanceStatus = 'suggested' | 'ambiguous' | 'unmatched' | 'invalid';
export type AttendancePreviewRow = {
  rowNumber: number;
  source: string[];
  name: string;
  normalizedName: string;
  duration: number | null;
  joinedAt: string;
  status: AttendanceStatus;
  suggestedMatch: RosterCandidate | null;
  candidateCount: number;
  duplicateSourceName: boolean;
  issues: string[];
};

function checkedLimit(value: number | undefined, fallback: number, label: string): number {
  const limit = value ?? fallback;
  if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError(`${label} must be a non-negative safe integer.`);
  return limit;
}

/** Parse RFC4180-style CSV into rows, enforcing byte and data-row bounds. */
export function parseCsv(input: string, limits: CsvLimits = {}): string[][] {
  if (typeof input !== 'string') throw new TypeError('CSV input must be a string.');
  if (input.includes('\0')) throw new SyntaxError('CSV contains a NUL character.');
  const maxBytes = checkedLimit(limits.maxBytes, DEFAULT_MAX_CSV_BYTES, 'maxBytes');
  const maxRows = checkedLimit(limits.maxRows, DEFAULT_MAX_DATA_ROWS, 'maxRows');
  if (new TextEncoder().encode(input).byteLength > maxBytes) throw new RangeError('CSV exceeds the byte limit.');
  if (input.length === 0) return [];

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let state: 'field-start' | 'unquoted' | 'quoted' | 'after-quote' = 'field-start';
  let endedRecord = false;
  const finishField = () => { row.push(field); field = ''; state = 'field-start'; };
  const finishRow = () => {
    finishField();
    rows.push(row);
    row = [];
    endedRecord = true;
    if (rows.length > maxRows + 1) throw new RangeError('CSV exceeds the data-row limit.');
  };

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    if (state === 'quoted') {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i += 1; }
        else state = 'after-quote';
      } else field += ch;
      endedRecord = false;
      continue;
    }
    if (state === 'after-quote') {
      if (ch === ',') { finishField(); endedRecord = false; }
      else if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && input[i + 1] === '\n') i += 1;
        finishRow();
      } else throw new SyntaxError('Unexpected character after a quoted CSV field.');
      continue;
    }
    if (state === 'field-start') {
      if (ch === '"') { state = 'quoted'; endedRecord = false; }
      else if (ch === ',') { finishField(); endedRecord = false; }
      else if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && input[i + 1] === '\n') i += 1;
        finishRow();
      } else { field = ch; state = 'unquoted'; endedRecord = false; }
      continue;
    }
    if (ch === ',') { finishField(); endedRecord = false; }
    else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && input[i + 1] === '\n') i += 1;
      finishRow();
    } else if (ch === '"') throw new SyntaxError('Quote inside an unquoted CSV field.');
    else { field += ch; endedRecord = false; }
  }
  if (state === 'quoted') throw new SyntaxError('Unclosed quoted CSV field.');
  if (!endedRecord) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length > 0 && rows.length - 1 > maxRows) throw new RangeError('CSV exceeds the data-row limit.');
  return rows;
}

export function normalizeName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
}

export function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@<>(),;:\\"]+@[^\s@<>(),;:\\"]+\.[^\s@<>(),;:\\"]+$/.test(email)) return '';
  return email;
}

/** Parse elapsed duration into seconds; unsupported or ambiguous forms return null. */
export function parseDuration(value: string): number | null {
  const input = value.trim();
  if (!input || input.startsWith('-')) return null;
  let seconds: number;
  let match = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(input);
  if (match) {
    const hours = Number(match[1]); const minutes = Number(match[2]); const secs = Number(match[3]);
    if (minutes > 59 || secs > 59) return null;
    seconds = hours * 3600 + minutes * 60 + secs;
  } else {
    match = /^(\d{1,3}):(\d{2})$/.exec(input);
    if (match) {
      const minutes = Number(match[1]); const secs = Number(match[2]);
      if (secs > 59) return null;
      seconds = minutes * 60 + secs;
    } else {
      const unitPattern = /\s*(\d+)\s*([hms])\s*/gy;
      let cursor = 0; let total = 0; let previous = 4; let count = 0;
      while (cursor < input.length) {
        unitPattern.lastIndex = cursor;
        const unit = unitPattern.exec(input);
        if (!unit || unit.index !== cursor) return null;
        const rank = unit[2] === 'h' ? 3 : unit[2] === 'm' ? 2 : 1;
        if (rank >= previous) return null;
        previous = rank;
        total += Number(unit[1]) * (rank === 3 ? 3600 : rank === 2 ? 60 : 1);
        cursor = unitPattern.lastIndex;
        count += 1;
      }
      if (!count) return null;
      seconds = total;
    }
  }
  return Number.isSafeInteger(seconds) && seconds <= 24 * 3600 ? seconds : null;
}

function headerIndex(headers: string[], chosen: string): number {
  return headers.findIndex(header => header === chosen);
}

export function previewRosterRows(
  headers: string[], rows: string[][], nameHeader: string, emailHeader: string,
): RosterPreviewRow[] {
  const nameIndex = headerIndex(headers, nameHeader);
  const emailIndex = headerIndex(headers, emailHeader);
  const seenEmails = new Set<string>();
  return rows.map((source, index) => {
    const name = source[nameIndex] ?? '';
    const email = source[emailIndex] ?? '';
    const normalizedName = normalizeName(name);
    const normalizedEmail = normalizeEmail(email);
    const issues: string[] = [];
    if (nameIndex < 0) issues.push('Selected name header was not found.');
    if (emailHeader && emailIndex < 0) issues.push('Selected email header was not found.');
    if (!normalizedName) issues.push('Name is required.');
    if (email.trim() && !normalizedEmail) issues.push('Email is invalid.');
    const duplicate = Boolean(normalizedEmail && seenEmails.has(normalizedEmail));
    if (duplicate) issues.push('Duplicate roster email.');
    if (normalizedEmail) seenEmails.add(normalizedEmail);
    return {
      rowNumber: index + 2, source: [...source], name, normalizedName, email, normalizedEmail,
      status: issues.some(issue => issue.includes('required') || issue.includes('invalid') || issue.includes('not found')) ? 'invalid' : duplicate ? 'duplicate' : 'new',
      issues,
    };
  });
}

export function previewAttendanceRows(
  headers: string[], rows: string[][], nameHeader: string, durationHeader: string, joinedAtHeader: string,
  rosterCandidates: RosterCandidate[],
): AttendancePreviewRow[] {
  const nameIndex = headerIndex(headers, nameHeader);
  const durationIndex = headerIndex(headers, durationHeader);
  const joinedAtIndex = headerIndex(headers, joinedAtHeader);
  const normalizedCandidates = rosterCandidates.map(candidate => ({ candidate, name: normalizeName(candidate.name) }));
  const sourceNameCounts = new Map<string, number>();
  for (const source of rows) {
    const name = normalizeName(source[nameIndex] ?? '');
    if (name) sourceNameCounts.set(name, (sourceNameCounts.get(name) ?? 0) + 1);
  }
  return rows.map((source, index) => {
    const name = source[nameIndex] ?? '';
    const normalizedName = normalizeName(name);
    const duration = parseDuration(source[durationIndex] ?? '');
    const joinedAt = source[joinedAtIndex] ?? '';
    const issues: string[] = [];
    if (nameIndex < 0) issues.push('Selected name header was not found.');
    if (durationIndex < 0) issues.push('Selected duration header was not found.');
    if (joinedAtHeader && joinedAtIndex < 0) issues.push('Selected joined-at header was not found.');
    if (!normalizedName) issues.push('Name is required.');
    if (duration === null) issues.push('Duration is invalid.');
    const matching = normalizedName ? normalizedCandidates.filter(item => item.name === normalizedName) : [];
    const duplicateSourceName = Boolean(normalizedName && (sourceNameCounts.get(normalizedName) ?? 0) > 1);
    if (duplicateSourceName) issues.push('Duplicate source name.');
    if (matching.length > 1) issues.push('Multiple roster candidates are ambiguous.');
    else if (matching.length === 0) issues.push('No roster candidate matched.');
    const invalid = issues.some(issue => issue.includes('not found') || issue === 'Name is required.' || issue === 'Duration is invalid.');
    return {
      rowNumber: index + 2, source: [...source], name, normalizedName, duration, joinedAt,
      status: invalid ? 'invalid' : matching.length > 1 ? 'ambiguous' : matching.length === 0 ? 'unmatched' : 'suggested',
      suggestedMatch: matching.length === 1 ? matching[0]!.candidate : null,
      candidateCount: matching.length, duplicateSourceName, issues,
    };
  });
}
