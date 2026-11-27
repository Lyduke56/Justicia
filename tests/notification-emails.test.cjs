// Email notifications (src/lib/email/notificationEmails.ts, src/lib/account/preferences.ts) and
// the Gemini key fallback (src/lib/ai/geminiKeys.ts).
// Run: node --test tests/notification-emails.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadReal } = require('./support/extraModules.cjs');

const prefs = loadReal('src/lib/account/preferences.ts');
const emails = loadReal('src/lib/email/notificationEmails.ts', { '@/lib/account/preferences': prefs });
const layout = loadReal('src/lib/email/layout.ts');
const keys = loadReal('src/lib/ai/geminiKeys.ts');

const APP = 'https://justicia.ph';
const build = (over) =>
  emails.buildNotificationEmail({ type: 'x', title: 'T', body: 'B', payload: {}, role: 'client', recipientName: 'Juan Dela Cruz', appUrl: APP, ...over });

// ─── Preferences ──────────────────────────────────────────────────────────────

test('email updates are on by default and follow the category switches', () => {
  const p = prefs.accountPreferences({});
  assert.equal(p.emailUpdates, true);
  assert.equal(prefs.wantsEmailFor(p, 'consultation_request'), true);
  assert.equal(prefs.wantsEmailFor(p, 'report_resolved'), true);

  const paymentsOff = prefs.accountPreferences({ justicia_preferences: { notifications: { payments: false } } });
  assert.equal(prefs.wantsEmailFor(paymentsOff, 'payment_confirmed'), false);
  assert.equal(prefs.wantsEmailFor(paymentsOff, 'consultation_approved'), true);
});

test('turning email updates off stops everything except account and verification notices', () => {
  const off = prefs.accountPreferences({ justicia_preferences: { emailUpdates: false } });
  assert.equal(off.emailUpdates, false);
  for (const type of ['consultation_request', 'payment_submitted', 'meeting_starting', 'reminder_1h', 'new_message', 'report_submitted']) {
    assert.equal(prefs.wantsEmailFor(off, type), false, type);
  }
  for (const type of ['account_suspended', 'account_reinstated', 'lawyer_verification_approved', 'lawyer_verification_revoked']) {
    assert.equal(prefs.wantsEmailFor(off, type), true, type);
  }
  // Stored back as-is next to the other preferences.
  const stored = prefs.preferencesToMetadata({ notifications: off.notifications, messaging: off.messaging, emailUpdates: false });
  assert.equal(stored.emailUpdates, false);
  assert.equal(prefs.accountPreferences({ justicia_preferences: stored }).emailUpdates, false);
});

// ─── Email content ────────────────────────────────────────────────────────────

test('message emails never include the message text', () => {
  const e = build({
    type: 'new_message',
    title: 'New message from Atty. Maria Santos',
    body: 'Here are the details of your annulment case…',
    payload: { threadId: 'lawyer-1' },
  });
  const html = layout.renderEmailHtml(e.content);
  assert.equal(html.includes('annulment'), false);
  assert.equal(layout.renderEmailText(e.content).includes('annulment'), false);
  assert.equal(e.subject, 'New message from Atty. Maria Santos');
  assert.equal(e.content.action.url, `${APP}/client/messages?thread=lawyer-1`);
});

test('confirmed-payment and starting-soon emails point to Messages, not the raw Meet link', () => {
  const confirmed = build({
    type: 'payment_confirmed',
    title: 'Payment Confirmed — Consultation Confirmed',
    body: 'Atty. Maria Santos confirmed your payment. Your consultation on Dec 1 (9:00 AM) is confirmed. Join via Google Meet: https://meet.google.com/abc-defg-hij',
  });
  assert.equal(JSON.stringify(confirmed.content).includes('meet.google.com'), false);
  assert.match(confirmed.content.paragraphs[0], /is confirmed\.$/);

  const soon = build({
    type: 'meeting_starting',
    role: 'lawyer',
    recipientName: 'Maria Santos',
    title: 'Consultation starting soon',
    body: 'Your video consultation with Juan starts in 12 minutes (9:00 AM - 10:00 AM). Open Messages to join the meeting.',
    payload: { consultationId: 'c1', threadId: 'client-1', meetingUrl: 'https://meet.google.com/x' },
  });
  assert.match(soon.subject, /starting soon/i);
  assert.equal(soon.content.greeting, 'Dear Atty. Maria Santos,');
  assert.equal(soon.content.action.url, `${APP}/lawyer/messages?thread=client-1`);
  assert.equal(JSON.stringify(soon.content).includes('meet.google.com'), false);
});

test('decline reasons move into a callout and links match the reader role', () => {
  const declined = build({
    type: 'consultation_declined',
    title: 'Consultation Request Declined',
    body: 'Atty. Maria Santos declined your consultation request for Dec 1 (9:00 AM). Reason: Conflict of interest',
    payload: { reason: 'Conflict of interest' },
  });
  assert.equal(declined.content.paragraphs[0], 'Atty. Maria Santos declined your consultation request for Dec 1 (9:00 AM).');
  assert.deepEqual({ ...declined.content.callout }, { tone: 'error', title: 'Reason', body: 'Conflict of interest' });

  const cancelledForLawyer = build({ type: 'consultation_cancelled', role: 'lawyer', title: 'Consultation Cancelled by Client' });
  assert.equal(cancelledForLawyer.content.action.url, `${APP}/lawyer/consultations`);
  const request = build({ type: 'consultation_request', role: 'lawyer', title: 'New Consultation Request' });
  assert.equal(request.subject, 'New consultation request');
  assert.equal(request.content.action.url, `${APP}/lawyer/consultations`);
});

test('subjects drop leading symbols, and footers say why the email was sent', () => {
  const approved = build({ type: 'lawyer_verification_needs_resubmission', role: 'lawyer', title: '📋 Additional Information Required' });
  assert.equal(approved.subject, 'Action needed on your lawyer verification');
  assert.match(approved.content.footerNote, /account notice/);
  const fallback = build({ type: 'report_resolved', title: '✓ Update on your report' });
  assert.equal(fallback.subject, 'Update on your report');
  assert.match(fallback.content.footerNote, /client\/settings/);
});

test('names and bodies are escaped in the rendered email', () => {
  const e = build({ recipientName: '<script>x</script>', body: 'Hello <b>there</b>' });
  const html = layout.renderEmailHtml(e.content);
  assert.equal(html.includes('<script>x'), false);
  assert.equal(html.includes('&lt;b&gt;there'), true);
});

// ─── Gemini key fallback ──────────────────────────────────────────────────────

const err = (status, message = `status ${status}`) => Object.assign(new Error(message), { status });
const noSleep = async () => {};

test('keys are read in order, without blanks or duplicates', () => {
  const list = keys.geminiApiKeys({ GEMINI_API_KEY: ' a ', GEMINI_API_KEY_2: '', GEMINI_API_KEY_3: 'a', GEMINI_API_KEY_4: 'd' });
  assert.deepEqual([...list.map((k) => `${k.name}=${k.value}`)], ['GEMINI_API_KEY=a', 'GEMINI_API_KEY_4=d']);
});

test('errors are classified so only key problems switch keys', () => {
  assert.equal(keys.classifyGeminiError(err(429)), 'rate_limited');
  assert.equal(keys.classifyGeminiError(err(400, 'API key not valid. Please pass a valid API key.')), 'rejected');
  assert.equal(keys.classifyGeminiError(err(403)), 'rejected');
  assert.equal(keys.classifyGeminiError(err(503, 'The model is overloaded')), 'transient');
  assert.equal(keys.classifyGeminiError(new Error('fetch failed')), 'transient');
  assert.equal(keys.classifyGeminiError(err(400, 'Invalid argument')), 'fatal');
});

test('a quota error moves to the next key, and that key is skipped on the next request', async () => {
  keys.resetGeminiKeyState();
  const list = keys.geminiApiKeys({ GEMINI_API_KEY: 'k1', GEMINI_API_KEY_2: 'k2', GEMINI_API_KEY_3: 'k3' });
  let clock = 1_000;
  const now = () => clock;
  const tried = [];
  const answer = await keys.withGeminiKeys(async (key) => {
    tried.push(key);
    if (key === 'k1') throw err(429);
    return `ok:${key}`;
  }, { keys: list, now, sleep: noSleep });
  assert.equal(answer, 'ok:k2');
  assert.deepEqual(tried, ['k1', 'k2']);

  tried.length = 0;
  await keys.withGeminiKeys(async (key) => { tried.push(key); return key; }, { keys: list, now, sleep: noSleep });
  assert.deepEqual(tried, ['k2'], 'k1 sits out after its quota error');

  clock += keys.RATE_LIMIT_COOLDOWN_MS + 1;
  tried.length = 0;
  await keys.withGeminiKeys(async (key) => { tried.push(key); return key; }, { keys: list, now, sleep: noSleep });
  assert.deepEqual(tried, ['k1'], 'k1 is back first after the cool-down');
});

test('a busy model is retried before switching; request errors and total failure throw', async () => {
  keys.resetGeminiKeyState();
  const list = keys.geminiApiKeys({ GEMINI_API_KEY: 'k1', GEMINI_API_KEY_2: 'k2' });
  const tried = [];
  const pauses = [];
  const answer = await keys.withGeminiKeys(async (key) => {
    tried.push(key);
    if (key === 'k1') throw err(503);
    return 'ok';
  }, { keys: list, sleep: async (ms) => { pauses.push(ms); } });
  assert.equal(answer, 'ok');
  assert.deepEqual(tried, ['k1', 'k1', 'k1', 'k2']);
  assert.deepEqual(pauses, [1500, 3000]);

  keys.resetGeminiKeyState();
  tried.length = 0;
  await assert.rejects(
    keys.withGeminiKeys(async (key) => { tried.push(key); throw err(400, 'Invalid argument'); }, { keys: list, sleep: noSleep }),
    /Invalid argument/
  );
  assert.deepEqual(tried, ['k1'], 'a bad request is not repeated on other keys');

  keys.resetGeminiKeyState();
  await assert.rejects(
    keys.withGeminiKeys(async (key) => { throw err(429, `quota ${key}`); }, { keys: list, sleep: noSleep }),
    /quota k2/
  );
});
