// Backend audit work: authorization guards, lawyer verification rules and documents, account
// deletion, email uniqueness, rate limits, file checks, notification and messaging preferences.
// Server modules are compiled from src/ and run against an in-memory database double.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const { createFakeDb } = require('./support/fakeDb.cjs');

const ADMIN = '00000000-0000-4000-8000-000000000001';
const LAWYER = '00000000-0000-4000-8000-000000000002';
const CLIENT = '00000000-0000-4000-8000-000000000003';
const OTHER = '00000000-0000-4000-8000-000000000004';
const DAY = 86_400_000;

function makeLoader(overrides) {
  const cache = new Map();
  function resolve(spec) {
    const base = path.join('src', spec.slice(2));
    for (const cand of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) if (fs.existsSync(cand)) return cand;
    throw new Error(`cannot resolve ${spec}`);
  }
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    vm.runInNewContext(source, {
      exports,
      require: req,
      process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'http://supabase.test', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon' } },
      console: { log() {}, info() {}, warn() {}, error() {} },
      Buffer, URL, File, FormData, Blob, Headers, Response, TextEncoder, setTimeout, AbortSignal, Date,
    });
    return exports;
  }
  function req(name) {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name === 'node:crypto' || name === 'crypto') return crypto;
    if (name.startsWith('@/')) return load(resolve(name));
    throw new Error(`unexpected import ${name}`);
  }
  return (spec) => load(spec.startsWith('@/') ? resolve(spec) : spec);
}

/** A sandbox with a fake database and a signed-in user (or none). */
function sandbox({ seed = {}, user = null, authUsers = [], verifierOk = true, dbOptions = {} } = {}) {
  const db = createFakeDb(seed, { authUsers, ...dbOptions });
  const signals = [];
  const emails = [];
  const authClient = {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      signOut: async () => ({ error: null }),
      refreshSession: async () => ({}),
      updateUser: async () => ({ error: null }),
      signUp: async () => ({ data: { user: null }, error: null }),
    },
  };
  const load = makeLoader({
    'next/cache': { revalidatePath() {} },
    'next/server': { after: (fn) => fn(), NextResponse: { json: (d, i) => Response.json(d, i) } },
    'next/headers': { headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set() {}, delete() {} }) },
    'next/navigation': { redirect: (url) => { const e = new Error('NEXT_REDIRECT'); e.url = url; throw e; } },
    react: { cache: (fn) => fn },
    '@/lib/supabase/server': { createClient: async () => authClient, createServiceClient: async () => db },
    '@supabase/supabase-js': {
      createClient: () => ({
        auth: {
          signInWithPassword: async () => (verifierOk ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'Invalid login' } }),
          signOut: async () => ({}),
        },
      }),
    },
    '@/lib/realtime/live': { emitLive: async (ids, scopes) => { signals.push({ ids, scopes }); }, liveTopicFor: () => 'topic' },
    '@/lib/integrations/email': { sendEmail: async (m) => { emails.push(m); return { sent: true }; } },
    '@/lib/security/rateLimit': { checkRateLimit: async () => null, clientIp: async () => '127.0.0.1' },
  });
  return { db, load, signals, emails, authClient };
}

const userObj = (id, extra = {}) => ({ id, email: `${id.slice(-4)}@example.com`, email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z', ...extra });

const people = () => ({
  user_accounts: [
    { id: ADMIN, email: 'admin@example.com', role: 'admin' },
    { id: LAWYER, email: 'lawyer@example.com', role: 'lawyer' },
    { id: CLIENT, email: 'client@example.com', role: 'client' },
    { id: OTHER, email: 'other@example.com', role: 'client' },
  ],
  profiles: [
    { user_id: ADMIN, email: 'admin@example.com', role: 'admin', account_status: 'active' },
    { user_id: LAWYER, email: 'lawyer@example.com', role: 'lawyer', account_status: 'active' },
    { user_id: CLIENT, email: 'client@example.com', role: 'client', account_status: 'active' },
    { user_id: OTHER, email: 'other@example.com', role: 'client', account_status: 'active' },
  ],
});

const doc = (type, status = 'under_review', extra = {}) => ({
  id: crypto.randomUUID(), lawyer_id: LAWYER, doc_type: type, storage_path: `${LAWYER}/v1/${type}.pdf`, uploaded_at: '2026-11-20T00:00:00Z',
  original_filename: `${type}.pdf`, mime_type: 'application/pdf', size_bytes: 1000, checksum_sha256: type, submission_version: 1,
  review_status: status, review_note: null, reviewed_at: null, superseded_at: null, ...extra,
});
const allDocs = (status = 'under_review') => ['bar_admission', 'ibp_membership', 'government_id'].map((t) => doc(t, status));

// ─── Pure rules ──────────────────────────────────────────────────────────────

test('verification status rules: approved applications only get post-approval actions', () => {
  const { load } = sandbox();
  const v = load('@/lib/lawyer/verification');
  assert.deepEqual([...v.allowedReviewDecisions('pending')].sort(), ['approved', 'needs_resubmission', 'rejected']);
  assert.deepEqual([...v.allowedReviewDecisions('needs_resubmission')], ['rejected']);
  for (const s of ['approved', 'rejected', 'draft']) assert.equal(v.allowedReviewDecisions(s).length, 0, s);
  assert.deepEqual([...v.allowedPostApprovalActions('approved')].sort(), ['reverify', 'revoke']);
  assert.equal(v.allowedPostApprovalActions('pending').length, 0);
  assert.equal(v.applicantCanEdit('pending'), false);
  assert.equal(v.applicantCanEdit('approved'), false);
  assert.equal(v.applicantCanEdit('needs_resubmission'), true);
  assert.match(v.documentGapMessage([{ docType: 'bar_admission', reviewStatus: 'rejected' }]), /IBP membership.*Government-issued ID.*replace the rejected Proof of bar admission/);
  assert.equal(v.documentGapMessage(allDocs().map((d) => ({ docType: d.doc_type, reviewStatus: d.review_status }))), '');
});

test('uploads are checked by content, not by name', () => {
  const { load } = sandbox();
  const f = load('@/lib/security/fileType');
  const pdf = new TextEncoder().encode('%PDF-1.7\n...');
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
  assert.equal(f.contentMatchesExtension(pdf, 'pdf'), true);
  assert.equal(f.contentMatchesExtension(png, 'png'), true);
  assert.equal(f.contentMatchesExtension(png, 'pdf'), false, 'renamed image');
  assert.equal(f.contentMatchesExtension(exe, 'pdf'), false, 'program renamed to .pdf');
  assert.equal(f.contentMatchesExtension(new TextEncoder().encode('a,b\n1,2\n'), 'csv'), true);
  assert.equal(f.contentMatchesExtension(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), 'docx'), true);
  assert.equal(f.contentMatchesExtension(pdf, 'exe'), false, 'unknown extension');
});

test('notification categories keep the old single switch working', () => {
  const { load } = sandbox();
  const p = load('@/lib/account/preferences');
  const legacyOff = p.accountPreferences({ justicia_preferences: { consultationNotifications: false } });
  assert.deepEqual({ ...legacyOff.notifications }, { consultations: false, payments: false, messages: true, reminders: false });
  const fresh = p.accountPreferences({});
  assert.deepEqual({ ...fresh.notifications }, { consultations: true, payments: true, messages: true, reminders: true });
  assert.deepEqual({ ...fresh.messaging }, { hideTyping: false, hideReadReceipts: false });
  assert.equal(p.notificationCategory('consultation_approved'), 'consultations');
  assert.equal(p.notificationCategory('payment_confirmed'), 'payments');
  assert.equal(p.notificationCategory('new_message'), 'messages');
  assert.equal(p.notificationCategory('reminder_1h'), 'reminders');
  assert.equal(p.notificationCategory('account_suspended'), null, 'account notices are always delivered');
});

test('server-written role claims ignore anything that is not a real role', () => {
  const { load } = sandbox();
  const r = load('@/lib/auth/roles');
  assert.equal(r.roleFromAppMetadata({ app_metadata: { role: 'admin' } }), 'admin');
  assert.equal(r.roleFromAppMetadata({ app_metadata: { role: 'superuser' } }), null);
  assert.equal(r.roleFromAppMetadata({ app_metadata: {}, user_metadata: { role: 'admin' } }), null);
  assert.equal(r.statusFromAppMetadata({ app_metadata: { account_status: 'pending_deletion' } }), 'pending_deletion');
});

test('the logger never writes sensitive values', () => {
  const { load } = sandbox();
  const { redact } = load('@/lib/log');
  const out = redact({ consultationId: 'c1', password: 'secret', message: 'private text', nested: { token: 't', ok: 1 } });
  assert.equal(out.consultationId, 'c1');
  assert.equal(out.password, '[redacted]');
  assert.equal(out.message, '[redacted]');
  assert.equal(out.nested.token, '[redacted]');
  assert.equal(out.nested.ok, 1);
});

// ─── One account per email ───────────────────────────────────────────────────

test('an email used by any account, in any letter case, cannot register again', async () => {
  const { db, load } = sandbox({ seed: { ...people(), user_accounts: [...people().user_accounts, { id: 'x', email: 'a_b@example.com', role: 'client' }] } });
  const email = load('@/lib/auth/email');
  assert.equal(await email.emailRegistrationStatus(db, 'ADMIN@Example.com'), 'in_use', 'admin email');
  assert.equal(await email.emailRegistrationStatus(db, 'lawyer@example.com '), 'in_use', 'lawyer email');
  assert.equal(await email.emailRegistrationStatus(db, 'a_b@example.com'), 'in_use');
  assert.equal(await email.emailRegistrationStatus(db, 'axb@example.com'), 'available', '"_" only matches itself');
  assert.equal(await email.emailRegistrationStatus(db, 'new@example.com'), 'available');
  db.tables.blocked_emails = [{ email_hash: email.emailHash('Banned@Example.com'), reason: 'deleted_after_moderation' }];
  assert.equal(await email.emailRegistrationStatus(db, 'banned@example.com'), 'blocked');
  assert.equal(email.isObfuscatedExistingUser({ identities: [] }), true);
  assert.equal(email.isObfuscatedExistingUser({ identities: [{}] }), false);
});

test('sign-up refuses a used email, an obfuscated existing user and a missing consent', async () => {
  const s = sandbox({ seed: people() });
  const auth = s.load('@/app/actions/auth');
  const form = (email, extra = {}) => {
    const fd = new FormData();
    fd.set('full_name', 'Juan Dela Cruz');
    fd.set('email', email);
    fd.set('password', 'longpassword');
    fd.set('role', 'client');
    if (extra.terms !== false) fd.set('accept_terms', 'yes');
    return fd;
  };
  const used = await auth.signUpAction(null, form('Client@Example.com'));
  assert.equal(used.field, 'email');
  assert.match(used.error, /already registered/);
  const noTerms = await auth.signUpAction(null, form('fresh@example.com', { terms: false }));
  assert.match(noTerms.error, /agree to the Terms/);
  // Supabase answered with a fake user (no identities): treated as already registered.
  s.authClient.auth.signUp = async () => ({ data: { user: { id: 'fake', identities: [] } }, error: null });
  const obfuscated = await auth.signUpAction(null, form('fresh@example.com'));
  assert.match(obfuscated.error, /already registered/);
  assert.equal(s.db.writes.filter((w) => w.table === 'user_accounts').length, 0, 'nothing written for refused sign-ups');
});

// ─── Guards ──────────────────────────────────────────────────────────────────

test('guards: signed out 401, suspended 423, wrong role 403, admin ok', async () => {
  const signedOut = sandbox({ seed: people() });
  await assert.rejects(signedOut.load('@/lib/auth/guards').requireRole('admin'), (e) => e.status === 401);

  const seed = people();
  seed.profiles.find((p) => p.user_id === CLIENT).account_status = 'terminated';
  const terminated = sandbox({ seed, user: userObj(CLIENT) });
  await assert.rejects(terminated.load('@/lib/auth/guards').requireActiveAccount(), (e) => e.status === 423);

  const client = sandbox({ seed: people(), user: userObj(CLIENT, { user_metadata: { role: 'admin' } }) });
  await assert.rejects(client.load('@/lib/auth/guards').requireRole('admin'), (e) => e.status === 403, 'user_metadata role is ignored');

  const admin = sandbox({ seed: people(), user: userObj(ADMIN) });
  const ctx = await admin.load('@/lib/auth/guards').requireRole('admin');
  assert.equal(ctx.role, 'admin');
});

// ─── Lawyer verification ─────────────────────────────────────────────────────

function verificationSeed(status, docs = []) {
  return {
    ...people(),
    lawyer_profiles: [{ user_id: LAWYER, full_name: 'Atty. Test', roll_number: '12345', verification_status: status, is_visible: status === 'approved', is_available: true }],
    lawyer_verification_documents: docs,
    audit_log: [],
    notifications: [],
  };
}

test('an approved lawyer cannot be rejected or sent back through the review actions', async () => {
  const s = sandbox({ seed: verificationSeed('approved', allDocs('accepted')), user: userObj(ADMIN), authUsers: [userObj(LAWYER)] });
  const review = s.load('@/app/actions/adminLawyerReview');
  for (const decision of ['rejected', 'needs_resubmission', 'approved']) {
    const res = await review.reviewLawyerApplicationAction(LAWYER, decision, 'A sufficiently long reason');
    assert.ok(res.error, decision);
  }
  assert.equal(s.db.tables.lawyer_profiles[0].verification_status, 'approved');
  assert.equal(s.db.writes.filter((w) => w.table === 'lawyer_profiles').length, 0);
});

test('non-admins cannot review applications', async () => {
  const s = sandbox({ seed: verificationSeed('pending', allDocs()), user: userObj(CLIENT) });
  const res = await s.load('@/app/actions/adminLawyerReview').reviewLawyerApplicationAction(LAWYER, 'approved');
  assert.match(res.error, /Administrator/);
  assert.equal(s.db.tables.lawyer_profiles[0].verification_status, 'pending');
});

test('approval needs the required documents or a recorded exception', async () => {
  const missing = sandbox({ seed: verificationSeed('pending', [doc('bar_admission')]), user: userObj(ADMIN), authUsers: [userObj(LAWYER)] });
  const review = missing.load('@/app/actions/adminLawyerReview');
  const refused = await review.reviewLawyerApplicationAction(LAWYER, 'approved');
  assert.match(refused.error, /IBP membership missing.*Government-issued ID missing/);
  assert.equal(missing.db.tables.lawyer_profiles[0].verification_status, 'pending');

  const withException = await review.reviewLawyerApplicationAction(LAWYER, 'approved', '', { exceptionReason: 'Confirmed with the IBP chapter office by phone.' });
  assert.equal(withException.success, true);
  const audit = missing.db.tables.audit_log.find((a) => a.action === 'lawyer.verification.approved');
  assert.match(audit.details.document_exception, /IBP chapter/);
  assert.equal(audit.details.previous_status, 'pending');

  const complete = sandbox({ seed: verificationSeed('pending', allDocs()), user: userObj(ADMIN), authUsers: [userObj(LAWYER)] });
  const ok = await complete.load('@/app/actions/adminLawyerReview').reviewLawyerApplicationAction(LAWYER, 'approved');
  assert.equal(ok.success, true);
  const lp = complete.db.tables.lawyer_profiles[0];
  assert.equal(lp.verification_status, 'approved');
  assert.equal(lp.is_visible, true);
  assert.ok(complete.db.tables.lawyer_verification_documents.every((d) => d.review_status === 'accepted'), 'approving accepts the documents');
  assert.equal(complete.db.tables.user_accounts.find((u) => u.id === LAWYER).verification_status, 'approved', 'a valid live enum value');
  assert.equal(complete.db.authUsers.get(LAWYER).app_metadata.role, 'lawyer');
});

test('a decision taken in another tab makes a stale request fail', async () => {
  const s = sandbox({ seed: verificationSeed('pending', allDocs()), user: userObj(ADMIN), authUsers: [userObj(LAWYER)] });
  const review = s.load('@/app/actions/adminLawyerReview');
  // Simulate another admin approving between this admin's read and write.
  const realFrom = s.db.from;
  let reads = 0;
  s.db.from = (table) => {
    const q = realFrom(table);
    if (table !== 'lawyer_profiles') return q;
    const origMaybe = q.maybeSingle;
    q.maybeSingle = async () => {
      const res = await origMaybe();
      if (++reads === 1) s.db.tables.lawyer_profiles[0].verification_status = 'approved';
      return res;
    };
    return q;
  };
  const res = await review.reviewLawyerApplicationAction(LAWYER, 'rejected', 'Credentials do not match');
  assert.match(res.error, /changed since you opened it/);
  assert.equal(s.db.tables.lawyer_profiles[0].verification_status, 'approved');
});

test('post-approval: revoke and re-verification are separate, audited, and hide the listing', async () => {
  const s = sandbox({ seed: verificationSeed('approved', allDocs('accepted')), user: userObj(ADMIN), authUsers: [userObj(LAWYER)] });
  const review = s.load('@/app/actions/adminLawyerReview');
  assert.ok((await review.postApprovalLawyerAction(LAWYER, 'revoke', 'short')).error, 'needs a real reason');
  const res = await review.postApprovalLawyerAction(LAWYER, 'reverify', 'Your IBP ID has expired; please upload a current one.');
  assert.equal(res.success, true);
  const lp = s.db.tables.lawyer_profiles[0];
  assert.equal(lp.verification_status, 'needs_resubmission');
  assert.equal(lp.is_visible, false);
  assert.ok(s.db.tables.audit_log.some((a) => a.action === 'lawyer.verification.reverification_requested'));
  assert.ok((await review.postApprovalLawyerAction(LAWYER, 'revoke', 'Credentials no longer valid at all')).error, 'only from approved');
});

test('lawyer registration: admins cannot apply, review locks the application, documents are required', async () => {
  const fields = () => {
    const fd = new FormData();
    fd.set('full_name', 'Atty. Test');
    fd.set('roll_number', '12345');
    return fd;
  };
  const admin = sandbox({ seed: verificationSeed('draft'), user: userObj(ADMIN) });
  assert.match((await admin.load('@/app/actions/lawyerRegistration').saveLawyerDraftAction(null, fields())).error, /Administrator accounts cannot apply/);

  const pending = sandbox({ seed: verificationSeed('pending', allDocs()), user: userObj(LAWYER), authUsers: [userObj(LAWYER)] });
  assert.match((await pending.load('@/app/actions/lawyerRegistration').saveLawyerDraftAction(null, fields())).error, /under review/);

  const approved = sandbox({ seed: verificationSeed('approved', allDocs('accepted')), user: userObj(LAWYER), authUsers: [userObj(LAWYER)] });
  assert.ok((await approved.load('@/app/actions/lawyerRegistration').submitLawyerApplicationAction(null, fields())).error);
  assert.equal(approved.db.tables.lawyer_profiles[0].verification_status, 'approved');

  const noDocs = sandbox({ seed: verificationSeed('draft', [doc('bar_admission', 'uploaded')]), user: userObj(LAWYER), authUsers: [userObj(LAWYER)] });
  const refused = await noDocs.load('@/app/actions/lawyerRegistration').submitLawyerApplicationAction(null, fields());
  assert.match(refused.error, /upload IBP membership, Government-issued ID/);
  assert.equal(noDocs.db.tables.lawyer_profiles[0].verification_status, 'draft');

  const ready = sandbox({ seed: verificationSeed('draft', allDocs('uploaded')), user: userObj(LAWYER), authUsers: [userObj(LAWYER)] });
  const submitted = await ready.load('@/app/actions/lawyerRegistration').submitLawyerApplicationAction(null, fields());
  assert.equal(submitted.success, 'Application submitted.');
  assert.equal(ready.db.tables.lawyer_profiles[0].verification_status, 'pending');
  assert.ok(ready.db.tables.lawyer_verification_documents.every((d) => d.review_status === 'under_review'));
  assert.ok(ready.db.tables.audit_log.some((a) => a.action === 'lawyer.submitted'));
});

test('document upload: content checked, locked under review, submitted evidence kept on replace', async () => {
  const pdfFile = (name = 'proof.pdf') => new File([new TextEncoder().encode('%PDF-1.4 proof')], name, { type: 'application/pdf' });
  const form = (type, file) => { const fd = new FormData(); fd.set('docType', type); fd.set('file', file); return fd; };

  const pending = sandbox({ seed: verificationSeed('pending', allDocs()), user: userObj(LAWYER) });
  assert.match((await pending.load('@/app/actions/lawyerVerificationDocs').uploadVerificationDocumentAction(form('bar_admission', pdfFile()))).error, /under review/);

  const s = sandbox({ seed: verificationSeed('needs_resubmission', allDocs('rejected')), user: userObj(LAWYER) });
  const docs = s.load('@/app/actions/lawyerVerificationDocs');
  const fake = new File([new Uint8Array([0x4d, 0x5a, 0, 0])], 'id.pdf', { type: 'application/pdf' });
  assert.match((await docs.uploadVerificationDocumentAction(form('government_id', fake))).error, /contents don't match/);
  assert.match((await docs.uploadVerificationDocumentAction(form('passport', pdfFile()))).error, /Choose which document/);

  const res = await docs.uploadVerificationDocumentAction(form('government_id', pdfFile('new-id.pdf')));
  assert.equal(res.success, true);
  const rows = s.db.tables.lawyer_verification_documents.filter((d) => d.doc_type === 'government_id');
  assert.equal(rows.length, 2, 'the rejected (submitted) file is kept');
  assert.ok(rows.find((d) => d.original_filename === 'government_id.pdf').superseded_at, 'old version superseded');
  const fresh = rows.find((d) => d.original_filename === 'new-id.pdf');
  assert.equal(fresh.review_status, 'uploaded');
  assert.match(fresh.storage_path, new RegExp(`^${LAWYER}/v\\d+/[0-9a-f-]{36}\\.pdf$`), 'server-chosen path');
  assert.match(fresh.checksum_sha256, /^[0-9a-f]{64}$/);
});

test('admins open documents through short-lived links, and every opening is audited', async () => {
  const docs = allDocs();
  const s = sandbox({ seed: verificationSeed('pending', docs), user: userObj(ADMIN) });
  const actions = s.load('@/app/actions/lawyerVerificationDocs');
  const res = await actions.getAdminVerificationDocumentUrlAction(docs[0].id);
  assert.match(res.url, /^https:\/\/signed\.example\/lawyer-credentials\//);
  assert.ok(s.db.tables.audit_log.some((a) => a.action === 'lawyer.document.viewed' && a.details.document_id === docs[0].id));

  const client = sandbox({ seed: verificationSeed('pending', docs), user: userObj(CLIENT) });
  const denied = await client.load('@/app/actions/lawyerVerificationDocs').getAdminVerificationDocumentUrlAction(docs[0].id);
  assert.equal(denied.success, false);
  const listDenied = await client.load('@/app/actions/lawyerVerificationDocs').getAdminVerificationDocumentsAction(LAWYER);
  assert.equal(listDenied.success, false);
});

// ─── Account standing (admin) ────────────────────────────────────────────────

test('admin suspension and reinstatement: reason required, no self or admin targets, audited', async () => {
  const seed = { ...people(), consultations: [], audit_log: [], notifications: [], lawyer_profiles: [], reports: [], moderation_actions: [] };
  const s = sandbox({ seed, user: userObj(ADMIN), authUsers: [userObj(CLIENT), userObj(ADMIN)] });
  const a = s.load('@/app/actions/adminAccountActions');
  assert.match((await a.adminSuspendAccountAction({ userId: ADMIN, reason: 'Testing self suspension', length: 7 })).error, /own account/);
  assert.match((await a.adminSuspendAccountAction({ userId: CLIENT, reason: 'short', length: 7 })).error, /reason/);
  assert.match((await a.adminSuspendAccountAction({ userId: CLIENT, reason: 'Repeated harassment of lawyers', length: 5 })).error, /how long/);

  const res = await a.adminSuspendAccountAction({ userId: CLIENT, reason: 'Repeated harassment of lawyers', length: 7 });
  assert.equal(res.success, true);
  assert.equal(s.db.tables.profiles.find((p) => p.user_id === CLIENT).account_status, 'suspended');
  assert.match(s.db.authUsers.get(CLIENT).ban_duration, /^\d+h$/);
  const audit = s.db.tables.audit_log.find((x) => x.action === 'account.suspended');
  assert.equal(audit.actor_id, ADMIN);
  assert.equal(audit.details.source, 'admin');
  assert.equal(audit.details.reason, 'Repeated harassment of lawyers');
  assert.ok(s.signals.some((x) => x.scopes.includes('session')), 'open tabs are told to leave');

  const back = await a.adminReinstateAccountAction({ userId: CLIENT, reason: 'Appeal reviewed and accepted' });
  assert.equal(back.success, true);
  assert.equal(s.db.tables.profiles.find((p) => p.user_id === CLIENT).account_status, 'active');
  assert.equal(s.db.authUsers.get(CLIENT).ban_duration, 'none');
  assert.ok(s.db.tables.audit_log.some((x) => x.action === 'account.reinstated' && x.actor_id === ADMIN));
  const again = await a.adminReinstateAccountAction({ userId: CLIENT, reason: 'Appeal reviewed and accepted' });
  assert.match(again.message, /already active/, 'idempotent');

  const asClient = sandbox({ seed, user: userObj(CLIENT) });
  assert.equal((await asClient.load('@/app/actions/adminAccountActions').adminSuspendAccountAction({ userId: OTHER, reason: 'Not an admin trying', length: 7 })).success, false);
});

test('terminating an account requires the admin password', async () => {
  const seed = { ...people(), consultations: [], audit_log: [], notifications: [], lawyer_profiles: [], reports: [] };
  const wrong = sandbox({ seed, user: userObj(ADMIN), authUsers: [userObj(CLIENT)], verifierOk: false });
  const res = await wrong.load('@/app/actions/adminAccountActions').adminTerminateAccountAction({ userId: CLIENT, reason: 'Fraudulent payment requests', password: 'nope' });
  assert.match(res.error, /password is incorrect/);
  assert.equal(wrong.db.tables.profiles.find((p) => p.user_id === CLIENT).account_status, 'active');
});

// ─── Account deletion ────────────────────────────────────────────────────────

test('delete my account: password and DELETE required, blocked by upcoming consultations', async () => {
  const future = new Date(Date.now() + 3 * DAY).toISOString();
  const seed = { ...people(), consultations: [{ id: 'c1', client_id: CLIENT, lawyer_id: LAWYER, status: 'confirmed', scheduled_start: future, scheduled_end: future }], audit_log: [], data_requests: [], lawyer_profiles: [] };
  const s = sandbox({ seed, user: userObj(CLIENT), authUsers: [userObj(CLIENT)] });
  const p = s.load('@/app/actions/accountPrivacyActions');
  assert.match((await p.requestAccountDeletionAction({ password: 'pw', confirmation: 'delete' })).error, /Type DELETE/);
  assert.match((await p.requestAccountDeletionAction({ password: 'pw', confirmation: 'DELETE' })).error, /1 upcoming consultation/);
  s.db.tables.consultations[0].status = 'cancelled';
  const ok = await p.requestAccountDeletionAction({ password: 'pw', confirmation: 'DELETE' });
  assert.equal(ok.success, true);
  const profile = s.db.tables.profiles.find((x) => x.user_id === CLIENT);
  assert.equal(profile.account_status, 'pending_deletion');
  assert.ok(Math.abs(new Date(ok.dueAt).getTime() - (new Date(profile.deletion_requested_at).getTime() + 7 * DAY)) < 1000, '7-day window');
  assert.equal(s.db.authUsers.get(CLIENT).app_metadata.account_status, 'pending_deletion');
  assert.ok(s.db.tables.data_requests.some((d) => d.request_type === 'deletion' && d.status === 'open'));

  const wrongPassword = sandbox({ seed: { ...people(), consultations: [] }, user: userObj(OTHER), verifierOk: false });
  assert.match((await wrongPassword.load('@/app/actions/accountPrivacyActions').requestAccountDeletionAction({ password: 'x', confirmation: 'DELETE' })).error, /password is incorrect/);
});

test('restore works inside the 7-day window only', async () => {
  const seedAt = (ms) => ({
    ...people(),
    profiles: people().profiles.map((p) => (p.user_id === CLIENT ? { ...p, account_status: 'pending_deletion', deletion_requested_at: new Date(ms).toISOString() } : p)),
    audit_log: [], data_requests: [{ id: 'r1', user_id: CLIENT, request_type: 'deletion', status: 'open' }], lawyer_profiles: [],
  });
  const inside = sandbox({ seed: seedAt(Date.now() - 2 * DAY), user: userObj(CLIENT), authUsers: [userObj(CLIENT)] });
  const res = await inside.load('@/app/actions/accountPrivacyActions').restoreAccountAction();
  assert.equal(res.success, true);
  assert.equal(res.redirectTo, '/client/dashboard');
  assert.equal(inside.db.tables.profiles.find((p) => p.user_id === CLIENT).account_status, 'active');
  assert.equal(inside.db.tables.data_requests[0].status, 'rejected', 'withdrawn by the owner');

  const late = sandbox({ seed: seedAt(Date.now() - 8 * DAY), user: userObj(CLIENT), authUsers: [userObj(CLIENT)] });
  assert.equal((await late.load('@/app/actions/accountPrivacyActions').restoreAccountAction()).success, false);
});

test('purge: erases personal data, frees the email, but keeps suspended or terminated emails blocked', async () => {
  const seedFor = (moderated) => ({
    ...people(),
    profiles: people().profiles.map((p) => (p.user_id === CLIENT ? { ...p, full_name: 'Juan', phone: '0917', account_status: 'pending_deletion', deletion_requested_at: new Date(Date.now() - 8 * DAY).toISOString() } : p)),
    audit_log: moderated ? [{ id: 'a1', action: 'account.suspended', target_id: CLIENT, details: {} }] : [],
    data_requests: [{ id: 'r1', user_id: CLIENT, request_type: 'deletion', status: 'open' }],
    documents: [{ id: 'd1', owner_id: CLIENT, storage_path: `${CLIENT}/file.pdf` }],
    notifications: [{ id: 'n1', user_id: CLIENT }], reports: [], blocked_emails: [], conversations: [], lawyer_profiles: [],
  });
  for (const moderated of [false, true]) {
    const s = sandbox({ seed: seedFor(moderated), authUsers: [userObj(CLIENT, { email: 'client@example.com' })] });
    const { purgeDueAccounts } = s.load('@/lib/account/deletion');
    const result = await purgeDueAccounts(s.db);
    assert.deepEqual({ ...result }, { purged: 1, failed: 0 });
    const profile = s.db.tables.profiles.find((p) => p.user_id === CLIENT);
    assert.equal(profile.full_name, 'Deleted user');
    assert.equal(profile.phone, null);
    assert.match(profile.email, /^deleted-.*@deleted\.justicia\.invalid$/);
    assert.equal(profile.deletion_requested_at, null, 'not picked up again');
    assert.match(s.db.authUsers.get(CLIENT).email, /@deleted\.justicia\.invalid$/);
    assert.equal(s.db.tables.notifications.length, 0);
    assert.ok(s.db.storageLog.removed.includes(`case-documents/${CLIENT}/file.pdf`));
    assert.equal(s.db.tables.data_requests[0].status, 'completed');
    const email = s.load('@/lib/auth/email');
    const status = await email.emailRegistrationStatus(s.db, 'client@example.com');
    assert.equal(status, moderated ? 'blocked' : 'available', moderated ? 'suspended before: blocked forever' : 'email is free again');
    assert.deepEqual({ ...(await purgeDueAccounts(s.db)) }, { purged: 0, failed: 0 }, 'idempotent');
  }
});

// ─── Rate limits ─────────────────────────────────────────────────────────────

test('rate limits fall back to a per-instance counter until the SQL function exists', async () => {
  const load = makeLoader({
    'next/headers': { headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9' }) },
    '@/lib/supabase/server': { createServiceClient: async () => ({ rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.hit_rate_limit' } }) }) },
  });
  const { checkRateLimit, RATE_LIMITS } = load('@/lib/security/rateLimit');
  const limit = RATE_LIMITS.sign_in.subject.limit;
  for (let i = 0; i < limit; i++) assert.equal(await checkRateLimit('sign_in', 'someone@example.com'), null, `attempt ${i + 1}`);
  assert.match(await checkRateLimit('sign_in', 'someone@example.com'), /Too many attempts/);
  assert.equal(await checkRateLimit('sign_in', 'other@example.com'), null, 'per subject');
});

// ─── Notifications and messaging privacy ─────────────────────────────────────

test('bell: each category switch hides only its own notifications', async () => {
  const types = ['consultation_approved', 'payment_confirmed', 'new_message', 'meeting_starting', 'reminder_1h', 'account_suspended', 'lawyer_verification_approved'];
  const seed = { ...people(), notifications: types.map((type, i) => ({ id: `n${i}`, user_id: CLIENT, type, title: type, created_at: `2026-11-2${i}T00:00:00Z` })), consultations: [] };
  const prefs = { justicia_preferences: { notifications: { consultations: true, payments: false, messages: false, reminders: false } } };
  const s = sandbox({ seed, user: userObj(CLIENT, { user_metadata: prefs }) });
  const shown = (await s.load('@/app/actions/consultationActions').getUserNotificationsAction()).map((n) => n.type).sort();
  assert.deepEqual(shown, ['account_suspended', 'consultation_approved', 'lawyer_verification_approved']);
});

test('read receipts: hidden for viewers who hide their own', async () => {
  const s = sandbox({
    seed: { ...people(), messages: [{ id: 'm1', conversation_or_thread_id: 'c1', citations: { kind: 'dm-meta', v: 1, seenAt: '2026-11-25T01:00:00Z' } }] },
  });
  const server = s.load('@/lib/messaging/server');
  const visible = await server.loadThreadExtras(s.db, { consultationIds: ['c1'] }, CLIENT);
  assert.equal(visible.messages.m1.seenAt, '2026-11-25T01:00:00Z');
  const hidden = await server.loadThreadExtras(s.db, { consultationIds: ['c1'] }, CLIENT, { hideReadReceipts: true });
  assert.equal(hidden.messages.m1.seenAt, null);
});

test('profile completeness and the contact line lawyers see', () => {
  const { load } = sandbox();
  const x = load('@/lib/account/profileExtras');
  const empty = { avatarUrl: null, cityProvince: null, preferredLanguage: null, contactMethod: null, contactTime: null };
  const low = x.profileCompleteness({ fullName: 'Juan', phone: '', emailVerified: true, extras: empty });
  assert.equal(low.percent, 29);
  assert.ok(low.missing.includes('profile photo'));
  const full = x.profileCompleteness({ fullName: 'Juan', phone: '0917', emailVerified: true, extras: { avatarUrl: 'u', cityProvince: 'Cebu', preferredLanguage: 'Cebuano', contactMethod: 'email', contactTime: 'morning' } });
  assert.equal(full.percent, 100);
  assert.equal(x.contactPreferenceLine({ contactMethod: 'phone_call', contactTime: 'evening', preferredLanguage: 'Cebuano' }), 'Prefers phone call, evenings (5 pm – 9 pm), in Cebuano');
});
