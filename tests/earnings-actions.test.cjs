// Earnings & Payouts — exercises the real server actions in
// src/app/actions/consultationActions.ts against a stateful Supabase test
// double that enforces the live `payments` / `consultations` constraints
// (enum values, NOT NULL columns, foreign keys, unknown columns).
// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');

const LAWYER = '22222222-2222-4222-8222-000000000001';
const LAWYER_2 = '22222222-2222-4222-8222-000000000002';
const CLIENT = '11111111-1111-4111-8111-000000000001';
const CLIENT_2 = '11111111-1111-4111-8111-000000000002';
const MEET = 'https://meet.google.com/abc-defg-hij';

// ─── Live schema facts (read from the project's PostgREST spec) ─────────────
const SCHEMA = {
  payments: {
    columns: ['id', 'consultation_id', 'payer_id', 'payee_id', 'amount', 'platform_fee', 'currency', 'status',
      'payout_status', 'provider', 'provider_payment_id', 'masked_card_last4', 'paid_at', 'created_at', 'updated_at'],
    required: ['consultation_id', 'payer_id', 'payee_id', 'amount', 'platform_fee', 'currency', 'status', 'payout_status', 'provider'],
    enums: { status: ['pending', 'paid', 'failed', 'refunded'], payout_status: ['not_applicable', 'pending', 'released', 'failed'] },
    fks: { payer_id: 'profiles', payee_id: 'profiles', consultation_id: 'consultations' },
  },
  consultations: {
    columns: ['id', 'client_id', 'lawyer_id', 'case_id', 'scheduled_start', 'scheduled_end', 'proposed_start', 'proposed_end',
      'method', 'status', 'practice_area', 'concern_summary', 'meeting_url', 'cancelled_by', 'created_at', 'updated_at', 'scheduled_time'],
    required: ['client_id', 'lawyer_id', 'status'],
    enums: { status: ['pending', 'confirmed', 'awaiting_client_confirmation', 'declined', 'cancelled', 'completed'] },
    fks: {},
  },
};

// ─── Supabase test double ───────────────────────────────────────────────────
function makeDb(state) {
  const pk = (table) => (['profiles', 'lawyer_profiles'].includes(table) ? 'user_id' : table === 'platform_settings' ? 'key' : 'id');

  function validate(table, row, isInsert) {
    const spec = SCHEMA[table];
    if (!spec) return null;
    for (const key of Object.keys(row)) {
      if (!spec.columns.includes(key)) return { code: 'PGRST204', message: `Could not find the '${key}' column of '${table}'` };
    }
    if (isInsert) {
      for (const key of spec.required) {
        if (row[key] === undefined || row[key] === null) return { code: '23502', message: `null value in column "${key}" of "${table}"` };
      }
    }
    for (const [key, values] of Object.entries(spec.enums)) {
      if (key in row && !values.includes(row[key])) return { code: '22P02', message: `invalid input value for enum ${key}: "${row[key]}"` };
    }
    for (const [key, target] of Object.entries(spec.fks)) {
      if (key in row && row[key] !== null && !state.tables[target].some((r) => r[pk(target)] === row[key])) {
        return { code: '23503', message: `insert or update on "${table}" violates foreign key on ${key}` };
      }
    }
    return null;
  }

  function embed(table, row, cols) {
    const out = { ...row };
    if (table === 'consultations' && cols) {
      if (cols.includes('client:profiles')) {
        const p = state.tables.profiles.find((r) => r.user_id === row.client_id);
        out.client = p ? { full_name: p.full_name, email: p.email, phone: p.phone ?? null } : null;
      }
      if (/(^|[\s,])lawyer_profiles\(/.test(cols)) {
        out.lawyer_profiles = state.tables.lawyer_profiles.find((r) => r.user_id === row.lawyer_id) ?? null;
      }
    }
    return out;
  }

  function builder(table) {
    const filters = [];
    let op = 'select';
    let payload = null;
    let returning = false;
    let cols = '*';
    let order = null;
    let limit = null;
    let upsertKey = null;
    const q = {
      select(c) { if (op === 'select') cols = c; else { returning = true; cols = c; } return q; },
      insert(v) { op = 'insert'; payload = v; return q; },
      update(v) { op = 'update'; payload = v; return q; },
      upsert(v, o) { op = 'upsert'; payload = v; upsertKey = o?.onConflict ?? pk(table); return q; },
      delete() { op = 'delete'; return q; },
      eq(k, v) { filters.push((r) => r[k] === v); return q; },
      neq(k, v) { filters.push((r) => r[k] !== v); return q; },
      in(k, vs) { filters.push((r) => vs.includes(r[k])); return q; },
      is(k, v) { filters.push((r) => (r[k] ?? null) === v); return q; },
      not(k, o, v) { filters.push((r) => (o === 'is' ? (r[k] ?? null) !== v : r[k] !== v)); return q; },
      gte(k, v) { filters.push((r) => r[k] >= v); return q; },
      lte(k, v) { filters.push((r) => r[k] <= v); return q; },
      gt(k, v) { filters.push((r) => r[k] > v); return q; },
      lt(k, v) { filters.push((r) => r[k] < v); return q; },
      filter(k, o, v) { return q[o] ? q[o](k, v) : q; },
      or() { return q; },
      order(k, o) { order = { k, asc: o?.ascending !== false }; return q; },
      limit(n) { limit = n; return q; },
      single() { return run('single'); },
      maybeSingle() { return run('maybe'); },
      then(res, rej) { return run('many').then(res, rej); },
    };

    async function run(mode) {
      state.log.push({ table, op });
      const rows = state.tables[table] ?? (state.tables[table] = []);
      const injected = state.failWrites?.({ table, op, payload });
      if (injected && op !== 'select') return { data: null, error: injected };
      let result = [];

      if (op === 'insert' || op === 'upsert') {
        const list = Array.isArray(payload) ? payload : [payload];
        for (const item of list) {
          const existing = op === 'upsert' ? rows.find((r) => r[upsertKey] === item[upsertKey]) : null;
          if (existing) {
            const err = validate(table, item, false);
            if (err) return { data: null, error: err };
            Object.assign(existing, item);
            result.push(existing);
            continue;
          }
          const row = { ...item };
          if (pk(table) === 'id' && !row.id) row.id = crypto.randomUUID();
          if (table === 'payments' || table === 'consultations') {
            row.created_at ??= new state.Date().toISOString();
            row.updated_at ??= row.created_at;
          }
          const err = validate(table, row, true);
          if (err) return { data: null, error: err };
          if (table === 'payments' && state.uniquePaymentPerConsultation && rows.some((r) => r.consultation_id === row.consultation_id)) {
            return { data: null, error: { code: '23505', message: 'duplicate payment for consultation' } };
          }
          rows.push(row);
          result.push(row);
        }
      } else {
        let matched = rows.filter((r) => filters.every((f) => f(r)));
        if (op === 'update') {
          const err = validate(table, payload, false);
          if (err) return { data: null, error: err };
          matched.forEach((r) => Object.assign(r, payload));
        } else if (op === 'delete') {
          state.tables[table] = rows.filter((r) => !matched.includes(r));
        }
        if (order) {
          matched = [...matched].sort((a, b) => (a[order.k] < b[order.k] ? -1 : a[order.k] > b[order.k] ? 1 : 0) * (order.asc ? 1 : -1));
        }
        if (limit !== null) matched = matched.slice(0, limit);
        result = matched;
      }

      if (op !== 'select' && !returning) return { data: null, error: null };
      const data = result.map((r) => embed(table, r, cols));
      if (mode === 'single') return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'not single' } };
      if (mode === 'maybe') return data.length > 1 ? { data: null, error: { code: 'PGRST116', message: 'multiple rows' } } : { data: data[0] ?? null, error: null };
      return { data, error: null };
    }
    return q;
  }

  return {
    from: builder,
    storage: {
      from: () => ({
        upload: async () => ({ data: {}, error: null }),
        remove: async () => ({ data: {}, error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: 'https://signed' }, error: null }),
      }),
    },
  };
}

// ─── Clock & fixtures ───────────────────────────────────────────────────────
function makeClock(iso) {
  const RealDate = Date;
  const clock = { now: new RealDate(iso).getTime() };
  class FakeDate extends RealDate {
    constructor(...args) { if (args.length === 0) super(clock.now); else super(...args); }
    static now() { return clock.now; }
  }
  clock.Date = FakeDate;
  clock.set = (value) => { clock.now = new RealDate(value).getTime(); };
  return clock;
}

const compiled = ts.transpileModule(fs.readFileSync('src/app/actions/consultationActions.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

let seq = 0;
const uuid = (prefix = '33333333') => `${prefix}-${String(++seq).padStart(4, '0')}-4333-8333-${String(seq).padStart(12, '0')}`;

function fixture({ now = '2026-11-21T02:00:00Z', platformFee = 50 } = {}) {
  const clock = makeClock(now);
  const state = {
    userId: null,
    log: [],
    signals: [],
    logs: [],
    failWrites: null,
    Date: clock.Date,
    tables: {
      profiles: [
        { user_id: LAWYER, email: 'atty@test.ph', full_name: 'Atty. Test Lawyer', role: 'lawyer' },
        { user_id: LAWYER_2, email: 'other@test.ph', full_name: 'Atty. Other', role: 'lawyer' },
        { user_id: CLIENT, email: 'client@test.ph', full_name: 'Clyde Client', role: 'client' },
        { user_id: CLIENT_2, email: 'second@test.ph', full_name: 'Second Client', role: 'client' },
      ],
      user_accounts: [],
      lawyer_profiles: [
        { user_id: LAWYER, full_name: 'Atty. Test Lawyer', roll_number: '1', ibp_chapter: 'Cebu', practice_areas: ['Family Law', 'Civil Law'], experience_years: 5, fee_standard_60min: 1000, rating_avg: 4.5, rating_count: 3 },
        { user_id: LAWYER_2, full_name: 'Atty. Other', roll_number: '2', ibp_chapter: 'Cebu', practice_areas: ['Criminal Law'], experience_years: 2, fee_standard_60min: 800, rating_avg: 0, rating_count: 0 },
      ],
      platform_settings: [{ key: 'platform_fee_php', value: platformFee }],
      consultations: [],
      payments: [],
      documents: [],
      document_access_grants: [],
      notifications: [],
      messages: [],
    },
  };
  const db = makeDb(state);
  const exports = {};
  const sink = (level) => (...args) => state.logs.push({ level, text: args.map(String).join(' ') });
  vm.runInNewContext(compiled, {
    exports,
    Date: clock.Date,
    File,
    FormData,
    Blob,
    URL,
    setTimeout,
    console: { error: sink('error'), warn: sink('warn'), log() {} },
    require(name) {
      if (name === 'crypto') return crypto;
      if (name === 'next/cache') return { revalidatePath() {} };
      if (name === 'next/server') return { after: (fn) => fn() };
      if (name === '@/lib/realtime/live') {
        return { emitLive: async (userIds, scopes) => { state.signals.push({ userIds: [...userIds], scopes: [...scopes] }); } };
      }
      if (name === '@/lib/supabase/server') {
        return {
          createServiceClient: async () => db,
          createClient: async () => ({
            auth: { getUser: async () => ({ data: { user: state.userId ? { id: state.userId, email: 'x@test.ph', user_metadata: {} } : null } }) },
          }),
        };
      }
      throw new Error(`unexpected import ${name}`);
    },
  });

  const as = (userId) => { state.userId = userId; return exports; };

  /** Inserts a consultation the way bookConsultationAction stores it. */
  function seedConsultation({ client = CLIENT, lawyer = LAWYER, status = 'pending', start, end, fee = 1000, extraMeta = {}, practiceArea = null }) {
    const id = uuid();
    const s = new Date(start);
    const e = new Date(end ?? s.getTime() + 60 * 60 * 1000);
    state.tables.consultations.push({
      id,
      client_id: client,
      lawyer_id: lawyer,
      scheduled_start: s.toISOString(),
      scheduled_end: e.toISOString(),
      scheduled_time: start.slice(0, 10),
      method: 'video',
      status,
      practice_area: practiceArea,
      concern_summary: JSON.stringify({ subject: 'Lease dispute', description: 'Deposit not returned', fee, attachedFiles: [], ...extraMeta }),
      meeting_url: null,
      created_at: new clock.Date().toISOString(),
      updated_at: new clock.Date().toISOString(),
    });
    return id;
  }

  const proofForm = (consultationId, name = 'receipt.png') => {
    const fd = new FormData();
    fd.set('consultationId', consultationId);
    fd.set('file', new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' }));
    return fd;
  };

  const ledger = (consultationId) => state.tables.payments.filter((p) => p.consultation_id === consultationId);
  const consultation = (id) => state.tables.consultations.find((c) => c.id === id);

  /** Runs pending → approved → proof submitted → payment confirmed. */
  async function payAndConfirm(id, client = CLIENT) {
    assert.equal((await as(LAWYER).respondToConsultationAction(id, 'approved')).success, true, 'approve');
    const submitted = await as(client).submitPaymentProofAction(proofForm(id));
    assert.equal(submitted.success, true, `submit proof: ${submitted.error}`);
    const confirmed = await as(LAWYER).reviewPaymentAction(id, 'confirm', { meetingLink: MEET });
    assert.equal(confirmed.success, true, `confirm: ${confirmed.error}`);
  }

  async function earnings(userId = LAWYER) {
    const res = await as(userId).getLawyerEarningsAction();
    assert.equal(res.success, true, `earnings: ${res.error}`);
    return res.data;
  }

  return { state, clock, as, seedConsultation, proofForm, ledger, consultation, payAndConfirm, earnings };
}

const NOV_25_10AM = '2026-11-25T10:00:00+08:00';

// ═══ 1. Recording the sale through the real payment flow ════════════════════

test('full flow: approve → proof → confirm records exactly one paid sale with payout pending', async () => {
  const f = fixture();
  const id = f.seedConsultation({ start: NOV_25_10AM });

  assert.equal((await f.as(LAWYER).respondToConsultationAction(id, 'approved')).success, true);
  assert.equal(f.consultation(id).status, 'awaiting_client_confirmation');
  assert.equal(f.ledger(id).length, 0, 'approval alone records nothing');

  assert.equal((await f.as(CLIENT).submitPaymentProofAction(f.proofForm(id))).success, true);
  let [row] = f.ledger(id);
  assert.equal(f.ledger(id).length, 1);
  assert.equal(row.status, 'pending');
  assert.equal(row.payout_status, 'not_applicable');
  assert.equal(row.paid_at, null);
  assert.equal(row.amount, 1050, 'session fee 1000 + platform fee 50');
  assert.equal(row.platform_fee, 50);

  let data = await f.earnings();
  assert.equal(data.monthlyEarnings[10], 0, 'proof under review is not a sale yet');
  assert.equal(data.transactions.length, 0);

  f.clock.set('2026-11-21T05:30:00Z');
  const res = await f.as(LAWYER).reviewPaymentAction(id, 'confirm', { meetingLink: MEET });
  assert.equal(res.success, true);
  assert.equal(f.consultation(id).status, 'confirmed');
  assert.equal(f.ledger(id).length, 1, 'same ledger row is promoted, no duplicate');
  [row] = f.ledger(id);
  assert.equal(row.status, 'paid');
  assert.equal(row.payout_status, 'pending');
  assert.equal(row.paid_at, '2026-11-21T05:30:00.000Z');
  assert.equal(row.payer_id, CLIENT);
  assert.equal(row.payee_id, LAWYER);
  assert.equal(row.provider, 'manual_qr');
  assert.equal(row.currency, 'PHP');
  assert.ok(row.provider_payment_id, 'proof document id is kept as the provider reference');

  data = await f.earnings();
  assert.equal(data.year, 2026);
  assert.equal(data.currentMonth, 10);
  assert.equal(data.monthlyEarnings[10], 1000, 'lawyer earns amount − platform fee');
  assert.equal(data.monthlyEarnings.reduce((a, b) => a + b), 1000);
  assert.equal(data.transactions.length, 1);
  assert.deepEqual(
    { ...data.transactions[0], id: undefined, consultationId: undefined, paidMs: undefined },
    { id: undefined, consultationId: undefined, paidMs: undefined, clientName: 'Clyde Client', area: 'Family Law', sessionDate: '11/25/2026',
      paidDate: '11/21/2026', paidMonth: 10, gross: 1050, platformFee: 50, net: 1000, payoutStatus: 'pending' },
  );
  assert.equal(data.monthlyConsultations[10], 1);
  assert.equal(data.inquiries[0].status, 'upcoming');
});

test('rejected proof marks the row failed; resubmitting and confirming reuses it', async () => {
  const f = fixture();
  const id = f.seedConsultation({ start: NOV_25_10AM });
  await f.as(LAWYER).respondToConsultationAction(id, 'approved');
  await f.as(CLIENT).submitPaymentProofAction(f.proofForm(id));

  assert.equal((await f.as(LAWYER).reviewPaymentAction(id, 'reject', { reason: 'Blurry screenshot' })).success, true);
  assert.equal(f.ledger(id)[0].status, 'failed');
  assert.equal(f.ledger(id)[0].payout_status, 'not_applicable');
  assert.equal((await f.earnings()).monthlyEarnings[10], 0);
  assert.equal((await f.earnings()).inquiries[0].status, 'pendingPayment');

  assert.equal((await f.as(CLIENT).submitPaymentProofAction(f.proofForm(id, 'clear.png'))).success, true);
  assert.equal(f.ledger(id)[0].status, 'pending');
  assert.equal((await f.as(LAWYER).reviewPaymentAction(id, 'confirm', { meetingLink: MEET })).success, true);
  assert.equal(f.ledger(id).length, 1);
  assert.equal(f.ledger(id)[0].status, 'paid');
  assert.equal((await f.earnings()).monthlyEarnings[10], 1000);
});

test('confirm rejects a bad Meet link and writes nothing', async () => {
  const f = fixture();
  const id = f.seedConsultation({ start: NOV_25_10AM });
  await f.as(LAWYER).respondToConsultationAction(id, 'approved');
  await f.as(CLIENT).submitPaymentProofAction(f.proofForm(id));
  for (const link of ['', 'https://zoom.us/j/1', 'http://meet.google.com/x']) {
    assert.equal((await f.as(LAWYER).reviewPaymentAction(id, 'confirm', { meetingLink: link })).success ?? false, false);
  }
  assert.equal(f.ledger(id)[0].status, 'pending');
  assert.equal(f.consultation(id).status, 'awaiting_client_confirmation');
});

test('payment cannot be confirmed twice or by another lawyer', async () => {
  const f = fixture();
  const id = f.seedConsultation({ start: NOV_25_10AM });
  await f.as(LAWYER).respondToConsultationAction(id, 'approved');
  await f.as(CLIENT).submitPaymentProofAction(f.proofForm(id));
  assert.equal((await f.as(LAWYER_2).reviewPaymentAction(id, 'confirm', { meetingLink: MEET })).success ?? false, false);
  assert.equal(f.ledger(id)[0].status, 'pending');
  assert.equal((await f.as(LAWYER).reviewPaymentAction(id, 'confirm', { meetingLink: MEET })).success, true);
  const paidAt = f.ledger(id)[0].paid_at;
  f.clock.set('2026-11-22T00:00:00Z');
  assert.equal((await f.as(LAWYER).reviewPaymentAction(id, 'confirm', { meetingLink: MEET })).success ?? false, false);
  assert.equal(f.ledger(id).length, 1);
  assert.equal(f.ledger(id)[0].paid_at, paidAt);
});

test('fee breakdown follows session length and the platform fee setting', async () => {
  const f = fixture({ platformFee: 75 });
  const twoHours = f.seedConsultation({ start: NOV_25_10AM, end: '2026-11-25T12:00:00+08:00', fee: 1000 });
  const ninetyMin = f.seedConsultation({ start: '2026-11-26T10:00:00+08:00', end: '2026-11-26T11:30:00+08:00', fee: 999.99 });
  await f.payAndConfirm(twoHours);
  await f.payAndConfirm(ninetyMin);
  assert.equal(f.ledger(twoHours)[0].amount, 2075);
  assert.equal(f.ledger(twoHours)[0].platform_fee, 75);
  assert.equal(f.ledger(ninetyMin)[0].amount, 1574.99, '999.99 × 1.5 = 1499.985 → 1499.99, + 75');
  const data = await f.earnings();
  assert.equal(data.monthlyEarnings[10], 2000 + 1499.99);
  assert.equal(data.transactions.reduce((s, t) => s + t.net, 0), 3499.99);
});

// ═══ 2. Self-healing ledger ═════════════════════════════════════════════════

test('if the ledger write fails during confirm, the booking still confirms and the earnings load backfills the sale', async () => {
  const f = fixture();
  const id = f.seedConsultation({ start: NOV_25_10AM });
  await f.as(LAWYER).respondToConsultationAction(id, 'approved');
  await f.as(CLIENT).submitPaymentProofAction(f.proofForm(id));

  f.clock.set('2026-11-21T06:00:00Z');
  f.state.failWrites = ({ table, op }) => (table === 'payments' && op === 'update' ? { code: '08006', message: 'connection lost' } : null);
  assert.equal((await f.as(LAWYER).reviewPaymentAction(id, 'confirm', { meetingLink: MEET })).success, true);
  assert.equal(f.consultation(id).status, 'confirmed');
  assert.equal(f.ledger(id)[0].status, 'pending', 'write failed');
  assert.ok(f.state.logs.some((l) => l.level === 'error' && l.text.includes('ledger write failed')), 'failure is logged, not swallowed');

  f.state.failWrites = null;
  f.clock.set('2026-11-23T00:00:00Z');
  const data = await f.earnings();
  assert.equal(f.ledger(id).length, 1);
  assert.equal(f.ledger(id)[0].status, 'paid');
  assert.equal(f.ledger(id)[0].paid_at, '2026-11-21T06:00:00.000Z', 'backfill uses the review time, not the load time');
  assert.equal(data.monthlyEarnings[10], 1000);
});

test('legacy confirmed bookings with no proof and no ledger row are backfilled once', async () => {
  const f = fixture();
  const id = f.seedConsultation({ status: 'confirmed', start: '2026-10-05T09:00:00+08:00', extraMeta: { confirmedAt: '2026-10-01T03:00:00.000Z' } });
  const first = await f.earnings();
  const second = await f.earnings();
  assert.equal(f.ledger(id).length, 1, 'idempotent');
  assert.equal(f.ledger(id)[0].status, 'paid');
  assert.equal(f.ledger(id)[0].provider_payment_id, null);
  assert.equal(f.ledger(id)[0].amount, 1050);
  assert.equal(first.monthlyEarnings[9], 1000, 'counted in October (confirmedAt)');
  assert.deepEqual([...second.monthlyEarnings], [...first.monthlyEarnings]);
});

test('loading earnings repeatedly never duplicates rows or moves paid_at', async () => {
  const f = fixture();
  const id = f.seedConsultation({ start: NOV_25_10AM });
  await f.payAndConfirm(id);
  const paidAt = f.ledger(id)[0].paid_at;
  for (let i = 0; i < 3; i++) {
    f.clock.set(`2026-11-2${2 + i}T00:00:00Z`);
    await f.earnings();
  }
  assert.equal(f.state.tables.payments.length, 1);
  assert.equal(f.ledger(id)[0].paid_at, paidAt);
});

test('a released payout is preserved when the sale is re-synced', async () => {
  const f = fixture();
  const id = f.seedConsultation({ status: 'confirmed', start: NOV_25_10AM });
  await f.earnings(); // backfill → paid / pending payout
  f.ledger(id)[0].payout_status = 'released';
  // Force a re-sync of an already paid row: drop it from the "paid" set by
  // flipping status, then let the backfill write it again.
  f.ledger(id)[0].status = 'pending';
  f.ledger(id)[0].payout_status = 'released';
  await f.earnings();
  assert.equal(f.ledger(id)[0].status, 'paid');
  assert.equal(f.ledger(id)[0].payout_status, 'pending', 'a non-paid row starts a new payout cycle');

  f.ledger(id)[0].payout_status = 'released';
  const data = await f.earnings();
  assert.equal(f.ledger(id)[0].payout_status, 'released', 'paid + released rows are left untouched');
  assert.equal(data.transactions[0].payoutStatus, 'released');
});

// ═══ 3. Refunds ═════════════════════════════════════════════════════════════

test('client cancelling a paid booking refunds the sale and removes it from earnings', async () => {
  const f = fixture();
  const id = f.seedConsultation({ start: NOV_25_10AM });
  await f.payAndConfirm(id);
  assert.equal((await f.earnings()).monthlyEarnings[10], 1000);

  assert.equal((await f.as(CLIENT).cancelConsultationAction(id)).success, true);
  assert.equal(f.ledger(id)[0].status, 'refunded');
  assert.equal(f.ledger(id)[0].payout_status, 'not_applicable');
  const data = await f.earnings();
  assert.equal(data.monthlyEarnings[10], 0);
  assert.equal(data.transactions.length, 0);
  assert.equal(data.inquiries[0].status, 'cancelled');
  assert.equal(data.monthlyConsultations[10], 0);
});

test('lawyer cancelling a paid booking refunds the sale', async () => {
  const f = fixture();
  const id = f.seedConsultation({ start: NOV_25_10AM });
  await f.payAndConfirm(id);
  assert.equal((await f.as(LAWYER).lawyerCancelConsultationAction(id, 'Conflict of interest found')).success, true);
  assert.equal(f.ledger(id)[0].status, 'refunded');
  assert.equal((await f.earnings()).monthlyEarnings[10], 0);
});

test('cancelling while the proof is still under review never counts as a sale', async () => {
  const f = fixture();
  const id = f.seedConsultation({ start: NOV_25_10AM });
  await f.as(LAWYER).respondToConsultationAction(id, 'approved');
  await f.as(CLIENT).submitPaymentProofAction(f.proofForm(id));
  assert.equal((await f.as(LAWYER).lawyerCancelConsultationAction(id, 'Emergency leave')).success, true);
  assert.equal(f.ledger(id)[0].status, 'pending');
  const data = await f.earnings();
  assert.equal(f.ledger(id)[0].status, 'pending', 'backfill does not promote cancelled bookings');
  assert.equal(data.monthlyEarnings[10], 0);
});

test('stale paid rows on cancelled/declined bookings (from before this change) are refunded on load', async () => {
  const f = fixture();
  const cancelled = f.seedConsultation({ status: 'cancelled', start: NOV_25_10AM, extraMeta: { approvedAt: 'x' } });
  f.state.tables.payments.push({ id: uuid('44444444'), consultation_id: cancelled, payer_id: CLIENT, payee_id: LAWYER, amount: 1050, platform_fee: 50,
    currency: 'PHP', status: 'paid', payout_status: 'pending', provider: 'manual_qr', paid_at: '2026-11-11T00:00:00Z', created_at: '2026-11-11T00:00:00Z' });
  const data = await f.earnings();
  assert.equal(f.ledger(cancelled)[0].status, 'refunded');
  assert.equal(data.monthlyEarnings[10], 0);
});

// ═══ 4. Dates & time zones ══════════════════════════════════════════════════

test('months are bucketed in Manila time (UTC+8)', async () => {
  const f = fixture({ now: '2026-12-10T00:00:00Z' });
  const a = f.seedConsultation({ status: 'confirmed', start: '2026-12-02T10:00:00+08:00', extraMeta: { confirmedAt: '2026-11-30T16:30:00.000Z' } }); // Dec 1 00:30 Manila
  const b = f.seedConsultation({ status: 'confirmed', start: '2026-12-03T10:00:00+08:00', extraMeta: { confirmedAt: '2026-11-30T15:30:00.000Z' } }); // Nov 30 23:30 Manila
  const data = await f.earnings();
  assert.equal(data.monthlyEarnings[11], 1000, 'Dec 1 00:30 Manila → December');
  assert.equal(data.monthlyEarnings[10], 1000, 'Nov 30 23:30 Manila → November');
  assert.equal(data.transactions.find((t) => t.consultationId === a).paidDate, '12/01/2026');
  assert.equal(data.transactions.find((t) => t.consultationId === b).paidDate, '11/30/2026');
});

test('in January, last December feeds the comparison but not this year’s chart or export', async () => {
  const f = fixture({ now: '2027-01-15T02:00:00Z' });
  f.seedConsultation({ status: 'completed', start: '2026-12-20T10:00:00+08:00', extraMeta: { confirmedAt: '2026-12-18T02:00:00.000Z' } });
  f.seedConsultation({ status: 'completed', start: '2026-06-20T10:00:00+08:00', extraMeta: { confirmedAt: '2026-06-18T02:00:00.000Z' } });
  f.seedConsultation({ status: 'confirmed', start: '2027-01-20T10:00:00+08:00', fee: 2000, extraMeta: { confirmedAt: '2027-01-10T02:00:00.000Z' } });
  const data = await f.earnings();
  assert.equal(data.year, 2027);
  assert.equal(data.currentMonth, 0);
  assert.equal(data.previousDecemberEarnings, 1000);
  assert.equal(data.monthlyEarnings[0], 2000);
  assert.equal(data.monthlyEarnings.reduce((a, b) => a + b), 2000, 'June/December 2026 excluded');
  assert.equal(data.transactions.length, 1);
  assert.equal(data.monthlyConsultations[0], 1);
});

test('transactions are newest first', async () => {
  const f = fixture();
  const ids = ['2026-03-01T00:00:00.000Z', '2026-11-02T00:00:00.000Z', '2026-07-09T00:00:00.000Z'].map((confirmedAt, i) =>
    f.seedConsultation({ status: 'completed', start: `2026-0${i + 1}-15T10:00:00+08:00`, extraMeta: { confirmedAt } }));
  const data = await f.earnings();
  assert.deepEqual([...data.transactions.map((t) => t.consultationId)], [ids[1], ids[2], ids[0]]);
  assert.deepEqual([...data.transactions.map((t) => t.paidMonth)], [10, 6, 2]);
});

// ═══ 5. Isolation & access ══════════════════════════════════════════════════

test('a lawyer only sees their own sales and consultations', async () => {
  const f = fixture();
  const mine = f.seedConsultation({ start: NOV_25_10AM });
  const theirs = f.seedConsultation({ lawyer: LAWYER_2, start: NOV_25_10AM, fee: 800 });
  await f.payAndConfirm(mine);
  assert.equal((await f.as(LAWYER_2).respondToConsultationAction(theirs, 'approved')).success, true);
  await f.as(CLIENT).submitPaymentProofAction(f.proofForm(theirs));
  assert.equal((await f.as(LAWYER_2).reviewPaymentAction(theirs, 'confirm', { meetingLink: MEET })).success, true);

  const a = await f.earnings(LAWYER);
  const b = await f.earnings(LAWYER_2);
  assert.equal(a.monthlyEarnings[10], 1000);
  assert.equal(b.monthlyEarnings[10], 800);
  assert.deepEqual([...a.transactions.map((t) => t.consultationId)], [mine]);
  assert.deepEqual([...a.inquiries.map((i) => i.id)], [mine]);
});

test('signed-out users and clients cannot read earnings', async () => {
  const f = fixture();
  f.seedConsultation({ status: 'confirmed', start: NOV_25_10AM });
  const signedOut = await f.as(null).getLawyerEarningsAction();
  assert.equal(signedOut.success ?? false, false);
  assert.match(signedOut.error, /session/i);
  const client = await f.as(CLIENT).getLawyerEarningsAction();
  assert.equal(client.success ?? false, false);
  assert.equal(f.state.tables.payments.length, 0, 'no backfill happens for unauthorised callers');
});

test('a ledger read failure returns an error instead of zeroed earnings', async () => {
  const f = fixture();
  f.seedConsultation({ status: 'confirmed', start: NOV_25_10AM });
  const db = f.state.tables;
  Object.defineProperty(db, 'payments', { get() { throw new Error('relation does not exist'); } });
  const res = await f.as(LAWYER).getLawyerEarningsAction();
  assert.equal(res.success ?? false, false);
  assert.match(res.error, /could not load/i);
});

// ═══ 6. Metric cards & inquiries table ══════════════════════════════════════

test('metric cards, response rate and inquiry statuses', async () => {
  const f = fixture(); // now: Nov 21 2026 10:00 Manila
  const ids = {
    pendingA: f.seedConsultation({ status: 'pending', start: '2026-11-28T10:00:00+08:00' }),
    pendingA2: f.seedConsultation({ status: 'pending', start: '2026-11-29T10:00:00+08:00' }),
    pendingB: f.seedConsultation({ client: CLIENT_2, status: 'pending', start: '2026-11-30T10:00:00+08:00' }),
    pendingExpired: f.seedConsultation({ client: CLIENT_2, status: 'pending', start: '2026-11-01T10:00:00+08:00' }), // never answered
    awaiting: f.seedConsultation({ status: 'awaiting_client_confirmation', start: '2026-11-27T10:00:00+08:00', extraMeta: { approvedAt: 'x' } }),
    todayLater: f.seedConsultation({ status: 'confirmed', start: '2026-11-21T15:00:00+08:00' }),
    todayEarlier: f.seedConsultation({ status: 'confirmed', start: '2026-11-21T08:00:00+08:00' }), // ended 09:00 → completed
    pastCompleted: f.seedConsultation({ status: 'completed', start: '2026-10-10T10:00:00+08:00' }),
    declined: f.seedConsultation({ status: 'declined', start: '2026-11-26T10:00:00+08:00', extraMeta: { declinedAt: 'x' } }),
    withdrawn: f.seedConsultation({ status: 'cancelled', start: '2026-11-26T13:00:00+08:00' }), // client cancelled before any answer
    cancelledAfterApproval: f.seedConsultation({ status: 'cancelled', start: '2026-11-26T15:00:00+08:00', extraMeta: { approvedAt: 'x' } }),
    lastYear: f.seedConsultation({ status: 'completed', start: '2025-11-10T10:00:00+08:00' }),
  };
  const data = await f.earnings();

  assert.equal(data.pendingRequests, 4);
  assert.equal(data.pendingClients, 2, 'distinct people waiting');
  assert.equal(data.todayScheduled, 2);
  assert.equal(data.completedSessions, 3, 'completed (2) + confirmed whose end has passed (1)');
  assert.equal(data.monthlyConsultations[10], 2, 'paid sessions in November');
  assert.equal(data.monthlyConsultations[9], 1);
  assert.equal(data.reviewCount, 3);
  // Ignored: withdrawn + 3 future pending (still answerable). Considered 8:
  // answered 7 (awaiting, 2×today, past, declined, cancelledAfterApproval, lastYear) + 1 expired unanswered → 7/8 = 87.5%
  assert.equal(data.responseRate, 88);

  const status = Object.fromEntries(data.inquiries.map((i) => [i.id, i.status]));
  assert.equal(status[ids.pendingA], 'pendingApproval');
  assert.equal(status[ids.awaiting], 'pendingPayment');
  assert.equal(status[ids.todayLater], 'upcoming');
  assert.equal(status[ids.todayEarlier], 'completed');
  assert.equal(status[ids.pastCompleted], 'completed');
  assert.equal(status[ids.declined], 'cancelled');
  assert.equal(status[ids.withdrawn], 'cancelled');
  assert.equal(status[ids.pendingExpired], 'pendingApproval');
  assert.equal(data.inquiries.length, 12);
  for (let i = 1; i < data.inquiries.length; i++) {
    assert.ok(data.inquiries[i - 1].startMs >= data.inquiries[i].startMs, 'newest session first');
  }
  const row = data.inquiries.find((i) => i.id === ids.pendingB);
  assert.equal(row.name, 'Second Client');
  assert.equal(row.date, '11/30/2026');
  assert.equal(row.area, 'Family Law', 'falls back to the lawyer’s primary practice area');
});

test('a brand-new request does not lower the response rate', async () => {
  const f = fixture();
  f.seedConsultation({ status: 'pending', start: NOV_25_10AM });
  assert.equal((await f.earnings()).responseRate, null, 'nothing has needed an answer yet');
  f.seedConsultation({ status: 'awaiting_client_confirmation', start: '2026-11-26T10:00:00+08:00', extraMeta: { approvedAt: 'x' } });
  assert.equal((await f.earnings()).responseRate, 100);
  f.clock.set('2026-11-26T00:00:00Z'); // the first request's time has now passed unanswered
  assert.equal((await f.earnings()).responseRate, 50);
});

test('empty account: no requests yet, response rate null, all zeros', async () => {
  const f = fixture();
  const data = await f.earnings();
  assert.equal(data.responseRate, null);
  assert.deepEqual([...data.monthlyEarnings], Array(12).fill(0));
  assert.equal(data.transactions.length, 0);
  assert.equal(data.inquiries.length, 0);
});

test('a consultation-level practice area wins over the lawyer default', async () => {
  const f = fixture();
  const id = f.seedConsultation({ status: 'confirmed', start: NOV_25_10AM, practiceArea: 'Labor & Employment' });
  const data = await f.earnings();
  assert.equal(data.inquiries.find((i) => i.id === id).area, 'Labor & Employment');
  assert.equal(data.transactions[0].area, 'Labor & Employment');
});

// ═══ 7. Live-update signals ═════════════════════════════════════════════════

const signalsFor = (state, userId) =>
  [...new Set(state.signals.filter((s) => s.userIds.includes(userId)).flatMap((s) => s.scopes))].sort();

test('every step of the payment flow signals both people with the right scopes', async () => {
  const f = fixture();
  const id = f.seedConsultation({ start: NOV_25_10AM });

  await f.as(LAWYER).respondToConsultationAction(id, 'approved');
  assert.deepEqual(signalsFor(f.state, CLIENT), ['consultations', 'documents', 'messages', 'notifications']);
  assert.deepEqual(signalsFor(f.state, LAWYER), ['consultations', 'documents', 'messages']);

  f.state.signals = [];
  await f.as(CLIENT).submitPaymentProofAction(f.proofForm(id));
  assert.deepEqual(signalsFor(f.state, LAWYER), ['consultations', 'documents', 'messages', 'notifications', 'payments']);
  assert.ok(signalsFor(f.state, CLIENT).includes('payments'));

  f.state.signals = [];
  await f.as(LAWYER).reviewPaymentAction(id, 'confirm', { meetingLink: MEET });
  assert.deepEqual(signalsFor(f.state, CLIENT), ['consultations', 'messages', 'notifications', 'payments']);
  assert.ok(signalsFor(f.state, LAWYER).includes('payments'), 'the lawyer’s own Earnings tab refreshes too');

  f.state.signals = [];
  await f.as(CLIENT).cancelConsultationAction(id);
  assert.ok(signalsFor(f.state, LAWYER).includes('payments'), 'refund updates the lawyer’s earnings live');
  assert.ok(signalsFor(f.state, LAWYER).includes('notifications'));
});

test('failed or rejected actions send no signals', async () => {
  const f = fixture();
  const id = f.seedConsultation({ start: NOV_25_10AM });
  await f.as(LAWYER_2).respondToConsultationAction(id, 'approved'); // not their consultation
  await f.as(null).getLawyerEarningsAction();
  await f.as(LAWYER).reviewPaymentAction(id, 'confirm', { meetingLink: MEET }); // nothing to review
  assert.deepEqual(f.state.signals, []);
});

test('read-only loaders never signal (no refresh loops)', async () => {
  const f = fixture();
  f.seedConsultation({ status: 'confirmed', start: NOV_25_10AM }); // forces a ledger backfill write
  await f.earnings();
  await f.as(LAWYER).getLawyerConsultationsAction();
  assert.deepEqual(f.state.signals, []);
});
