import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PROGRAMME_MODULES } from '../src/lib/programme-modules.ts';

test('the programme catalogue contains eight unique session-ready module titles', () => {
  assert.equal(PROGRAMME_MODULES.length, 8);
  assert.equal(new Set(PROGRAMME_MODULES.map(module => module.id)).size, 8);
  assert.equal(new Set(PROGRAMME_MODULES.map(module => module.title)).size, 8);
  assert.ok(PROGRAMME_MODULES.every(module => module.title.length >= 4 && module.title.length <= 160));
});
