// Rescheduling (consultationActions.ts) and account reports / moderation (reportActions.ts,
// lib/moderation/accountStatus.ts, auth.ts sign-in) — the real server actions run against a
// stateful Supabase double that enforces the live schema's enums, required columns and foreign
// keys, evaluates PostgREST `or()` filters, counts, Auth bans and Storage.
// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const { extraModule } = require('./support/extraModules.cjs');
const { AsyncLocalStorage } = require('node:async_hooks');

const ADMIN = '99999999-9999-4999-8999-000000000001';
const ADMIN_2 = '99999999-9999-4999-8999-000000000002';
const LAWYER = '22222222-2222-4222-8222-000000000001';
const LAWYER_2 = '22222222-2222-4222-8222-000000000002';
const CLIENT = '11111111-1111-4111-8111-000000000001';
const CLIENT_2 = '11111111-1111-4111-8111-000000000002';
const MEET = 'https://meet.google.com/abc-defg-hij';

// ─── Live schema facts (from the project's PostgREST spec) ─────────────────
const SCHEMA = {
  consultations: {
    columns: ['id', 'client_id', 'lawyer_id', 'case_id', 'scheduled_start', 'scheduled_end', 'proposed_start', 'proposed_end',
      'method', 'status', 'practice_area', 'concern_summary', 'meeting_url', 'cancelled_by', 'created_at', 'updated_at', 'scheduled_time'],
    required: ['client_id', 'lawyer_id', 'status'],
    enums: { status: ['pending', 'confirmed', 'awaiting_client_confirmation', 'declined', 'cancelled', 'completed'] },
    fks: { client_id: 'profiles', cancelled_by: 'profiles' },
  },
  reports: {
    columns: ['id', 'reporter_id', 'target_type', 'target_id', 'category', 'reason', 'evidence_paths', 'status', 'assigned_admin_id',
      'resolution_notes', 'resolved_at', 'created_at', 'updated_at'],
    required: ['reporter_id', 'target_type', 'target_id', 'category', 'reason', 'evidence_paths', 'status'],
    enums: {
      target_type: ['user', 'lawyer', 'message', 'review', 'ai_message', 'consultation'],
      category: ['misconduct', 'ai_error', 'spam', 'fee_dispute', 'other'],
      status: ['open', 'under_review', 'resolved', 'dismissed', 'appealed'],
    },
    fks: { reporter_id: 'profiles', assigned_admin_id: 'profiles' },
  },
  moderation_actions: {
    columns: ['id', 'report_id', 'admin_id', 'action', 'rationale', 'created_at'],
    required: ['report_id', 'admin_id', 'action', 'rationale'],
    enums: { action: ['warning', 'content_removed', 'suspension', 'termination', 'no_action'] },
    fks: { report_id: 'reports', admin_id: 'profiles' },
  },
  profiles: {
    columns: ['user_id', 'email', 'full_name', 'phone', 'avatar_url', 'role', 'account_status', 'verification_status', 'mfa_enabled',
      'preferred_language', 'last_login_at', 'deletion_requested_at', 'created_at', 'updated_at'],
    required: ['user_id', 'email', 'role'],
    enums: { role: ['client', 'lawyer', 'admin'], account_status: ['active', 'suspended', 'terminated', 'pending_deletion'] },
    fks: {},
  },
  notifications: {
    columns: ['id', 'user_id', 'type', 'title', 'body', 'data', 'channel', 'is_read', 'created_at', 'metadata'],
    required: ['user_id', 'type', 'title', 'data', 'channel'],
    enums: { channel: ['in_app', 'email'] },
    fks: { user_id: 'profiles' },
  },
  audit_log: {
    columns: ['id', 'actor_id', 'action', 'target_type', 'target_id', 'details', 'created_at'],
    required: ['action'],
    enums: {},
    fks: { actor_id: 'user_accounts' },
  },
  messages: {
    columns: ['id', 'conversation_or_thread_id', 'sender_id', 'content', 'attachment_ids', 'role', 'citations', 'sent_at'],
    required: ['conversation_or_thread_id', 'content'],
    enums: {},
    fks: { sender_id: 'user_accounts' },
  },
  payments: {
    columns: ['id', 'consultation_id', 'payer_id', 'payee_id', 'amount', 'platform_fee', 'currency', 'status',
      'payout_status', 'provider', 'provider_payment_id', 'masked_card_last4', 'paid_at', 'created_at', 'updated_at'],
    required: ['consultation_id', 'payer_id', 'payee_id', 'amount', 'platform_fee', 'currency', 'status', 'payout_status', 'provider'],
    enums: { status: ['pending', 'paid', 'failed', 'refunded'], payout_status: ['not_applicable', 'pending', 'released', 'failed'] },
    fks: { payer_id: 'profiles', payee_id: 'profiles', consultation_id: 'consultations' },
  },
};

// ─── PostgREST or() filter parsing ──────────────────────────────────────────
function splitTop(text) {
  const parts = [];
  let depth = 0;
  let quoted = false;
  let current = '';
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === '(') depth++;
    if (!quoted && ch === ')') depth--;
    if (!quoted && ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += ch;
  }
  if (current) parts.push(current);
  return parts;
}
function parseCondition(text) {
  if (text.startsWith('and(') && text.endsWith(')')) {
    const inner = splitTop(text.slice(4, -1)).map(parseCondition);
    return (r) => inner.every((f) => f(r));
  }
  if (text.startsWith('or(') && text.endsWith(')')) {
    const inner = splitTop(text.slice(3, -1)).map(parseCondition);
    return (r) => inner.some((f) => f(r));
  }
  const [col, op, ...rest] = text.split('.');
  const raw = rest.join('.').replace(/^"|"$/g, '');
  const ops = {
    eq: (v) => String(v) === raw,
    neq: (v) => String(v) !== raw,
    lt: (v) => v != null && cmp(v, raw) < 0,
    lte: (v) => v != null && cmp(v, raw) <= 0,
    gt: (v) => v != null && cmp(v, raw) > 0,
    gte: (v) => v != null && cmp(v, raw) >= 0,
    is: (v) => (raw === 'null' ? v === null || v === undefined : String(v) === raw),
  };
  if (!ops[op]) throw new Error(`or(): unsupported operator ${op}`);
  return (r) => ops[op](r[col]);
}

// timestamptz columns compare as instants, not as text (e.g. '…+08:00' vs '…Z').
const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:/;
function cmp(a, b) {
  if (typeof a === 'string' && typeof b === 'string' && TS_RE.test(a) && TS_RE.test(b)) {
    return new Date(a).getTime() - new Date(b).getTime();
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

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
      if (key in row && row[key] !== null && !values.includes(row[key])) return { code: '22P02', message: `invalid input value for enum ${key}: "${row[key]}"` };
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
    let countMode = null;
    const q = {
      select(c, o) {
        if (op === 'select') {
          cols = c;
          if (o?.count) countMode = o.head ? 'head' : 'with';
        } else {
          returning = true;
          cols = c;
        }
        return q;
      },
      insert(v) { op = 'insert'; payload = v; return q; },
      update(v) { op = 'update'; payload = v; return q; },
      upsert(v, o) { op = 'upsert'; payload = v; upsertKey = o?.onConflict ?? pk(table); return q; },
      delete() { op = 'delete'; return q; },
      eq(k, v) {
        filters.push((r) => {
          if (typeof v === 'string' && typeof r[k] === 'string' && /T\d\d:/.test(v) && /T\d\d:/.test(r[k])) {
            return new Date(r[k]).getTime() === new Date(v).getTime(); // timestamptz comparison
          }
          return r[k] === v;
        });
        return q;
      },
      neq(k, v) { filters.push((r) => r[k] !== v); return q; },
      in(k, vs) { filters.push((r) => vs.includes(r[k])); return q; },
      is(k, v) { filters.push((r) => (r[k] ?? null) === v); return q; },
      not(k, o, v) { filters.push((r) => (o === 'is' ? (r[k] ?? null) !== v : r[k] !== v)); return q; },
      gte(k, v) { filters.push((r) => r[k] != null && cmp(r[k], v) >= 0); return q; },
      lte(k, v) { filters.push((r) => r[k] != null && cmp(r[k], v) <= 0); return q; },
      gt(k, v) { filters.push((r) => r[k] != null && cmp(r[k], v) > 0); return q; },
      lt(k, v) { filters.push((r) => r[k] != null && cmp(r[k], v) < 0); return q; },
      or(text) { const f = parseCondition(`or(${text})`); filters.push(f); return q; },
      order(k, o) { order = { k, asc: o?.ascending !== false }; return q; },
      limit(n) { limit = n; return q; },
      single() { return run('single'); },
      maybeSingle() { return run('maybe'); },
      then(res, rej) { return run('many').then(res, rej); },
    };

    async function run(mode) {
      await new Promise((r) => setImmediate(r)); // let concurrent calls interleave like real I/O
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
          const nowIso = new state.Date().toISOString();
          if (['payments', 'consultations', 'reports'].includes(table)) {
            row.created_at ??= nowIso;
            row.updated_at ??= row.created_at;
          }
          if (['moderation_actions', 'audit_log', 'notifications'].includes(table)) row.created_at ??= nowIso;
          if (table === 'messages') row.sent_at ??= nowIso;
          if (table === 'profiles') row.account_status ??= 'active';
          const err = validate(table, row, true);
          if (err) return { data: null, error: err };
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
          matched = [...matched].sort((a, b) => cmp(a[order.k], b[order.k]) * (order.asc ? 1 : -1));
        }
        const total = matched.length;
        if (limit !== null) matched = matched.slice(0, limit);
        result = matched;
        if (countMode === 'head') return { data: null, count: total, error: null };
      }

      if (op !== 'select' && !returning) return { data: null, error: null };
      const data = result.map((r) => embed(table, r, cols));
      if (mode === 'single') return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'not single' } };
      if (mode === 'maybe') return data.length > 1 ? { data: null, error: { code: 'PGRST116', message: 'multiple rows' } } : { data: data[0] ?? null, error: null };
      return { data, error: null };
    }
    return q;
  }

  const bucket = () => ({
    upload: async (path, body) => {
      if (state.failUpload?.(path)) return { data: null, error: { message: 'storage down' } };
      if (state.storage.has(path)) return { data: null, error: { message: 'The resource already exists' } };
      state.storage.set(path, Buffer.from(body));
      return { data: { path }, error: null };
    },
    remove: async (paths) => {
      paths.forEach((p) => state.storage.delete(p));
      state.removed.push(...paths);
      return { data: {}, error: null };
    },
    download: async (path) => (state.storage.has(path) ? { data: new Blob([state.storage.get(path)]), error: null } : { data: null, error: { message: 'not found' } }),
    createSignedUrl: async (path) => ({ data: state.storage.has(path) ? { signedUrl: `https://signed/${path}` } : null, error: null }),
  });

  return {
    from: builder,
    storage: { from: bucket },
    auth: {
      admin: {
        getUserById: async (id) => ({ data: { user: { id, banned_until: state.bans.get(id) ?? null } }, error: null }),
        updateUserById: async (id, attrs) => {
          if (state.failBan?.(id, attrs)) return { data: null, error: { message: 'auth admin unavailable' } };
          if ('ban_duration' in attrs) {
            if (attrs.ban_duration === 'none') state.bans.delete(id);
            else {
              const hours = Number(String(attrs.ban_duration).replace(/h$/, ''));
              state.bans.set(id, new state.Date(state.Date.now() + hours * 3600 * 1000).toISOString());
            }
            state.banCalls.push({ id, ban_duration: attrs.ban_duration });
          }
          return { data: { user: { id, banned_until: state.bans.get(id) ?? null } }, error: null };
        },
      },
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
  clock.advance = (ms) => { clock.now += ms; };
  return clock;
}

const compile = (file) => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const SOURCES = {
  consultations: compile('src/app/actions/consultationActions.ts'),
  reports: compile('src/app/actions/reportActions.ts'),
  accountStatus: compile('src/lib/moderation/accountStatus.ts'),
  constants: compile('src/lib/moderation/constants.ts'),
  auth: compile('src/app/actions/auth.ts'),
};

let seq = 0;
const uuid = () => `33333333-${String(++seq).padStart(4, '0')}-4333-8333-${String(seq).padStart(12, '0')}`;
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/** Manila wall-clock → ISO, e.g. ph('2026-11-25', 14) */
const ph = (date, hour, minute = 0) => new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`).toISOString();

function fixture({ now = '2026-11-21T02:00:00Z' } = {}) {
  const clock = makeClock(now);
  const identity = new AsyncLocalStorage();
  const state = {
    userId: null,
    log: [],
    signals: [],
    logs: [],
    emails: [],
    storage: new Map(),
    removed: [],
    bans: new Map(),
    banCalls: [],
    failWrites: null,
    failUpload: null,
    failBan: null,
    signIn: null,
    Date: clock.Date,
    tables: {
      profiles: [
        { user_id: ADMIN, email: 'admin@test.ph', full_name: 'System Admin', role: 'admin', account_status: 'active' },
        { user_id: ADMIN_2, email: 'admin2@test.ph', full_name: 'Second Admin', role: 'admin', account_status: 'active' },
        { user_id: LAWYER, email: 'atty@test.ph', full_name: 'Atty. Test Lawyer', role: 'lawyer', account_status: 'active' },
        { user_id: LAWYER_2, email: 'other@test.ph', full_name: 'Atty. Other', role: 'lawyer', account_status: 'active' },
        { user_id: CLIENT, email: 'client@test.ph', full_name: 'Clyde Client', role: 'client', account_status: 'active' },
        // CLIENT_2 only exists in user_accounts (older account) — profiles row is created on demand.
      ],
      user_accounts: [
        { id: ADMIN, email: 'admin@test.ph', full_name: 'System Admin', role: 'admin' },
        { id: ADMIN_2, email: 'admin2@test.ph', full_name: 'Second Admin', role: 'admin' },
        { id: LAWYER, email: 'atty@test.ph', full_name: 'Atty. Test Lawyer', role: 'lawyer' },
        { id: LAWYER_2, email: 'other@test.ph', full_name: 'Atty. Other', role: 'lawyer' },
        { id: CLIENT, email: 'client@test.ph', full_name: 'Clyde Client', role: 'client' },
        { id: CLIENT_2, email: 'second@test.ph', full_name: 'Second Client', role: 'client' },
      ],
      lawyer_profiles: [
        { user_id: LAWYER, full_name: 'Atty. Test Lawyer', roll_number: '1', ibp_chapter: 'Cebu', practice_areas: ['Family Law'], experience_years: 5, fee_standard_60min: 1000, rating_avg: 4.5, rating_count: 3, is_visible: true, is_available: true, verification_status: 'approved' },
        { user_id: LAWYER_2, full_name: 'Atty. Other', roll_number: '2', ibp_chapter: 'Cebu', practice_areas: ['Criminal Law'], experience_years: 2, fee_standard_60min: 800, rating_avg: 0, rating_count: 0, is_visible: true, is_available: true, verification_status: 'approved' },
      ],
      platform_settings: [{ key: 'platform_fee_php', value: 50 }],
      consultations: [],
      payments: [],
      documents: [],
      document_access_grants: [],
      notifications: [],
      messages: [],
      lawyer_unavailability: [],
      reports: [],
      moderation_actions: [],
      audit_log: [],
      reviews: [],
    },
  };
  const db = makeDb(state);
  const sink = (level) => (...args) => state.logs.push({ level, text: args.map(String).join(' ') });
  const console_ = { error: sink('error'), warn: sink('warn'), log() {} };
  const modules = {};

  class RedirectSignal extends Error {
    constructor(url) { super(`NEXT_REDIRECT ${url}`); this.url = url; }
  }

  const currentUser = () => (identity.getStore() ?? { id: state.userId }).id;
  const authClient = () => ({
    auth: {
      getUser: async () => {
        const id = currentUser();
        return { data: { user: id && !state.bans.has(id) ? { id, email: 'x@test.ph', user_metadata: {} } : null } };
      },
      signInWithPassword: async () => state.signIn(),
      signOut: async () => { state.signedOut = true; return { error: null }; },
    },
    from: db.from,
  });

  const load = (key) => {
    if (modules[key]) return modules[key];
    const mod = (modules[key] = {});
    vm.runInNewContext(SOURCES[key], {
      exports: mod,
      Date: clock.Date,
      File,
      FormData,
      Blob,
      Buffer,
      URL,
      setTimeout,
      console: console_,
      require: sandboxRequire,
    });
    return mod;
  };
  function sandboxRequire(name) {
    if (name === '@/lib/account/preferences') {
      const mod = {};
      const source = ts.transpileModule(fs.readFileSync('src/lib/account/preferences.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
      vm.runInNewContext(source, { exports: mod });
      return mod;
    }
    if (name === 'crypto') return crypto;
    if (name === 'next/cache') return { revalidatePath() {} };
    if (name === 'next/server') return { after: (fn) => fn() };
    if (name === 'next/navigation') return { redirect: (url) => { throw new RedirectSignal(url); } };
    if (name === 'next/headers') return { cookies: async () => ({ get: () => undefined, set() {} }) };
    if (name === '@/lib/utils/rbac') return { getDashboardForRole: (role) => `/${role}/dashboard` };
    if (name === '@/lib/realtime/live') {
      return { emitLive: async (userIds, scopes) => { state.signals.push({ userIds: [...userIds], scopes: [...scopes] }); } };
    }
    if (name === '@/lib/integrations/email') {
      return { sendEmail: async (payload) => { state.emails.push(payload); return { sent: true }; } };
    }
    if (name === '@/lib/moderation/accountStatus') return load('accountStatus');
    if (name === '@/lib/moderation/constants') return load('constants');
    if (name === '@/lib/supabase/server') {
      return { createServiceClient: async () => db, createClient: async () => authClient() };
    }
    const extra = extraModule(name);
    if (extra) return extra;
    throw new Error(`unexpected import ${name}`);
  }

  const consultations = load('consultations');
  const reports = load('reports');
  const auth = load('auth');
  // Each call keeps its own signed-in user, so concurrent calls can act as different people.
  const as = (userId) => {
    state.userId = userId;
    const api = { ...consultations, ...reports };
    return Object.fromEntries(Object.entries(api).map(([name, fn]) => [name, (...args) => identity.run({ id: userId }, () => fn(...args))]));
  };

  function seedConsultation({ client = CLIENT, lawyer = LAWYER, status = 'confirmed', start, end, extraMeta = {}, paid = status === 'confirmed' }) {
    const id = uuid();
    const s = new Date(start);
    const e = new Date(end ?? s.getTime() + HOUR);
    const manilaDate = new Date(s.getTime() + 8 * HOUR).toISOString().slice(0, 10);
    state.tables.consultations.push({
      id,
      client_id: client,
      lawyer_id: lawyer,
      scheduled_start: s.toISOString(),
      scheduled_end: e.toISOString(),
      scheduled_time: manilaDate,
      proposed_start: null,
      proposed_end: null,
      method: 'video',
      status,
      practice_area: null,
      concern_summary: JSON.stringify({
        subject: 'Lease dispute',
        description: 'Deposit not returned',
        fee: 1000,
        attachedFiles: [],
        ...(paid ? { paymentProof: { status: 'verified', documentId: null, fileName: 'r.png', reviewedAt: new clock.Date().toISOString() } } : {}),
        ...extraMeta,
      }),
      meeting_url: status === 'confirmed' ? MEET : null,
      cancelled_by: null,
      created_at: new clock.Date().toISOString(),
      updated_at: new clock.Date().toISOString(),
    });
    if (paid) {
      state.tables.payments.push({
        id: uuid(), consultation_id: id, payer_id: client, payee_id: lawyer, amount: 1050, platform_fee: 50, currency: 'PHP',
        status: 'paid', payout_status: 'pending', provider: 'manual_qr', provider_payment_id: null, masked_card_last4: null,
        paid_at: new clock.Date().toISOString(), created_at: new clock.Date().toISOString(), updated_at: new clock.Date().toISOString(),
      });
    }
    return id;
  }

  const consultation = (id) => state.tables.consultations.find((c) => c.id === id);
  const meta = (id) => JSON.parse(consultation(id).concern_summary);
  const notificationsOf = (userId, type) => state.tables.notifications.filter((n) => n.user_id === userId && (!type || n.type === type));
  const profile = (id) => state.tables.profiles.find((p) => p.user_id === id);
  const errors = () => state.logs.filter((l) => l.level === 'error');

  return { clock, state, db, as, auth, seedConsultation, consultation, meta, notificationsOf, profile, errors, RedirectSignal };
}

// Saturday 2026-11-21 10:00 PHT
const NOW = '2026-11-21T02:00:00Z';

// ═════════════════════════════════════════════════════════════════════════════
// RESCHEDULING
// ═════════════════════════════════════════════════════════════════════════════

test('client requests a reschedule: proposal stored, lawyer notified, both views show it', async () => {
  const f = fixture({ now: NOW });
  const id = f.seedConsultation({ start: ph('2026-11-25', 14) });

  const res = await f.as(CLIENT).requestRescheduleAction(id, { date: '2026-11-27', startMinutes: 10 * 60, reason: 'I have a hearing that day.' });
  assert.equal(res.success, true, res.error);

  const row = f.consultation(id);
  assert.equal(new Date(row.proposed_start).toISOString(), ph('2026-11-27', 10));
  assert.equal(new Date(row.proposed_end).toISOString(), ph('2026-11-27', 11), 'keeps the 1-hour duration');
  assert.equal(row.scheduled_start, ph('2026-11-25', 14), 'schedule does not move until accepted');
  assert.equal(f.meta(id).reschedule.requestedBy, 'client');

  const note = f.notificationsOf(LAWYER, 'consultation_reschedule_requested');
  assert.equal(note.length, 1);
  assert.match(note[0].body, /Clyde Client asked to move your consultation/);
  assert.ok(f.state.tables.messages.some((m) => m.role === 'system' && /asked to reschedule/.test(m.content)));
  assert.ok(f.state.signals.some((s) => s.userIds.includes(CLIENT) && s.userIds.includes(LAWYER) && s.scopes.includes('consultations')));

  const clientView = (await f.as(CLIENT).getClientConsultationsAction()).find((c) => c.id === id);
  assert.equal(clientView.reschedule.pending.byMe, true);
  assert.equal(clientView.reschedule.pending.proposedDateLong, 'Friday, November 27, 2026');
  assert.equal(clientView.reschedule.pending.proposedTimeRange, '10:00 AM - 11:00 AM');
  assert.equal(clientView.reschedule.canRequest, false);

  const lawyerView = (await f.as(LAWYER).getLawyerConsultationsAction()).find((c) => c.id === id);
  assert.equal(lawyerView.reschedule.pending.byMe, false);
  assert.equal(lawyerView.reschedule.pending.reason, 'I have a hearing that day.');
  assert.deepEqual(f.errors(), []);
});

test('lawyer accepts: schedule moves, payment and Meet link unchanged, requester notified', async () => {
  const f = fixture({ now: NOW });
  const id = f.seedConsultation({ start: ph('2026-11-25', 14) });
  const paymentBefore = JSON.stringify(f.state.tables.payments);
  assert.equal((await f.as(CLIENT).requestRescheduleAction(id, { date: '2026-11-27', startMinutes: 10 * 60, reason: 'Hearing that day' })).success, true);

  const res = await f.as(LAWYER).respondToRescheduleAction(id, 'accept');
  assert.equal(res.success, true, res.error);

  const row = f.consultation(id);
  assert.equal(new Date(row.scheduled_start).toISOString(), ph('2026-11-27', 10));
  assert.equal(new Date(row.scheduled_end).toISOString(), ph('2026-11-27', 11));
  assert.equal(row.scheduled_time, '2026-11-27');
  assert.equal(row.proposed_start, null);
  assert.equal(row.status, 'confirmed');
  assert.equal(row.meeting_url, MEET);
  assert.equal(JSON.stringify(f.state.tables.payments), paymentBefore, 'ledger untouched');
  const m = f.meta(id);
  assert.equal(m.reschedule, null);
  assert.equal(m.rescheduleHistory.at(-1).status, 'accepted');
  assert.equal(m.dateStr, 'November 27, 2026');
  assert.equal(m.paymentProof.status, 'verified', 'payment proof kept');

  assert.match(f.notificationsOf(CLIENT, 'consultation_rescheduled')[0].body, /now on Friday, November 27, 2026, 10:00 AM - 11:00 AM/);
  const view = (await f.as(CLIENT).getClientConsultationsAction()).find((c) => c.id === id);
  assert.equal(view.dateLong, 'Friday, November 27, 2026');
  assert.equal(view.reschedule.acceptedCount, 1);
  assert.equal(view.reschedule.remaining, 1);
  assert.equal(view.reschedule.canRequest, true);
  assert.equal(view.status, 'CONFIRMED APPOINTMENT');
});

test('lawyer can request and the client declines with a reason; original schedule stays', async () => {
  const f = fixture({ now: NOW });
  const id = f.seedConsultation({ start: ph('2026-11-25', 14) });
  assert.equal((await f.as(LAWYER).requestRescheduleAction(id, { date: '2026-11-26', startMinutes: 9 * 60, reason: 'Court schedule changed' })).success, true);
  assert.equal(f.notificationsOf(CLIENT, 'consultation_reschedule_requested').length, 1);

  const res = await f.as(CLIENT).respondToRescheduleAction(id, 'decline', 'I work mornings');
  assert.equal(res.success, true, res.error);
  const row = f.consultation(id);
  assert.equal(row.scheduled_start, ph('2026-11-25', 14));
  assert.equal(row.proposed_start, null);
  assert.match(f.notificationsOf(LAWYER, 'consultation_reschedule_declined')[0].body, /Reason: I work mornings/);

  const lawyerView = (await f.as(LAWYER).getLawyerConsultationsAction()).find((c) => c.id === id);
  assert.equal(lawyerView.reschedule.pending, null);
  assert.equal(lawyerView.reschedule.last.status, 'declined');
  assert.equal(lawyerView.reschedule.last.byMe, true);
  assert.equal(lawyerView.reschedule.last.recent, true);
  assert.equal(lawyerView.reschedule.last.responseReason, 'I work mornings');
  assert.equal(lawyerView.reschedule.acceptedCount, 0, 'declined requests do not use up reschedules');

  f.clock.advance(4 * DAY - 1); // still before the session? session is 11-25 14:00 → yes
  const later = (await f.as(LAWYER).getLawyerConsultationsAction()).find((c) => c.id === id);
  assert.equal(later.reschedule.last.recent, false, 'the declined notice stops showing after 3 days');
});

test('withdraw: only the requester; the other party cannot answer their own request', async () => {
  const f = fixture({ now: NOW });
  const id = f.seedConsultation({ start: ph('2026-11-25', 14) });
  assert.equal((await f.as(CLIENT).requestRescheduleAction(id, { date: '2026-11-27', startMinutes: 13 * 60, reason: 'Travel plans' })).success, true);

  assert.match((await f.as(CLIENT).respondToRescheduleAction(id, 'accept')).error, /You sent this request/);
  assert.match((await f.as(LAWYER).withdrawRescheduleAction(id)).error, /Only the person who sent/);
  assert.match((await f.as(LAWYER).requestRescheduleAction(id, { date: '2026-11-28', startMinutes: 9 * 60, reason: 'Counter proposal' })).error, /already proposed a new time/);
  assert.match((await f.as(CLIENT).requestRescheduleAction(id, { date: '2026-11-28', startMinutes: 9 * 60, reason: 'Second request' })).error, /already sent a reschedule request/);

  assert.equal((await f.as(CLIENT).withdrawRescheduleAction(id)).success, true);
  assert.equal(f.consultation(id).proposed_start, null);
  assert.equal(f.meta(id).rescheduleHistory.at(-1).status, 'withdrawn');
  assert.equal(f.notificationsOf(LAWYER, 'consultation_reschedule_withdrawn').length, 1);
  assert.match((await f.as(LAWYER).respondToRescheduleAction(id, 'accept')).error, /no reschedule request/);
});

test('request validation: status, reason, slot, notice period, horizon, same time, cutoff', async () => {
  const f = fixture({ now: NOW });
  const confirmed = f.seedConsultation({ start: ph('2026-11-25', 14) });
  const pending = f.seedConsultation({ status: 'pending', start: ph('2026-11-26', 14), paid: false });
  const soon = f.seedConsultation({ client: CLIENT, lawyer: LAWYER_2, start: new Date(Date.parse(NOW) + 50 * 60 * 1000).toISOString() });
  const req = (id, input, user = CLIENT) => f.as(user).requestRescheduleAction(id, { date: '2026-11-27', startMinutes: 600, reason: 'Valid reason', ...input });

  assert.match((await req(pending, {})).error, /Only confirmed appointments/);
  assert.match((await req(confirmed, { reason: 'no' })).error, /at least 5 characters/);
  assert.match((await req(confirmed, { reason: 'x'.repeat(501) })).error, /500 characters/);
  assert.match((await req(confirmed, { startMinutes: 11 * 60 + 30 })).error, /available time slots/);
  assert.match((await req(confirmed, { startMinutes: 12 * 60 })).error, /available time slots/, 'lunch hour is not a slot');
  assert.match((await req(confirmed, { date: '2026-02-30' })).error, /choose a new date/);
  assert.match((await req(confirmed, { date: '27-11-2026' })).error, /choose a new date/);
  assert.match((await req(confirmed, { date: '2026-11-21', startMinutes: 11 * 60 })).error, /available time slots/);
  assert.match((await req(confirmed, { date: '2026-11-21', startMinutes: 10 * 60 })).error, /at least 2 hours from now/);
  assert.match((await req(confirmed, { date: '2027-01-25' })).error, /within the next 60 days/);
  assert.match((await req(confirmed, { date: '2026-11-25', startMinutes: 14 * 60 })).error, /current schedule/);
  assert.match((await req(soon, {})).error, /until 1 hour before/);
  assert.match((await req(confirmed, {}, CLIENT_2)).error, /Consultation not found/, 'outsiders cannot touch it');
  assert.match((await req(confirmed, {}, LAWYER_2)).error, /Consultation not found/);
  assert.match((await f.as(CLIENT).requestRescheduleAction('not-a-uuid', { date: '2026-11-27', startMinutes: 600, reason: 'Valid' })).error, /not found/);
  assert.equal(f.consultation(confirmed).proposed_start, null);
  assert.equal(f.state.tables.notifications.length, 0);
});

test('conflicts: lawyer booking, client booking, lawyer unavailability (slot and all-day)', async () => {
  const f = fixture({ now: NOW });
  const id = f.seedConsultation({ start: ph('2026-11-25', 14) });
  f.seedConsultation({ client: CLIENT_2, lawyer: LAWYER, status: 'pending', start: ph('2026-11-27', 10), paid: false });
  f.seedConsultation({ client: CLIENT, lawyer: LAWYER_2, start: ph('2026-11-27', 13) });
  f.state.tables.lawyer_unavailability.push(
    { id: uuid(), lawyer_id: LAWYER, unavailable_date: '2026-11-27', start_minutes: 15 * 60, end_minutes: 17 * 60 },
    { id: uuid(), lawyer_id: LAWYER, unavailable_date: '2026-11-30', start_minutes: null, end_minutes: null }
  );
  const req = (date, startMinutes) => f.as(CLIENT).requestRescheduleAction(id, { date, startMinutes, reason: 'Need to move it' });

  assert.match((await req('2026-11-27', 10 * 60)).error, /attorney already has a consultation/);
  assert.match((await req('2026-11-27', 13 * 60)).error, /client already has another consultation/);
  assert.match((await req('2026-11-27', 16 * 60)).error, /attorney is unavailable during/);
  assert.match((await req('2026-11-30', 9 * 60)).error, /unavailable on that date/);
  // Cancelled bookings don't block.
  f.state.tables.consultations.find((c) => c.client_id === CLIENT_2).status = 'cancelled';
  assert.equal((await req('2026-11-27', 10 * 60)).success, true);
});

test('options: slot states (current / booked / unavailable / too soon) and fully blocked days', async () => {
  const f = fixture({ now: NOW });
  const id = f.seedConsultation({ start: ph('2026-11-25', 14) });
  f.seedConsultation({ client: CLIENT_2, lawyer: LAWYER, start: ph('2026-11-25', 9) });
  f.state.tables.lawyer_unavailability.push(
    { id: uuid(), lawyer_id: LAWYER, unavailable_date: '2026-11-25', start_minutes: 16 * 60, end_minutes: 17 * 60 },
    { id: uuid(), lawyer_id: LAWYER, unavailable_date: '2026-11-28', start_minutes: null, end_minutes: null },
    { id: uuid(), lawyer_id: LAWYER, unavailable_date: '2026-12-02', start_minutes: null, end_minutes: null }
  );
  const res = await f.as(LAWYER).getRescheduleOptionsAction(id, '2026-11-25');
  assert.equal(res.success, true, res.error);
  const states = Object.fromEntries(res.options.slots.map((s) => [s.startMinutes / 60, s.state]));
  assert.deepEqual(states, { 9: 'booked', 10: 'available', 13: 'available', 14: 'current', 15: 'available', 16: 'unavailable' });
  assert.deepEqual([...res.options.blockedDays], [28]);
  assert.equal(res.options.minDate, '2026-11-21');
  assert.equal(res.options.maxDate, '2027-01-20');
  assert.equal(res.options.durationMinutes, 60);

  const today = await f.as(CLIENT).getRescheduleOptionsAction(id, '2026-11-21'); // 10:00 now → before 12:00 is too soon
  assert.deepEqual([...today.options.slots.map((s) => s.state)], ['past', 'past', 'available', 'available', 'available', 'available']);
  const outside = await f.as(CLIENT).getRescheduleOptionsAction(id, '2027-02-01');
  assert.ok(outside.options.slots.every((s) => s.state === 'past'));
  assert.match((await f.as(CLIENT_2).getRescheduleOptionsAction(id, '2026-11-25')).error, /not found/);
  assert.match((await f.as(CLIENT).getRescheduleOptionsAction(id, '2026-13-01')).error, /valid date/);
});

test('accepting re-checks the calendar: a slot taken meanwhile cannot be accepted', async () => {
  const f = fixture({ now: NOW });
  const id = f.seedConsultation({ start: ph('2026-11-25', 14) });
  assert.equal((await f.as(CLIENT).requestRescheduleAction(id, { date: '2026-11-27', startMinutes: 10 * 60, reason: 'Hearing that day' })).success, true);
  f.seedConsultation({ client: CLIENT_2, lawyer: LAWYER, status: 'pending', start: ph('2026-11-27', 10), paid: false });

  const res = await f.as(LAWYER).respondToRescheduleAction(id, 'accept');
  assert.match(res.error, /can no longer be accepted/);
  assert.equal(f.consultation(id).scheduled_start, ph('2026-11-25', 14));
  assert.ok(f.consultation(id).proposed_start, 'request stays open so it can be declined');
  assert.equal((await f.as(LAWYER).respondToRescheduleAction(id, 'decline')).success, true);
});

test('a request lapses when its time gets too close; answering it then reports expiry', async () => {
  const f = fixture({ now: NOW });
  const id = f.seedConsultation({ start: ph('2026-11-25', 14) });
  assert.equal((await f.as(CLIENT).requestRescheduleAction(id, { date: '2026-11-22', startMinutes: 10 * 60, reason: 'Earlier please' })).success, true);
  f.clock.set(ph('2026-11-22', 9, 45)); // 15 minutes before the proposed time

  const view = (await f.as(LAWYER).getLawyerConsultationsAction()).find((c) => c.id === id);
  assert.equal(view.reschedule.pending, null);
  assert.equal(view.reschedule.last.status, 'expired');
  assert.equal(view.reschedule.canRequest, true);

  assert.match((await f.as(LAWYER).respondToRescheduleAction(id, 'accept')).error, /expired/);
  assert.equal(f.consultation(id).proposed_start, null, 'expired request is cleared');
  assert.equal(f.consultation(id).scheduled_start, ph('2026-11-25', 14));
  // A new request can be made right away.
  assert.equal((await f.as(CLIENT).requestRescheduleAction(id, { date: '2026-11-26', startMinutes: 15 * 60, reason: 'Another day' })).success, true);
});

test('at most 2 accepted reschedules per booking', async () => {
  const f = fixture({ now: NOW });
  const id = f.seedConsultation({ start: ph('2026-11-25', 14) });
  for (const [date, hour] of [['2026-11-26', 9], ['2026-11-27', 13]]) {
    assert.equal((await f.as(CLIENT).requestRescheduleAction(id, { date, startMinutes: hour * 60, reason: 'Moving again' })).success, true);
    assert.equal((await f.as(LAWYER).respondToRescheduleAction(id, 'accept')).success, true);
  }
  const view = (await f.as(CLIENT).getClientConsultationsAction()).find((c) => c.id === id);
  assert.equal(view.reschedule.remaining, 0);
  assert.equal(view.reschedule.canRequest, false);
  assert.match(view.reschedule.blockedReason, /already been rescheduled 2 times/);
  assert.match((await f.as(LAWYER).requestRescheduleAction(id, { date: '2026-11-30', startMinutes: 9 * 60, reason: 'Third time' })).error, /rescheduled 2 times/);
});

test('simultaneous requests from both sides: only one is stored', async () => {
  const f = fixture({ now: NOW });
  const id = f.seedConsultation({ start: ph('2026-11-25', 14) });
  const [a, b] = await Promise.all([
    f.as(CLIENT).requestRescheduleAction(id, { date: '2026-11-27', startMinutes: 9 * 60, reason: 'Client asks' }),
    (async () => { await new Promise((r) => setImmediate(r)); return f.as(LAWYER).requestRescheduleAction(id, { date: '2026-11-28', startMinutes: 9 * 60, reason: 'Lawyer asks' }); })(),
  ]);
  const succeeded = [a, b].filter((r) => r.success).length;
  assert.equal(succeeded, 1, JSON.stringify([a, b]));
  assert.equal(f.state.tables.notifications.filter((n) => n.type === 'consultation_reschedule_requested').length, 1);
});

test('cancelling or non-confirmed bookings hide reschedule info; meeting reminder re-arms after a move', async () => {
  const f = fixture({ now: NOW });
  const id = f.seedConsultation({ start: ph('2026-11-21', 13) });
  // Reminder for the original time already sent.
  f.state.tables.notifications.push({ id: uuid(), user_id: CLIENT, type: 'meeting_starting', title: 't', body: 'b', data: {}, channel: 'in_app', is_read: true,
    metadata: { consultationId: id, scheduledStart: ph('2026-11-21', 13) }, created_at: new f.clock.Date().toISOString() });
  assert.equal((await f.as(CLIENT).requestRescheduleAction(id, { date: '2026-11-21', startMinutes: 15 * 60, reason: 'Later today' })).success, true);
  assert.equal((await f.as(LAWYER).respondToRescheduleAction(id, 'accept')).success, true);
  f.clock.set(ph('2026-11-21', 14, 50));
  await f.as(CLIENT).getUserNotificationsAction('client');
  const reminders = f.notificationsOf(CLIENT, 'meeting_starting');
  assert.equal(reminders.length, 2, 'a new reminder for the new time');
  assert.equal(new Date(reminders[1].metadata.scheduledStart).toISOString(), ph('2026-11-21', 15));

  // A paid booking can't be cancelled by the client directly (it needs the attorney's approval).
  assert.notEqual((await f.as(CLIENT).cancelConsultationAction(id)).success, true);
  assert.equal((await f.as(LAWYER).lawyerCancelConsultationAction(id, 'Emergency court hearing')).success, true);
  const cancelled = f.state.tables.consultations.find((c) => c.id === id);
  assert.equal(cancelled.status, 'cancelled');
  const lawyerView = (await f.as(LAWYER).getLawyerConsultationsAction()).find((c) => c.id === id);
  assert.equal(lawyerView.reschedule, null);
});

// ═════════════════════════════════════════════════════════════════════════════
// REPORTS — submitting from Messages
// ═════════════════════════════════════════════════════════════════════════════

function reportForm({ threadId = LAWYER, reasonKey = 'harassment', details = 'He insulted me repeatedly in our messages.', files = [], includeConversation = true } = {}) {
  const fd = new FormData();
  fd.set('threadId', threadId);
  fd.set('reasonKey', reasonKey);
  fd.set('details', details);
  fd.set('includeConversation', includeConversation ? 'true' : 'false');
  files.forEach((file) => fd.append('files', file));
  return fd;
}
// Real file headers: uploads are checked against their extension by content.
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = (name = 'shot.png', bytes = 10) => {
  const data = new Uint8Array(Math.max(bytes, PNG_HEADER.length));
  data.set(PNG_HEADER);
  return new File([data], name, { type: 'image/png' });
};
const pdf = (name) => new File([new TextEncoder().encode('%PDF-1.4 test')], name, { type: 'application/pdf' });

function withConversation(f) {
  const id = f.seedConsultation({ start: ph('2026-11-25', 14) });
  f.state.tables.messages.push(
    { id: uuid(), conversation_or_thread_id: id, sender_id: LAWYER, role: 'user', content: 'You are useless.', attachment_ids: [], citations: null, sent_at: '2026-11-20T01:00:00.000Z' },
    { id: uuid(), conversation_or_thread_id: id, sender_id: CLIENT, role: 'user', content: 'Please be respectful.', attachment_ids: [], citations: null, sent_at: '2026-11-20T01:05:00.000Z' },
    { id: uuid(), conversation_or_thread_id: id, sender_id: LAWYER, role: 'system', content: 'Payment confirmed.', attachment_ids: [], citations: null, sent_at: '2026-11-20T01:10:00.000Z' }
  );
  return id;
}

test('client reports a lawyer with files and the conversation', async () => {
  const f = fixture({ now: NOW });
  withConversation(f);
  const res = await f.as(CLIENT).submitAccountReportAction(reportForm({ files: [png('chat 1.png'), pdf('receipt.pdf')] }));
  assert.equal(res.success, true, res.error);
  assert.equal(res.targetName, 'Atty. Test Lawyer');

  const [row] = f.state.tables.reports;
  assert.equal(row.id, res.reportId);
  assert.equal(row.reporter_id, CLIENT);
  assert.equal(row.target_type, 'lawyer');
  assert.equal(row.target_id, LAWYER);
  assert.equal(row.category, 'misconduct');
  assert.equal(row.status, 'open');
  assert.equal(row.reason, 'Harassment or abusive language\nHe insulted me repeatedly in our messages.');
  assert.deepEqual([...row.evidence_paths], [
    `report-evidence/${row.id}/1-chat_1.png`,
    `report-evidence/${row.id}/2-receipt.pdf`,
    `report-evidence/${row.id}/conversation.json`,
  ]);
  const transcript = JSON.parse(f.state.storage.get(`report-evidence/${row.id}/conversation.json`).toString());
  assert.deepEqual([...transcript.messages.map((m) => m.from)], ['reported', 'reporter', 'system']);
  assert.equal(f.notificationsOf(CLIENT, 'report_submitted').length, 1);
  assert.equal(f.notificationsOf(LAWYER).length, 0, 'the reported user is not told');
  assert.ok(f.state.tables.audit_log.some((a) => a.action === 'report.submitted' && a.target_id === row.id));
  assert.deepEqual(f.errors(), []);
});

test('lawyer reports a client (older account without a profiles row) without the conversation', async () => {
  const f = fixture({ now: NOW });
  f.state.tables.profiles.push({ user_id: CLIENT_2, email: 'second@test.ph', full_name: 'Second Client', role: 'client', account_status: 'active' });
  const id = f.seedConsultation({ client: CLIENT_2, start: ph('2026-11-25', 14) });
  f.state.tables.profiles = f.state.tables.profiles.filter((p) => p.user_id !== CLIENT_2);
  const res = await f.as(LAWYER).submitAccountReportAction(reportForm({ threadId: id, reasonKey: 'fee_dispute', details: 'Client filed a fake chargeback after the session.', includeConversation: false }));
  assert.equal(res.success, true, res.error);
  const [row] = f.state.tables.reports;
  assert.equal(row.target_type, 'user');
  assert.equal(row.target_id, CLIENT_2, 'consultation id deep links resolve to the other participant');
  assert.equal(row.category, 'fee_dispute');
  assert.deepEqual([...row.evidence_paths], []);
});

test('report validation and abuse limits', async () => {
  const f = fixture({ now: NOW });
  withConversation(f);
  const submit = (opts, user = CLIENT) => f.as(user).submitAccountReportAction(reportForm(opts));

  assert.match((await submit({ reasonKey: 'nonsense' })).error, /choose what the problem is/);
  assert.match((await submit({ details: 'too short' })).error, /at least 20 characters/);
  assert.match((await submit({ details: 'x'.repeat(2001) })).error, /2000 characters/);
  assert.match((await submit({ files: [png('virus.exe')] })).error, /not supported/);
  assert.match((await submit({ files: [png('big.png', 5 * 1024 * 1024 + 1)] })).error, /larger than 5 MB/);
  assert.match((await submit({ files: Array.from({ length: 6 }, (_, i) => png(`${i}.png`)) })).error, /up to 5 files/);
  assert.match((await submit({ files: [png('a.png', 4.5 * 1024 * 1024), png('b.png', 4.5 * 1024 * 1024)] })).error, /8 MB or less in total/);
  assert.match((await submit({ threadId: LAWYER_2 })).error, /only report someone you have had a consultation with/);
  assert.match((await submit({ threadId: CLIENT })).error, /only report someone/, 'not yourself');
  assert.match((await submit({ threadId: 'garbage' })).error, /only report someone/);
  f.state.userId = null;
  assert.match((await f.as(null).submitAccountReportAction(reportForm())).error, /session has expired/);
  assert.equal(f.state.tables.reports.length, 0);
  assert.equal(f.state.storage.size, 0);

  assert.equal((await submit({})).success, true);
  assert.match((await submit({})).error, /already have a report about Atty. Test Lawyer under review/);
});

test('daily report limit (5 per 24 hours)', async () => {
  const f = fixture({ now: NOW });
  const lawyers = Array.from({ length: 6 }, (_, i) => `44444444-4444-4444-8444-00000000000${i}`);
  for (const [i, id] of lawyers.entries()) {
    f.state.tables.user_accounts.push({ id, email: `l${i}@t.ph`, full_name: `Atty ${i}`, role: 'lawyer' });
    f.state.tables.profiles.push({ user_id: id, email: `l${i}@t.ph`, full_name: `Atty ${i}`, role: 'lawyer', account_status: 'active' });
    f.state.tables.lawyer_profiles.push({ user_id: id, full_name: `Atty ${i}` });
    f.seedConsultation({ lawyer: id, start: ph('2026-11-25', 9 + i), paid: false, status: 'completed' });
  }
  for (const id of lawyers.slice(0, 5)) assert.equal((await f.as(CLIENT).submitAccountReportAction(reportForm({ threadId: id }))).success, true);
  assert.match((await f.as(CLIENT).submitAccountReportAction(reportForm({ threadId: lawyers[5] }))).error, /daily limit/);
  f.clock.advance(DAY + 1000);
  assert.equal((await f.as(CLIENT).submitAccountReportAction(reportForm({ threadId: lawyers[5] }))).success, true);
});

test('admins cannot be reported; failed uploads or inserts leave nothing behind', async () => {
  const f = fixture({ now: NOW });
  withConversation(f);
  f.state.tables.user_accounts.find((a) => a.id === LAWYER).role = 'admin';
  assert.match((await f.as(CLIENT).submitAccountReportAction(reportForm())).error, /cannot be reported/);
  f.state.tables.user_accounts.find((a) => a.id === LAWYER).role = 'lawyer';

  f.state.failUpload = (path) => path.endsWith('conversation.json');
  const res = await f.as(CLIENT).submitAccountReportAction(reportForm({ files: [png()] }));
  assert.match(res.error, /could not send your report/);
  assert.equal(f.state.tables.reports.length, 0);
  assert.equal(f.state.storage.size, 0, 'the screenshot uploaded before the failure was removed');

  f.state.failUpload = null;
  f.state.failWrites = ({ table, op }) => (table === 'reports' && op === 'insert' ? { code: '500', message: 'db down' } : null);
  assert.match((await f.as(CLIENT).submitAccountReportAction(reportForm({ files: [png()] }))).error, /could not send your report/);
  assert.equal(f.state.storage.size, 0);
});

// ═════════════════════════════════════════════════════════════════════════════
// REPORTS — admin review and the 3-suspension rule
// ═════════════════════════════════════════════════════════════════════════════

async function fileReport(f, { reporter = CLIENT, target = LAWYER, details } = {}) {
  if (!f.state.tables.consultations.some((c) => (c.client_id === reporter && c.lawyer_id === target) || (c.client_id === target && c.lawyer_id === reporter))) {
    f.seedConsultation({ client: reporter, lawyer: target, start: ph('2026-11-20', 9), status: 'completed', paid: false });
  }
  const res = await f.as(reporter).submitAccountReportAction(reportForm({ threadId: target, details }));
  assert.equal(res.success, true, res.error);
  return res.reportId;
}

test('admin list shows people, reason, proof and account standing; non-admins are refused', async () => {
  const f = fixture({ now: NOW });
  withConversation(f);
  const reportId = await fileReport(f);
  const list = await f.as(ADMIN).getAdminReportsData();
  assert.equal(list.length, 1);
  const item = list[0];
  assert.equal(item.reasonLabel, 'Harassment or abusive language');
  assert.equal(item.details, 'He insulted me repeatedly in our messages.');
  assert.deepEqual({ ...item.reporter }, { id: CLIENT, name: 'Clyde Client', email: 'client@test.ph', role: 'client' });
  assert.equal(item.target.name, 'Atty. Test Lawyer');
  assert.equal(item.target.role, 'lawyer');
  assert.equal(item.target.accountStatus, 'active');
  assert.equal(item.target.suspensionCount, 0);
  assert.equal(item.target.openReportCount, 1);
  assert.deepEqual([...item.evidence.map((e) => e.kind)], ['conversation']);

  const evidence = await f.as(ADMIN).getAdminReportEvidenceAction(reportId);
  assert.equal(evidence.success, true);
  assert.equal(evidence.evidence.conversation.length, 3);
  assert.equal(evidence.evidence.conversation[0].content, 'You are useless.');

  await assert.rejects(() => f.as(CLIENT).getAdminReportsData(), /Unable to load reports/);
  assert.match((await f.as(LAWYER).moderateReportAction(reportId, 'dismiss', { notes: 'trying to dismiss my own report' })).error, /Administrator access required|could not be saved/);
  assert.match((await f.as(CLIENT).getAdminReportEvidenceAction(reportId)).error, /could not be loaded/);
  assert.equal(f.state.tables.reports[0].status, 'open');
});

test('suspension: account banned + marked suspended, lawyer hidden, sessions blocked, consultations in the window cancelled', async () => {
  const f = fixture({ now: NOW });
  const inWindow = f.seedConsultation({ client: CLIENT_2, start: ph('2026-11-24', 10) }); // paid, inside 7 days
  const later = f.seedConsultation({ client: CLIENT, start: ph('2026-12-05', 10) }); // after the suspension
  const reportId = await fileReport(f);

  const res = await f.as(ADMIN).moderateReportAction(reportId, 'suspend', { days: 7, notes: 'Abusive language toward a client.' });
  assert.equal(res.success, true, res.error);
  assert.equal(res.outcome, 'suspended');
  assert.equal(res.escalated, false);
  assert.equal(res.suspendedUntil, new Date(Date.parse(NOW) + 7 * DAY).toISOString());

  assert.equal(f.profile(LAWYER).account_status, 'suspended');
  assert.deepEqual(f.state.banCalls, [{ id: LAWYER, ban_duration: '168h' }]);
  assert.equal(f.state.tables.lawyer_profiles.find((l) => l.user_id === LAWYER).is_visible, false);
  const report = f.state.tables.reports[0];
  assert.equal(report.status, 'resolved');
  assert.equal(report.assigned_admin_id, ADMIN);
  assert.match(report.resolution_notes, /Suspension 1 of 3: 7 days/);
  assert.deepEqual(f.state.tables.moderation_actions.map((m) => m.action), ['suspension']);

  const cancelled = f.consultation(inWindow);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancelled_by, ADMIN);
  assert.equal(JSON.parse(cancelled.concern_summary).refundStatus, 'pending');
  assert.equal(f.state.tables.payments.find((p) => p.consultation_id === inWindow).status, 'refunded');
  assert.equal(f.consultation(later).status, 'confirmed', 'bookings after the suspension stay');
  assert.ok(f.notificationsOf(CLIENT_2, 'consultation_cancelled')[0].body.includes('suspended'));

  assert.equal(f.notificationsOf(LAWYER, 'account_suspended').length, 1);
  assert.match(f.state.emails[0].subject, /suspended/);
  assert.match(f.state.emails[0].html, /Abusive language toward a client\./);
  assert.match(f.notificationsOf(CLIENT, 'report_resolved')[0].body, /took action/);
  assert.ok(f.state.tables.audit_log.some((a) => a.action === 'account.suspended' && a.details.lawyerWasVisible === true));

  // Defence in depth: even with a session, server actions refuse the suspended account.
  f.state.bans.delete(LAWYER); // pretend the ban had not propagated
  f.state.bans.set(LAWYER, new Date(Date.parse(NOW) + 7 * DAY).toISOString());
  assert.equal((await f.as(LAWYER).getLawyerConsultationsAction()).length, 0);
  // And nobody can book the suspended lawyer.
  const book = await f.as(CLIENT).bookConsultationAction({
    lawyerId: LAWYER, dateStr: 'December 10, 2026', timeSlot: '9:00 AM - 10:00 AM • PST, GMT+8', communicationMode: 'video', subject: 'Help', description: '', documentIds: [],
  });
  assert.match(book.error, /not accepting new consultations/);
  assert.deepEqual(f.errors(), []);
});

test('suspension ends by itself: status back to active and listing restored on next contact', async () => {
  const f = fixture({ now: NOW });
  const reportId = await fileReport(f);
  assert.equal((await f.as(ADMIN).moderateReportAction(reportId, 'suspend', { days: 3, notes: 'First warning by suspension.' })).success, true);

  f.clock.advance(3 * DAY + 60 * 1000);
  f.state.bans.delete(LAWYER); // Supabase lifts the ban at banned_until
  const list = await f.as(LAWYER).getLawyerConsultationsAction();
  assert.ok(Array.isArray(list));
  assert.equal(f.profile(LAWYER).account_status, 'active');
  assert.equal(f.state.tables.lawyer_profiles.find((l) => l.user_id === LAWYER).is_visible, true);
  assert.equal(f.notificationsOf(LAWYER, 'account_reinstated').length, 1);
  // Reinstating twice is harmless.
  await f.as(LAWYER).getLawyerConsultationsAction();
  assert.equal(f.notificationsOf(LAWYER, 'account_reinstated').length, 1);
  // The offense stays on record.
  const [item] = await f.as(ADMIN).getAdminReportsData();
  assert.equal(item.target.suspensionCount, 1);
  assert.equal(item.target.accountStatus, 'active');
});

test('a lawyer hidden before the suspension stays hidden afterwards', async () => {
  const f = fixture({ now: NOW });
  f.state.tables.lawyer_profiles.find((l) => l.user_id === LAWYER).is_visible = false;
  const reportId = await fileReport(f);
  assert.equal((await f.as(ADMIN).moderateReportAction(reportId, 'suspend', { days: 3, notes: 'Suspension for misconduct.' })).success, true);
  f.clock.advance(4 * DAY);
  f.state.bans.delete(LAWYER);
  await f.as(LAWYER).getLawyerConsultationsAction();
  assert.equal(f.profile(LAWYER).account_status, 'active');
  assert.equal(f.state.tables.lawyer_profiles.find((l) => l.user_id === LAWYER).is_visible, false);
});

test('offense checklist: 3 suspensions, then the 4th upheld report terminates the account', async () => {
  const f = fixture({ now: NOW });
  const reporters = [CLIENT, CLIENT_2];
  f.state.tables.profiles.push({ user_id: CLIENT_2, email: 'second@test.ph', full_name: 'Second Client', role: 'client', account_status: 'active' });
  for (let i = 0; i < 3; i++) {
    const reportId = await fileReport(f, { reporter: reporters[i % 2], details: `Offense number ${i + 1} described in detail.` });
    const res = await f.as(ADMIN).moderateReportAction(reportId, 'suspend', { days: 3, notes: `Suspension number ${i + 1}.` });
    assert.equal(res.outcome, 'suspended', res.error);
    assert.match(f.state.tables.reports.find((r) => r.id === reportId).resolution_notes, new RegExp(`Suspension ${i + 1} of 3`));
    f.clock.advance(4 * DAY);
    f.state.bans.delete(LAWYER);
  }
  const [latest] = await f.as(ADMIN).getAdminReportsData();
  assert.equal(latest.target.suspensionCount, 3);

  const future = f.seedConsultation({ client: CLIENT, start: ph('2027-01-05', 10) });
  const fourth = await fileReport(f, { reporter: CLIENT, details: 'Fourth offense, still abusive in chat.' });
  const pendingOther = await fileReport(f, { reporter: CLIENT_2, details: 'Another report waiting for review.' });

  const res = await f.as(ADMIN).moderateReportAction(fourth, 'suspend', { days: 7, notes: 'Abusive again after three suspensions.' });
  assert.equal(res.success, true, res.error);
  assert.equal(res.outcome, 'terminated');
  assert.equal(res.escalated, true);
  assert.equal(f.profile(LAWYER).account_status, 'terminated');
  assert.equal(f.state.banCalls.at(-1).ban_duration, '876000h');
  assert.equal(f.state.tables.lawyer_profiles.find((l) => l.user_id === LAWYER).is_available, false);
  assert.equal(f.consultation(future).status, 'cancelled', 'all future consultations cancelled');
  assert.match(f.state.tables.reports.find((r) => r.id === fourth).resolution_notes, /Offense 4: suspension limit of 3 reached — account terminated/);
  const other = f.state.tables.reports.find((r) => r.id === pendingOther);
  assert.equal(other.status, 'resolved', 'other open reports are closed');
  assert.match(other.resolution_notes, /account was terminated/);
  assert.equal(f.notificationsOf(CLIENT_2, 'report_resolved').length, 1 + 1, 'both reporters hear back');
  assert.deepEqual(f.state.tables.moderation_actions.map((m) => m.action), ['suspension', 'suspension', 'suspension', 'termination']);
  assert.match(f.state.emails.at(-1).subject, /terminated/);

  // Nothing more can be done to a terminated account except dismissing.
  const fifth = await (async () => {
    f.state.bans.delete(LAWYER);
    f.state.tables.reports.push({ id: crypto.randomUUID(), reporter_id: CLIENT, target_type: 'lawyer', target_id: LAWYER, category: 'misconduct', reason: 'Other\nlate report', evidence_paths: [], status: 'open', created_at: new f.clock.Date().toISOString(), updated_at: new f.clock.Date().toISOString() });
    return f.state.tables.reports.at(-1).id;
  })();
  assert.match((await f.as(ADMIN).moderateReportAction(fifth, 'suspend', { days: 3, notes: 'Trying to suspend again.' })).error, /already terminated/);
  assert.equal(f.state.tables.reports.at(-1).status, 'open', 'claim released');
  assert.equal((await f.as(ADMIN).moderateReportAction(fifth, 'dismiss', { notes: 'Account already terminated.' })).outcome, 'dismissed');
});

test('direct termination and dismissal', async () => {
  const f = fixture({ now: NOW });
  const r1 = await fileReport(f);
  const dismissed = await f.as(ADMIN).moderateReportAction(r1, 'dismiss', { notes: 'Messages do not show a violation.' });
  assert.equal(dismissed.outcome, 'dismissed');
  assert.equal(f.state.tables.reports[0].status, 'dismissed');
  assert.equal(f.profile(LAWYER).account_status, 'active');
  assert.equal(f.state.banCalls.length, 0);
  assert.deepEqual(f.state.tables.moderation_actions.map((m) => m.action), ['no_action']);
  assert.match(f.notificationsOf(CLIENT, 'report_resolved')[0].body, /did not find a violation/);
  assert.match((await f.as(ADMIN).moderateReportAction(r1, 'suspend', { days: 3, notes: 'Changing my mind now.' })).error, /already been resolved/);

  const r2 = await fileReport(f, { details: 'Asked me to pay outside the platform.' });
  const terminated = await f.as(ADMIN).moderateReportAction(r2, 'terminate', { notes: 'Fraudulent payment request.' });
  assert.equal(terminated.outcome, 'terminated');
  assert.equal(terminated.escalated, false);
  assert.equal(f.profile(LAWYER).account_status, 'terminated');
});

test('decision validation and protections', async () => {
  const f = fixture({ now: NOW });
  const reportId = await fileReport(f);
  const decide = (decision, opts, admin = ADMIN) => f.as(admin).moderateReportAction(reportId, decision, opts);
  assert.match((await decide('suspend', { days: 7, notes: 'short' })).error, /at least 10 characters/);
  assert.match((await decide('suspend', { days: 5, notes: 'Long enough reason here.' })).error, /suspension length/);
  assert.match((await decide('ban', { notes: 'Long enough reason here.' })).error, /Choose an action/);
  assert.match((await f.as(ADMIN).moderateReportAction('nope', 'dismiss', { notes: 'Long enough reason here.' })).error, /not found/);

  // Admin accounts can't be actioned through reports.
  const adminReport = crypto.randomUUID();
  f.state.tables.reports.push({ id: adminReport, reporter_id: CLIENT, target_type: 'user', target_id: ADMIN_2, category: 'other', reason: 'Other\nx', evidence_paths: [], status: 'open', created_at: NOW, updated_at: NOW });
  assert.match((await f.as(ADMIN).moderateReportAction(adminReport, 'suspend', { days: 3, notes: 'Suspend the admin please.' })).error, /Administrator accounts cannot/);
  const selfReport = crypto.randomUUID();
  f.state.tables.reports.push({ id: selfReport, reporter_id: CLIENT, target_type: 'user', target_id: ADMIN, category: 'other', reason: 'Other\nx', evidence_paths: [], status: 'open', created_at: NOW, updated_at: NOW });
  assert.match((await f.as(ADMIN).moderateReportAction(selfReport, 'dismiss', { notes: 'Dismissing my own report.' })).error, /your own account/);
  assert.equal(f.state.tables.moderation_actions.length, 0);
});

test('if the Auth ban fails, nothing is recorded and the report goes back to open', async () => {
  const f = fixture({ now: NOW });
  const reportId = await fileReport(f);
  f.state.failBan = () => true;
  const res = await f.as(ADMIN).moderateReportAction(reportId, 'suspend', { days: 7, notes: 'Abusive language toward a client.' });
  assert.match(res.error, /Could not suspend the sign-in/);
  assert.equal(f.state.tables.reports[0].status, 'open');
  assert.equal(f.profile(LAWYER).account_status, 'active');
  assert.equal(f.state.tables.moderation_actions.length, 0);
  f.state.failBan = null;
  assert.equal((await f.as(ADMIN).moderateReportAction(reportId, 'suspend', { days: 7, notes: 'Abusive language toward a client.' })).success, true);
});

test('two admins deciding at once: one decision wins', async () => {
  const f = fixture({ now: NOW });
  const reportId = await fileReport(f);
  const [a, b] = await Promise.all([
    f.as(ADMIN).moderateReportAction(reportId, 'suspend', { days: 7, notes: 'Suspend for abusive language.' }),
    f.as(ADMIN_2).moderateReportAction(reportId, 'dismiss', { notes: 'Dismiss, not a violation.' }),
  ]);
  const ok = [a, b].filter((r) => r.success);
  assert.equal(ok.length, 1, JSON.stringify([a, b]));
  assert.match([a, b].find((r) => !r.success).error, /already being decided|already been resolved/);
  assert.equal(f.state.tables.moderation_actions.length, 1);
});

test('a stale claim (interrupted decision) can be picked up after 2 minutes', async () => {
  const f = fixture({ now: NOW });
  const reportId = await fileReport(f);
  Object.assign(f.state.tables.reports[0], { status: 'under_review', assigned_admin_id: ADMIN_2, updated_at: new f.clock.Date().toISOString() });
  assert.match((await f.as(ADMIN).moderateReportAction(reportId, 'dismiss', { notes: 'Not a violation at all.' })).error, /already being decided/);
  f.clock.advance(3 * 60 * 1000);
  assert.equal((await f.as(ADMIN).moderateReportAction(reportId, 'dismiss', { notes: 'Not a violation at all.' })).success, true);
});

test('suspending an already-suspended account extends from the current end', async () => {
  const f = fixture({ now: NOW });
  const r1 = await fileReport(f);
  f.state.tables.profiles.push({ user_id: CLIENT_2, email: 'second@test.ph', full_name: 'Second Client', role: 'client', account_status: 'active' });
  const r2 = await fileReport(f, { reporter: CLIENT_2 });
  const first = await f.as(ADMIN).moderateReportAction(r1, 'suspend', { days: 7, notes: 'First upheld report.' });
  const second = await f.as(ADMIN).moderateReportAction(r2, 'suspend', { days: 3, notes: 'Second upheld report.' });
  assert.equal(second.success, true, second.error);
  assert.equal(new Date(second.suspendedUntil).getTime() - new Date(first.suspendedUntil).getTime(), 3 * DAY);
  const [item] = await f.as(ADMIN).getAdminReportsData();
  assert.equal(item.target.suspensionCount, 2);
  assert.equal(item.target.suspendedUntil, second.suspendedUntil);
});

// ═════════════════════════════════════════════════════════════════════════════
// SIGN-IN for suspended / terminated accounts
// ═════════════════════════════════════════════════════════════════════════════

function signInForm(email = 'atty@test.ph') {
  const fd = new FormData();
  fd.set('email', email);
  fd.set('password', 'secret-password');
  return fd;
}

test('sign-in explains a suspension or termination', async () => {
  const f = fixture({ now: NOW });
  const reportId = await fileReport(f);
  await f.as(ADMIN).moderateReportAction(reportId, 'suspend', { days: 7, notes: 'Abusive language toward a client.' });
  f.state.signIn = () => ({ data: { user: null, session: null }, error: { code: 'user_banned', message: 'User is banned' } });
  const suspended = await f.auth.signInAction(null, signInForm());
  assert.match(suspended.error, /suspended until November 28, 2026 at 10:00 AM \(PHT\)/);

  f.profile(LAWYER).account_status = 'terminated';
  const terminated = await f.auth.signInAction(null, signInForm());
  assert.match(terminated.error, /permanently terminated/);

  const unknown = await f.auth.signInAction(null, signInForm('nobody@test.ph'));
  assert.match(unknown.error, /currently suspended/);
});

test('sign-in after the suspension ended reactivates the account; a blocked status signs out', async () => {
  const f = fixture({ now: NOW });
  const reportId = await fileReport(f);
  await f.as(ADMIN).moderateReportAction(reportId, 'suspend', { days: 3, notes: 'Abusive language toward a client.' });
  f.clock.advance(3 * DAY + 1000);
  f.state.bans.delete(LAWYER);
  f.state.signIn = () => ({ data: { user: { id: LAWYER, user_metadata: {} }, session: {} }, error: null });
  await assert.rejects(() => f.auth.signInAction(null, signInForm()), (err) => err.url === '/lawyer/dashboard');
  assert.equal(f.profile(LAWYER).account_status, 'active');

  f.profile(LAWYER).account_status = 'terminated'; // e.g. the ban was lifted by hand by mistake
  const res = await f.auth.signInAction(null, signInForm());
  assert.match(res.error, /permanently terminated/);
  assert.equal(f.state.signedOut, true);
});

test('the same admin double-submitting a decision only applies it once', async () => {
  const f = fixture({ now: NOW });
  const reportId = await fileReport(f);
  const [a, b] = await Promise.all([
    f.as(ADMIN).moderateReportAction(reportId, 'suspend', { days: 7, notes: 'Suspend for abusive language.' }),
    f.as(ADMIN).moderateReportAction(reportId, 'suspend', { days: 7, notes: 'Suspend for abusive language.' }),
  ]);
  assert.equal([a, b].filter((r) => r.success).length, 1, JSON.stringify([a, b]));
  assert.equal(f.state.tables.moderation_actions.length, 1);
  assert.equal(f.state.banCalls.length, 1);
});

test('a database error is reported as a retryable failure, not as a concurrent change', async () => {
  const f = fixture({ now: NOW });
  const id = f.seedConsultation({ start: ph('2026-11-25', 14) });
  f.state.failWrites = ({ table, op }) => (table === 'consultations' && op === 'update' ? { message: 'TypeError: fetch failed' } : null);
  const res = await f.as(CLIENT).requestRescheduleAction(id, { date: '2026-11-27', startMinutes: 600, reason: 'Network test' });
  assert.match(res.error, /could not be sent\. Please try again/);
  assert.equal(f.notificationsOf(LAWYER).length, 0);
});
