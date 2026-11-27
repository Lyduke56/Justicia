/**
 * Regular consultation hours (src/lib/lawyer/consultationHours.ts): slot generation around
 * breaks, validation of what the lawyer saves, and the defaults (the old fixed slots).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadReal } = require('./support/extraModules.cjs');

const hours = loadReal('src/lib/lawyer/consultationHours.ts');
const h = (n) => n * 60;
const day = (open, start, end, breaks = []) => ({ open, start: h(start), end: h(end), breaks: breaks.map(([a, b]) => ({ start: h(a), end: h(b) })) });
const week = (overrides = {}) => ({
  days: Object.fromEntries([1, 2, 3, 4, 5, 6].map((d) => [d, overrides[d] ?? day(true, 9, 17, [[11, 13]])])),
});

test('defaults match the old fixed slots, Monday to Saturday; Sunday is never open', () => {
  const starts = [...hours.slotStartsFor(hours.DEFAULT_CONSULTATION_HOURS, 3)].map((m) => m / 60);
  assert.deepEqual(starts, [9, 10, 13, 14, 15, 16]);
  assert.deepEqual([...hours.slotStartsFor(hours.DEFAULT_CONSULTATION_HOURS, 0)], []);
  assert.equal(hours.slotLabel(h(14)), '2:00 PM - 3:00 PM • PST, GMT+8');
});

test('slots skip breaks and stop at closing time', () => {
  const evening = week({ 1: day(true, 18, 23, [[21, 21.5]]), 3: day(false, 9, 17) });
  assert.deepEqual([...hours.slotStartsFor(evening, 1)].map((m) => m / 60), [18, 19, 20, 21.5]);
  assert.deepEqual([...hours.slotStartsFor(evening, 3)], [], 'closed day');
  assert.equal(hours.isRegularSlot(evening, 1, h(21.5)), true);
  assert.equal(hours.isRegularSlot(evening, 1, h(21)), false);
  assert.equal(hours.fitsHours(evening, 1, h(19), h(20)), true);
  assert.equal(hours.fitsHours(evening, 1, h(20.5), h(21.5)), false, 'overlaps the break');
  assert.equal(hours.describeDay(evening.days[1]), '6:00 PM – 11:00 PM · break 9:00 PM – 9:30 PM');
});

test('validation: hours, breaks and leftovers are checked; closed days are kept', () => {
  assert.ok('hours' in hours.normalizeHours(week({ 2: day(false, 0, 0) })));
  assert.match(hours.normalizeHours(week({ 1: day(true, 9, 9.5) })).error, /Monday: the hours must be at least 1 hour/);
  assert.match(hours.normalizeHours(week({ 2: day(true, 9, 17, [[8, 10]]) })).error, /Tuesday: breaks must fall inside/);
  assert.match(hours.normalizeHours(week({ 3: day(true, 9, 17, [[10, 12], [11, 13]]) })).error, /Wednesday: breaks can't overlap/);
  assert.match(hours.normalizeHours(week({ 4: day(true, 9, 11, [[9.5, 10.5]]) })).error, /no full 1-hour slot/);
  assert.match(hours.normalizeHours(week({ 5: day(true, 2, 6) })).error, /choose times between/);
  assert.match(hours.normalizeHours(week({ 6: { open: true, start: 545, end: 900, breaks: [] } })).error, /choose times/, '30-minute steps');
  assert.match(hours.normalizeHours(null).error, /could not be read/);
  // Bad stored data falls back to the defaults.
  assert.deepEqual(hours.hoursOrDefault({ days: 'nope' }), hours.DEFAULT_CONSULTATION_HOURS);
});
