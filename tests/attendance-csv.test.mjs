import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeEmail, normalizeName, parseCsv, parseDuration, previewAttendanceRows, previewRosterRows,
} from '../netlify/lib/attendance-csv.ts';

test('CSV parser handles quoted delimiters, escaped quotes, embedded newlines, and CRLF', () => {
  assert.deepEqual(parseCsv('Name,Note\r\n"Doe, Jane","said ""hello""\r\nagain"\r\nAlex,ok\r\n'), [
    ['Name', 'Note'], ['Doe, Jane', 'said "hello"\r\nagain'], ['Alex', 'ok'],
  ]);
});

test('CSV parser rejects NUL, malformed quotes, and exceeded limits', () => {
  for (const value of ['a\0b', 'a"b', '"unfinished', '"quoted"x']) assert.throws(() => parseCsv(value));
  assert.throws(() => parseCsv('a,b\n1,2', { maxBytes: 4 }), RangeError);
  assert.throws(() => parseCsv('a\n1\n2', { maxRows: 1 }), RangeError);
});

test('normalizers apply compatibility normalization, whitespace collapse, and safe email validation', () => {
  assert.equal(normalizeName('  Ｊane   DOE '), 'jane doe');
  assert.equal(normalizeEmail('  USER+tag@Example.COM '), 'user+tag@example.com');
  assert.equal(normalizeEmail('bad address'), '');
});

test('duration parsing accepts clock and ordered unit forms, rejecting ambiguous and invalid values', () => {
  assert.equal(parseDuration('01:02:03'), 3723);
  assert.equal(parseDuration('62:03'), 3723);
  assert.equal(parseDuration('1h 2m 3s'), 3723);
  for (const value of ['123', '-1m', '1m 1h', '25:00:00', '1:60', '']) assert.equal(parseDuration(value), null, value);
});

test('roster preview preserves distinct same-name rows and flags invalid emails', () => {
  const result = previewRosterRows(['Full name', 'Email'], [
    ['A. Person', 'A@example.test'], ['a. PERSON', 'other@example.test'], ['No email', 'bad'],
  ], 'Full name', 'Email');
  assert.deepEqual(result.map(row => row.status), ['new', 'new', 'invalid']);
  assert.equal(result[1].name, 'a. PERSON');
  assert.equal(result[2].name, 'No email');
});

test('roster email and attendance joined-at are optional', () => {
  const roster = previewRosterRows(['Name'], [['Same Name'], ['Same Name']], 'Name', '');
  assert.deepEqual(roster.map(row => row.status), ['new', 'new']);
  const report = previewAttendanceRows(['Name','Duration'], [['Same Name','1m']], 'Name','Duration','', [{id:'1',name:'Same Name'}]);
  assert.equal(report[0].status, 'suggested');
  assert.equal(report[0].joinedAt, '');
});

test('attendance preview suggests only a unique normalized-name match and flags ambiguity, duplicates, and no match', () => {
  const candidates = [{ id: '1', name: 'Jane Doe' }, { id: '2', name: 'Other Person' }, { id: '3', name: 'Jane Doe' }];
  const result = previewAttendanceRows(['Name', 'Duration', 'Joined'], [
    ['Other Person', '1m', '10:00'], ['Jane Doe', '2m', '10:02'], ['Jane Doe', '2m', '10:03'], ['Missing', '3m', '10:04'],
  ], 'Name', 'Duration', 'Joined', candidates);
  assert.deepEqual(result.map(row => row.status), ['suggested', 'ambiguous', 'ambiguous', 'unmatched']);
  assert.equal(result[0].suggestedMatch.id, '2');
  assert.equal(result[1].suggestedMatch, null);
  assert.equal(result[1].duplicateSourceName, true);
  assert.equal(result[3].candidateCount, 0);
});
