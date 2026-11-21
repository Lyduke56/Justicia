// Live updates — server side: private topics + broadcast sender (src/lib/realtime/live.ts)
// and the parallel read endpoint (src/app/api/live/route.ts).
// Run: node --test tests/live-updates.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');

const transpile = (file) =>
  ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

const LIVE_SRC = transpile('src/lib/realtime/live.ts');
const ROUTE_SRC = transpile('src/app/api/live/route.ts');

function loadLive({ env = {}, fetchImpl } = {}) {
  const calls = [];
  const warnings = [];
  const exports = {};
  vm.runInNewContext(LIVE_SRC, {
    exports,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-key', ...env } },
    fetch: async (url, init) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      return fetchImpl ? fetchImpl(url, init) : { ok: true, status: 202 };
    },
    AbortSignal,
    console: { warn: (...a) => warnings.push(a.join(' ')) },
    require: (name) => {
      if (name === 'node:crypto') return crypto;
      throw new Error(name);
    },
  });
  return { live: exports, calls, warnings };
}

const A = '11111111-1111-4111-8111-000000000001';
const B = '22222222-2222-4222-8222-000000000002';

test('topics are private, stable per user, and different per user and secret', () => {
  const { live } = loadLive();
  const ta = live.liveTopicFor(A);
  assert.match(ta, /^live-[0-9a-f]{40}$/);
  assert.equal(live.liveTopicFor(A), ta, 'stable');
  assert.notEqual(live.liveTopicFor(B), ta, 'per user');
  assert.ok(!ta.includes(A.replace(/-/g, '').slice(0, 8)), 'does not reveal the user id');
  const other = loadLive({ env: { REALTIME_TOPIC_SECRET: 'different-secret' } }).live;
  assert.notEqual(other.liveTopicFor(A), ta, 'depends on the server secret');
  assert.equal(live.liveTopicFor(''), null);
  assert.equal(loadLive({ env: { SUPABASE_SERVICE_ROLE_KEY: '' } }).live.liveTopicFor(A), null, 'no secret → no topic');
});

test('emitLive sends one broadcast with deduplicated topics and scopes, no data', async () => {
  const { live, calls } = loadLive();
  await live.emitLive([A, B, A, null, undefined], ['payments', 'consultations', 'payments']);
  assert.equal(calls.length, 1);
  const { url, init, body } = calls[0];
  assert.equal(url, 'https://proj.supabase.co/realtime/v1/api/broadcast');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.apikey, 'service-key');
  assert.equal(body.messages.length, 2, 'one message per distinct user');
  assert.deepEqual(body.messages.map((m) => m.topic).sort(), [live.liveTopicFor(A), live.liveTopicFor(B)].sort());
  for (const m of body.messages) {
    assert.equal(m.event, 'refresh');
    assert.equal(m.private, false);
    assert.deepEqual(Object.keys(m.payload).sort(), ['at', 'scopes']);
    assert.deepEqual([...m.payload.scopes], ['payments', 'consultations']);
  }
  assert.ok(init.signal, 'request has a timeout signal');
});

test('emitLive is a no-op without users, scopes or config', async () => {
  for (const [ids, scopes, env] of [[[], ['payments']], [[A], []], [[null], ['payments']], [[A], ['payments'], { NEXT_PUBLIC_SUPABASE_URL: '' }]]) {
    const { live, calls } = loadLive({ env });
    await live.emitLive(ids, scopes);
    assert.equal(calls.length, 0);
  }
});

test('emitLive never throws: network errors and bad statuses are only logged', async () => {
  const failing = loadLive({ fetchImpl: () => { throw new Error('ECONNRESET'); } });
  await assert.doesNotReject(failing.live.emitLive([A], ['messages']));
  assert.ok(failing.warnings.some((w) => w.includes('ECONNRESET')));
  const rejected = loadLive({ fetchImpl: () => ({ ok: false, status: 401 }) });
  await assert.doesNotReject(rejected.live.emitLive([A], ['messages']));
  assert.ok(rejected.warnings.some((w) => w.includes('401')));
});

// ─── /api/live route ────────────────────────────────────────────────────────

function loadRoute(overrides = {}) {
  const calls = [];
  const actions = {
    getLawyerConsultationsAction: async () => { calls.push('lawyer-consultations'); return [{ id: 'c1' }]; },
    getLawyerEarningsAction: async () => { calls.push('lawyer-earnings'); return { success: true, data: { year: 2026 } }; },
    getClientConsultationsAction: async () => { calls.push('client-consultations'); return []; },
    getMessageThreadsAction: async () => { calls.push('threads'); return []; },
    getMessagesForThreadAction: async (id) => { calls.push(`thread-messages:${id}`); return []; },
    getThreadContextAction: async (id) => { calls.push(`thread-context:${id}`); return { meeting: null }; },
    getUserDocumentsDataAction: async (role) => { calls.push(`documents:${role}`); return []; },
    getUserNotificationsAction: async (role) => { calls.push(`notifications:${role}`); return []; },
    getPaymentChannelAction: async () => { calls.push('payment-channel'); return { qrImageUrl: null, caption: null }; },
    ...overrides,
  };
  const exports = {};
  vm.runInNewContext(ROUTE_SRC, {
    exports,
    console: { error() {} },
    require: (name) => {
      if (name === '@/app/actions/consultationActions') return actions;
      if (name === 'next/server') {
        return { NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200, headers: init.headers ?? {} }) } };
      }
      throw new Error(name);
    },
  });
  const get = (query) => exports.GET({ nextUrl: { searchParams: new URLSearchParams(query) } });
  return { route: exports, get, calls };
}

const THREAD = '33333333-3333-4333-8333-333333333333';

test('route serves each resource through its loader, uncached', async () => {
  const { get, calls, route } = loadRoute();
  assert.equal(route.dynamic, 'force-dynamic');
  const res = await get('resource=lawyer-consultations');
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(res.body)), { data: [{ id: 'c1' }] });
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  await get(`resource=thread-messages&threadId=${THREAD}`);
  await get(`resource=thread-context&threadId=${THREAD}`);
  await get('resource=documents&role=lawyer');
  await get('resource=documents');
  await get('resource=notifications&role=client');
  await get('resource=documents&role=admin');
  assert.deepEqual(calls, ['lawyer-consultations', `thread-messages:${THREAD}`, `thread-context:${THREAD}`,
    'documents:lawyer', 'documents:client', 'notifications:client', 'documents:client']);
});

test('route rejects unknown resources and bad thread ids without calling loaders', async () => {
  const { get, calls } = loadRoute();
  for (const q of ['', 'resource=__proto__', 'resource=constructor', 'resource=deleteEverything', 'resource=thread-messages',
    'resource=thread-messages&threadId=not-a-uuid', `resource=thread-context&threadId=${THREAD}x`]) {
    const res = await get(q);
    assert.equal(res.status, 400, q);
  }
  assert.deepEqual(calls, []);
});

test('route turns a loader crash into a 500 without leaking details', async () => {
  const { get } = loadRoute({ getMessageThreadsAction: async () => { throw new Error('db password=secret'); } });
  const res = await get('resource=threads');
  assert.equal(res.status, 500);
  assert.deepEqual(JSON.parse(JSON.stringify(res.body)), { error: 'Could not load data.' });
});
