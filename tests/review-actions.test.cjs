const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const clientId = '11111111-1111-4111-8111-111111111111';
const lawyerId = '22222222-2222-4222-8222-222222222222';
const consultationId = '33333333-3333-4333-8333-333333333333';
const input = { consultationId, rating: 4, comment: 'Helpful consultation.' };

// Exercise the actual server actions against a stateful Supabase test double.
// Live PostgreSQL/RLS verification is a separate deployment check.
function fixture({ signedIn = true, status = 'completed', owner = clientId, failInsert = false } = {}) {
  const state = { userId: signedIn ? clientId : null, reviews: [], queries: [] };
  const consultation = { id: consultationId, client_id: owner, lawyer_id: lawyerId, status };
  const db = { from(table) {
    const filters = []; let operation = 'select'; let payload;
    const query = {
      select() { return query; }, order() { return query; },
      in(key, values) { filters.push(row => values.includes(row[key])); return query; },
      eq(key, value) { filters.push(row => row[key] === value); return query; },
      not(key, _operator, value) { filters.push(row => row[key] !== value); return query; },
      insert(value) { operation = 'insert'; payload = value; return query; },
      update(value) { operation = 'update'; payload = value; return query; },
      maybeSingle() { return execute(true); },
      then(resolve, reject) { return execute(false).then(resolve, reject); },
    };
    async function execute(single) {
      state.queries.push({ table, operation });
      if (operation === 'insert') {
        if (failInsert) return { data: null, error: { code: '08006', message: 'Unavailable' } };
        if (state.reviews.some(r => r.consultation_id === payload.consultation_id)) return { data: null, error: { code: '23505' } };
        state.reviews.push({ is_hidden: false, ...payload, id: '44444444-4444-4444-8444-444444444444', created_at: '2026-11-09T00:00:00Z', client: { full_name: 'Real Client' } });
        return { data: null, error: null };
      }
      const rows = (table === 'consultations' ? [consultation] : table === 'user_accounts' ? [{ id: clientId, full_name: 'Real Client' }] : state.reviews).filter(r => filters.every(f => f(r)));
      if (operation === 'update') rows.forEach(r => Object.assign(r, payload));
      return { data: single ? rows[0] || null : rows, error: null };
    }
    return query;
  } };
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('src/app/actions/reviewActions.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { exports, console: { error() {} }, require(name) {
    if (name === 'next/cache') return { revalidatePath() {} };
    if (name === '@/lib/supabase/server') return {
      createServiceClient: async () => db,
      createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.userId ? { id: state.userId } : null } }) } }),
    };
    throw Error(name);
  } });
  return { actions: exports, state };
}

test('rejects unauthenticated reviews without writing', async () => {
  const { actions, state } = fixture({ signedIn: false });
  assert.equal((await actions.addLawyerReviewAction(input)).success, false);
  assert.equal(state.reviews.length, 0);
});
test('rejects pending consultations and consultations belonging to another client', async () => {
  for (const options of [{ status: 'pending' }, { owner: lawyerId }]) {
    const { actions, state } = fixture(options);
    assert.equal((await actions.addLawyerReviewAction(input)).success, false);
    assert.equal(state.reviews.length, 0);
  }
});
test('validates the rating and feedback before writing', async () => {
  const { actions, state } = fixture();
  for (const change of [{ rating: 0 }, { rating: 6 }, { rating: 2.5 }, { comment: '' }, { comment: 'a'.repeat(5001) }]) {
    assert.equal((await actions.addLawyerReviewAction({ ...input, ...change })).success, false);
  }
  assert.equal(state.reviews.length, 0);
});
test('saved review and rated status are read back from the database without browser storage', async () => {
  const { actions, state } = fixture();
  assert.equal((await actions.addLawyerReviewAction(input)).success, true);
  assert.equal(state.reviews[0].client_id, clientId);
  assert.equal(state.reviews[0].lawyer_id, lawyerId);
  const ratings = await actions.getMyConsultationRatingsAction();
  assert.equal(ratings.ratings[consultationId].rating, 4);
  const profile = await actions.getLawyerReviewsAction(lawyerId);
  assert.equal(profile.reviews.length, 1);
  assert.equal(profile.reviews[0].name, 'Real Client');
  assert.equal(profile.reviews[0].content, input.comment);
});
test('duplicate review is reported as a failure, not a second saved review', async () => {
  const { actions, state } = fixture();
  await actions.addLawyerReviewAction(input);
  assert.equal((await actions.addLawyerReviewAction(input)).success, false);
  assert.equal(state.reviews.length, 1);
});
test('database failure does not report successful submission', async () => {
  const { actions, state } = fixture({ failInsert: true });
  assert.equal((await actions.addLawyerReviewAction(input)).success, false);
  assert.equal(state.reviews.length, 0);
});
test('legacy unlinked reviews are excluded and lawyer dashboard uses the signed-in ID', async () => {
  const { actions, state } = fixture();
  state.reviews.push({ id: 'legacy', lawyer_id: lawyerId, consultation_id: null });
  assert.equal((await actions.getLawyerReviewsAction(lawyerId)).reviews.length, 0);
  await actions.addLawyerReviewAction(input);
  state.userId = lawyerId;
  assert.equal((await actions.getLawyerReviewsAction()).reviews.length, 1);
});
test('only the reviewed lawyer can persist a reply', async () => {
  const { actions, state } = fixture();
  await actions.addLawyerReviewAction(input);
  const reply = { reviewId: state.reviews[0].id, replyText: 'Thank you.' };
  assert.equal((await actions.addReviewReplyAction(reply)).success, false);
  state.userId = lawyerId;
  assert.equal((await actions.addReviewReplyAction(reply)).success, true);
  assert.equal((await actions.getLawyerReviewsAction()).reviews[0].reply, reply.replyText);
});

test('hidden reviews are excluded from public lists but remain rated for their client', async () => {
  const { actions, state } = fixture();
  await actions.addLawyerReviewAction(input);
  state.reviews[0].is_hidden = true;
  assert.equal((await actions.getLawyerReviewsAction(lawyerId)).reviews.length, 0);
  assert.equal((await actions.getMyConsultationRatingsAction()).ratings[consultationId].rating, 4);
});
