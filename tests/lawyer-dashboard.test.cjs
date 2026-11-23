// Lawyer dashboard — date-range filtering + KPI figures (src/lib/lawyer/dashboardSchedule.ts)
// and the read endpoint (src/app/api/live/lawyer-dashboard/route.ts).
// Run: node --test tests/lawyer-dashboard.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const transpile = (file) =>
  ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

function loadLib() {
  const exports = {};
  vm.runInNewContext(transpile('src/lib/lawyer/dashboardSchedule.ts'), { exports, Date, Number, Math, Set, Object, String });
  return exports;
}
const lib = loadLib();
const plain = (v) => JSON.parse(JSON.stringify(v));

// 2026-11-23 10:00 Manila = 02:00 UTC
const NOW = Date.UTC(2026, 10, 23, 2, 0);

function consultation(id, status, iso, time, extra = {}) {
  const [y, m, d] = iso.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return {
    id,
    status,
    year: y,
    month: m - 1,
    day: d,
    // Manila wall time → UTC
    scheduledStart: new Date(Date.UTC(y, m - 1, d, h - 8, min)).toISOString(),
    timeRange: '',
    timeTag: '',
    clientId: `client-${id}`,
    ...extra,
  };
}

test('dates: Manila today, validation, month ranges', () => {
  assert.equal(lib.todayInManila(NOW), '2026-11-23');
  assert.equal(lib.todayInManila(Date.UTC(2026, 10, 23, 16, 30)), '2026-11-24', '00:30 Manila is already the next day');
  assert.equal(lib.parseIsoDate('2026-02-30'), null);
  assert.equal(lib.parseIsoDate('2026-13-01'), null);
  assert.equal(lib.parseIsoDate('26-11-01'), null);
  assert.equal(lib.parseIsoDate(null), null);
  assert.deepEqual(plain(lib.parseIsoDate('2028-02-29')), { year: 2028, month: 1, day: 29 });
  assert.deepEqual(plain(lib.monthRange(2026, 1)), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(plain(lib.monthRange(2026, 11)), { from: '2026-12-01', to: '2026-12-31' });
  assert.equal(lib.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(lib.addDays('2026-03-01', -1), '2026-02-28');
});

test('parseDateRange rejects bad input and over-long ranges', () => {
  assert.deepEqual(plain(lib.parseDateRange('2026-11-01', '2026-11-30')), { from: '2026-11-01', to: '2026-11-30' });
  assert.deepEqual(plain(lib.parseDateRange('2026-11-23', '2026-11-23')), { from: '2026-11-23', to: '2026-11-23' });
  assert.equal(lib.parseDateRange('2026-11-30', '2026-11-01'), null, 'from after to');
  assert.equal(lib.parseDateRange('2026-11-01', null), null);
  assert.equal(lib.parseDateRange('2026-11-01', 'x'), null);
  assert.equal(lib.parseDateRange("2026-11-01' or 1=1", '2026-11-02'), null);
  assert.ok(lib.parseDateRange('2026-01-01', '2026-04-02'), '92 days is allowed');
  assert.equal(lib.parseDateRange('2026-01-01', '2026-04-03'), null, '93 days is not');
});

test('startMinutes / startMsOf read the slot label when there is no timestamp', () => {
  assert.equal(lib.startMinutes('3:00 PM - 4:00 PM • PST, GMT+8'), 15 * 60);
  assert.equal(lib.startMinutes('12:30 AM'), 30);
  assert.equal(lib.startMinutes('12:15 PM'), 12 * 60 + 15);
  assert.equal(lib.startMinutes('Scheduled Session'), null);
  const legacy = { status: 'confirmed', year: 2026, month: 10, day: 23, scheduledStart: null, timeRange: '9:00 AM - 10:00 AM', timeTag: '' };
  assert.equal(lib.startMsOf(legacy), Date.UTC(2026, 10, 23, 1, 0), '9:00 Manila = 01:00 UTC');
});

test('scheduleInRange keeps scheduled statuses inside the range, earliest first', () => {
  const items = [
    consultation('late', 'confirmed', '2026-11-23', '15:00'),
    consultation('early', 'payment_review', '2026-11-23', '09:00'),
    consultation('request', 'pending', '2026-11-23', '11:00'),
    consultation('declined', 'declined', '2026-11-23', '12:00'),
    consultation('cancelled', 'cancelled', '2026-11-23', '13:00'),
    consultation('done', 'completed', '2026-11-02', '10:00'),
    consultation('unpaid', 'pending_payment', '2026-11-30', '10:00'),
    consultation('december', 'confirmed', '2026-12-01', '08:00'),
  ];
  const ids = (list) => list.map((c) => c.id);
  assert.deepEqual(ids(lib.scheduleInRange(items, lib.dayRange('2026-11-23'))), ['early', 'late']);
  assert.deepEqual(ids(lib.scheduleInRange(items, lib.monthRange(2026, 10))), ['done', 'early', 'late', 'unpaid']);
  assert.deepEqual(ids(lib.scheduleInRange(items, lib.dayRange('2026-11-24'))), []);
  assert.deepEqual(plain(lib.countByDate(items)), { '2026-11-23': 2, '2026-11-02': 1, '2026-11-30': 1, '2026-12-01': 1 });

  const schedule = lib.buildSchedule(items, lib.dayRange('2026-11-23'), NOW);
  assert.equal(schedule.today, '2026-11-23');
  assert.deepEqual(ids(schedule.consultations), ['early', 'late']);
});

test('buildDashboardStats: today, pending, earnings vs last month, rating', () => {
  const items = [
    consultation('past', 'completed', '2026-11-23', '08:00'),
    consultation('soon', 'confirmed', '2026-11-23', '15:00'),
    consultation('r1', 'pending', '2026-11-25', '10:00', { clientId: 'same' }),
    consultation('r2', 'pending', '2026-11-26', '10:00', { clientId: 'same' }),
    consultation('r3', 'pending', '2026-11-27', '10:00'),
  ];
  const monthly = Array(12).fill(0);
  monthly[9] = 50000;
  monthly[10] = 59000;
  const earnings = { year: 2026, monthlyEarnings: monthly, previousDecemberEarnings: 0, reviewCount: 3, responseRate: 80 };
  const stats = plain(lib.buildDashboardStats({ consultations: items, earnings, rating: { avg: 4.8, count: 3 }, now: NOW }));
  assert.equal(stats.todayScheduled, 2);
  assert.equal(stats.todayUpcoming, 1);
  assert.equal(stats.pendingRequests, 3);
  assert.equal(stats.pendingClients, 2);
  assert.equal(stats.month, 10);
  assert.equal(stats.monthEarnings, 59000);
  assert.equal(stats.previousMonthEarnings, 50000);
  assert.equal(stats.ratingAvg, 4.8);
  assert.equal(stats.responseRate, 80);

  const january = plain(lib.buildDashboardStats({
    consultations: [],
    earnings: { ...earnings, year: 2027, monthlyEarnings: [100, ...Array(11).fill(0)], previousDecemberEarnings: 400 },
    rating: { avg: 0, count: 0 },
    now: Date.UTC(2027, 0, 10, 2, 0),
  }));
  assert.equal(january.previousMonthEarnings, 400, 'January compares with last December');
  assert.equal(january.ratingAvg, null, 'no ratings → null, not 0');

  const noEarnings = plain(lib.buildDashboardStats({ consultations: [], earnings: null, rating: null, now: NOW }));
  assert.equal(noEarnings.monthEarnings, null);
  assert.equal(noEarnings.ratingCount, 0);
});

// ─── Route ───────────────────────────────────────────────────────────────────

function loadRoute({ user = { id: 'lawyer-1' }, profile = { rating_avg: '4.50', rating_count: 2 }, actions: overrides = {} } = {}) {
  const calls = [];
  const actions = {
    getLawyerConsultationsAction: async () => {
      calls.push('consultations');
      return [consultation('a', 'confirmed', lib.todayInManila(), '23:59'), consultation('b', 'pending', '2026-11-25', '10:00')];
    },
    getLawyerEarningsAction: async () => {
      calls.push('earnings');
      return { success: true, data: { year: Number(lib.todayInManila().slice(0, 4)), monthlyEarnings: Array(12).fill(1000), previousDecemberEarnings: 0, reviewCount: 2, responseRate: 50 } };
    },
    ...overrides,
  };
  const supabase = {
    auth: { getUser: async () => ({ data: { user } }) },
    from: (table) => {
      assert.equal(table, 'lawyer_profiles');
      const q = { select: () => q, eq: (col, val) => { assert.equal(col, 'user_id'); assert.equal(val, user.id); return q; }, maybeSingle: async () => ({ data: profile }) };
      return q;
    },
  };
  const exports = {};
  vm.runInNewContext(transpile('src/app/api/live/lawyer-dashboard/route.ts'), {
    exports,
    console: { error() {} },
    require: (name) => {
      if (name === '@/app/actions/consultationActions') return actions;
      if (name === '@/lib/supabase/server') return { createClient: async () => supabase };
      if (name === '@/lib/lawyer/dashboardSchedule') return lib;
      if (name === 'next/server') {
        return { NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200, headers: init.headers ?? {} }) } };
      }
      throw new Error(name);
    },
  });
  const get = (query) => exports.GET({ nextUrl: { searchParams: new URLSearchParams(query) } });
  return { route: exports, get, calls };
}

test('route: schedule view filters by the requested range and never caches', async () => {
  const { get, route, calls } = loadRoute();
  assert.equal(route.dynamic, 'force-dynamic');
  const today = lib.todayInManila();
  const res = await get(`view=schedule&from=${today}&to=${today}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  const data = plain(res.body.data);
  assert.deepEqual(data.range, { from: today, to: today });
  assert.deepEqual(data.consultations.map((c) => c.id), ['a'], 'pending request is not on the schedule');
  assert.deepEqual(data.activeDates, { [today]: 1 });
  assert.deepEqual(calls, ['consultations']);
});

test('route: stats view combines consultations, earnings and rating', async () => {
  const { get, calls } = loadRoute();
  const res = await get('view=stats');
  assert.equal(res.status, 200);
  const data = plain(res.body.data);
  assert.equal(data.todayScheduled, 1);
  assert.equal(data.pendingRequests, 1);
  assert.equal(data.monthEarnings, 1000);
  assert.equal(data.ratingAvg, 4.5);
  assert.equal(data.ratingCount, 2);
  assert.deepEqual(calls.sort(), ['consultations', 'earnings']);
});

test('route: earnings failure still returns the other figures', async () => {
  const { get } = loadRoute({ actions: { getLawyerEarningsAction: async () => ({ error: 'nope' }) } });
  const data = plain((await get('view=stats')).body.data);
  assert.equal(data.monthEarnings, null);
  assert.equal(data.pendingRequests, 1);
});

test('route: rejects signed-out, non-lawyer, bad ranges and unknown views without loading data', async () => {
  let r = loadRoute({ user: null });
  assert.equal((await r.get('view=stats')).status, 401);
  assert.deepEqual(r.calls, []);

  r = loadRoute({ profile: null });
  assert.equal((await r.get('view=schedule&from=2026-11-01&to=2026-11-30')).status, 403);
  assert.deepEqual(r.calls, []);

  r = loadRoute();
  for (const q of ['view=schedule', 'view=schedule&from=2026-11-30&to=2026-11-01', 'view=schedule&from=2026-01-01&to=2026-12-31', 'view=schedule&from=bad&to=2026-11-01', 'view=__proto__', '']) {
    assert.equal((await r.get(q)).status, 400, q);
  }
  assert.deepEqual(r.calls, []);
});

test('route: errors are logged, not leaked', async () => {
  const { get } = loadRoute({ actions: { getLawyerConsultationsAction: async () => { throw new Error('db password=secret'); } } });
  const res = await get('view=schedule&from=2026-11-01&to=2026-11-30');
  assert.equal(res.status, 500);
  assert.deepEqual(plain(res.body), { error: 'Could not load the dashboard.' });
});
