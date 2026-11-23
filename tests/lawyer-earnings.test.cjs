// Lawyer Earnings & Payouts tab — chart scale, month comparison, inquiry filters and exports
// (src/components/lawyer/earnings/model.ts, report.ts).
// Run: node --test tests/lawyer-earnings.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const transpile = (file) =>
  ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

const model = {};
vm.runInNewContext(transpile('src/components/lawyer/earnings/model.ts'), { exports: model, Math, Number, String, Map, Object });
const report = {};
vm.runInNewContext(transpile('src/components/lawyer/earnings/report.ts'), {
  exports: report,
  require: (name) => {
    if (name === './model') return model;
    throw new Error(name);
  },
});
const plain = (v) => JSON.parse(JSON.stringify(v));

function data(overrides = {}) {
  return {
    year: 2026,
    currentMonth: 10,
    monthlyEarnings: [100, 0, 300, 0, 0, 0, 0, 0, 0, 71950, 84900, 0],
    previousDecemberEarnings: 0,
    monthlyConsultations: [1, 0, 3, 0, 0, 0, 0, 0, 0, 50, 58, 0],
    todayScheduled: 0,
    pendingRequests: 0,
    pendingClients: 0,
    completedSessions: 0,
    reviewCount: 0,
    responseRate: null,
    transactions: [],
    inquiries: [],
    ...overrides,
  };
}

test('chart scale: round steps whose top line covers the highest month', () => {
  assert.deepEqual(plain(model.chartScale([84900, 71950], 'earnings').ticks), [0, 25000, 50000, 75000, 100000]);
  assert.equal(model.chartScale([0, 0], 'earnings').max, 400);
  assert.equal(model.chartScale([58, 50], 'sessions').max, 60);
  assert.equal(model.chartScale([0], 'sessions').step, 1);
  assert.equal(model.compactNumber(84900), '84.9k');
  assert.equal(model.compactNumber(999.99), '1k');
  assert.equal(model.compactNumber(1250000), '1.3M');
});

test('month comparison: change from the month before, nothing to compare when it was zero', () => {
  const d = data();
  assert.equal(model.monthChange(d, 10).pct, 18);
  assert.equal(model.earningsNote(d, 10), 'Up 18% from October.');
  assert.equal(model.monthChange(d, 2).pct, null);
  assert.equal(model.monthChange(d, 3).pct, -100);
  assert.equal(model.earningsNote(d, 4), 'No paid sessions this month yet.');
  assert.equal(model.earningsNote(d, 1), 'Down 100% from January.');
  assert.equal(model.earningsNote(d, 2), 'Nothing earned in February to compare.');
  assert.equal(model.earningsNote(d, 11), "December hasn't started yet.");
  // January compares with last December
  assert.equal(model.monthChange(data({ previousDecemberEarnings: 200 }), 0).pct, -50);
  assert.equal(model.metricChange(d, 'sessions', 10), 16);
  assert.equal(model.metricChange(d, 'sessions', 0), null);
});

test('smooth path: one curve per month gap, starts and ends on the points, flat stays flat', () => {
  const pts = [{ x: 0, y: 10 }, { x: 10, y: 10 }, { x: 20, y: 0 }, { x: 30, y: 5 }];
  const d = model.smoothPath(pts);
  assert.equal((d.match(/C/g) || []).length, 3);
  assert.ok(d.startsWith('M0,10'));
  assert.ok(d.endsWith('30,5'));
  assert.ok(model.smoothPath([{ x: 0, y: 4 }, { x: 10, y: 4 }]).includes('C3.33,4 6.67,4 10,4'));
  assert.equal(model.smoothPath([]), '');
});

test('inquiries: tabs, practice area and name search combine; counts per status', () => {
  const inq = (id, status, area, name) => ({ id, status, area, name, date: '11/23/2026', startMs: 0 });
  const all = [
    inq('a', 'pendingApproval', 'Civil Law', 'Ana Gomez'),
    inq('b', 'upcoming', 'Civil Law', 'Marco Reyes'),
    inq('c', 'upcoming', 'Labor & Employment', 'Anabel Cruz'),
    inq('d', 'cancelled', 'Civil Law', 'Jose Santos'),
  ];
  const ids = (list) => list.map((i) => i.id);
  assert.deepEqual(ids(model.visibleInquiries(all, 'all', '', 'all')), ['a', 'b', 'c', 'd']);
  assert.deepEqual(ids(model.visibleInquiries(all, 'upcoming', '', 'all')), ['b', 'c']);
  assert.deepEqual(ids(model.visibleInquiries(all, 'all', '  ANA ', 'all')), ['a', 'c']);
  assert.deepEqual(ids(model.visibleInquiries(all, 'all', 'ana', 'Civil Law')), ['a']);
  assert.deepEqual(plain(model.inquiryCounts(all)), { all: 4, pendingApproval: 1, pendingPayment: 0, upcoming: 2, completed: 0, cancelled: 1 });
  assert.deepEqual(plain(model.areasOf(all)), ['Civil Law', 'Labor & Employment']);
});

test('CSV export: monthly totals and payments, cells with commas or quotes are escaped', () => {
  const csv = report.buildEarningsCsv(
    data({
      transactions: [
        { id: 't', consultationId: 'c', clientName: 'Reyes, "Maria"', area: 'Civil Law', sessionDate: '11/20/2026', paidDate: '11/19/2026', paidMonth: 10, paidMs: 0, gross: 1500, platformFee: 50, net: 1450, payoutStatus: 'pending' },
      ],
    })
  );
  const lines = csv.replace(/^﻿/, '').split('\r\n');
  assert.equal(lines[0], 'Justicia Earnings Report,2026');
  assert.ok(lines.includes('November,58,84900.00'));
  assert.ok(lines.includes('Total,112,157250.00'));
  assert.ok(lines.includes('11/19/2026,"Reyes, ""Maria""",11/20/2026,Civil Law,1500.00,50.00,1450.00,Pending payout'));
  assert.ok(report.buildEarningsReportHtml(data(), 'now').includes('No confirmed payments yet this year.'));
  assert.equal(report.escapeHtml('<b>"&\''), '&lt;b&gt;&quot;&amp;&#39;');
});
