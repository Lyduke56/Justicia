// Lawyer Consultations tab — status tabs, client search and sort (src/components/lawyer/consultations/model.ts).
// Run: node --test tests/lawyer-consultations.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const transpile = (file) =>
  ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

const lib = {};
vm.runInNewContext(transpile('src/lib/lawyer/dashboardSchedule.ts'), { exports: lib, Date, Number, Math, Set, Object, String });
const model = {};
vm.runInNewContext(transpile('src/components/lawyer/consultations/model.ts'), {
  exports: model,
  require: (name) => {
    if (name === '@/lib/lawyer/dashboardSchedule') return lib;
    throw new Error(name);
  },
});

const TODAY = '2026-11-23';
function c(id, status, iso, time, name = id) {
  const [y, m, d] = iso.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return {
    id,
    status,
    year: y,
    month: m - 1,
    day: d,
    scheduledStart: new Date(Date.UTC(y, m - 1, d, h - 8, min)).toISOString(),
    timeRange: '',
    timeTag: '',
    client: { name },
  };
}

const ALL = [
  c('done-old', 'completed', '2026-11-02', '10:00', 'Clyde Rosal'),
  c('done-new', 'completed', '2026-11-20', '10:00', 'Ana Gomez'),
  c('confirmed-later', 'confirmed', '2026-11-30', '09:00', 'Elena Mendoza'),
  c('confirmed-soon', 'confirmed', '2026-11-24', '09:00', 'Maria Reyes'),
  c('confirmed-past', 'confirmed', '2026-11-10', '09:00', 'Benideck Longakit'),
  c('unpaid', 'pending_payment', '2026-11-26', '13:00', 'Axziel Bartolabac'),
  c('review', 'payment_review', '2026-11-25', '17:00', 'Rafael Cruz'),
  c('request-late', 'pending', '2026-11-28', '15:00', 'Marco Villanueva'),
  c('request-soon', 'pending', '2026-11-25', '10:00', 'Sofia Lim'),
  c('declined', 'declined', '2026-11-21', '11:00', 'Jose Santos'),
  c('cancelled', 'cancelled', '2026-11-27', '16:00', 'Ana Patricia'),
];
const ids = (list) => list.map((x) => x.id);

test('tabs pick the right statuses', () => {
  const tab = (t) => ids(model.visibleConsultations(ALL, t, '', 'soonest', TODAY)).sort();
  assert.equal(model.visibleConsultations(ALL, 'all', '', 'action', TODAY).length, ALL.length);
  assert.deepEqual(tab('pending'), ['request-late', 'request-soon']);
  assert.deepEqual(tab('upcoming'), ['confirmed-later', 'confirmed-past', 'confirmed-soon', 'review', 'unpaid']);
  assert.deepEqual(tab('completed'), ['done-new', 'done-old']);
  assert.deepEqual(tab('cancelled'), ['cancelled', 'declined']);
  assert.deepEqual(JSON.parse(JSON.stringify(model.TABS.map((t) => t.key))), ['all', 'pending', 'upcoming', 'completed', 'cancelled']);
});

test('"needs action first": requests and payments to review, then upcoming, then the rest (latest first)', () => {
  assert.deepEqual(ids(model.visibleConsultations(ALL, 'all', '', 'action', TODAY)), [
    'request-soon',
    'review',
    'request-late',
    'confirmed-soon',
    'unpaid',
    'confirmed-later',
    'cancelled',
    'declined',
    'done-new',
    'confirmed-past',
    'done-old',
  ]);
});

test('date and name sorts', () => {
  const upcoming = (sort) => ids(model.visibleConsultations(ALL, 'upcoming', '', sort, TODAY));
  assert.deepEqual(upcoming('soonest'), ['confirmed-past', 'confirmed-soon', 'review', 'unpaid', 'confirmed-later']);
  assert.deepEqual(upcoming('latest'), ['confirmed-later', 'unpaid', 'review', 'confirmed-soon', 'confirmed-past']);
  assert.deepEqual(upcoming('client'), ['unpaid', 'confirmed-past', 'confirmed-later', 'confirmed-soon', 'review']);
});

test('search matches part of the client name, ignoring case and spaces', () => {
  assert.deepEqual(ids(model.visibleConsultations(ALL, 'all', '  ANA ', 'client', TODAY)), ['done-new', 'cancelled']);
  assert.deepEqual(ids(model.visibleConsultations(ALL, 'pending', 'sofia', 'action', TODAY)), ['request-soon']);
  assert.deepEqual(ids(model.visibleConsultations(ALL, 'completed', 'zzz', 'action', TODAY)), []);
});
