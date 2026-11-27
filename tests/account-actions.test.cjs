const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture({ role = 'client', signedIn = true, failTable, failAuth = false, blocked = false, currentPasswordValid = true, missingAccount = false } = {}) {
  const state = {
    user: { id: 'own-id', email: 'test@example.invalid', email_confirmed_at: '2026-01-01', user_metadata: { full_name: 'Original', unrelated: 'keep', role: 'admin' } },
    rows: {
      user_accounts: missingAccount ? [] : [{ id: 'own-id', full_name: 'Original', phone: null, role }, { id: 'other-id', full_name: 'Untouched', role: 'admin' }],
      profiles: [{ user_id: 'own-id', full_name: 'Original', phone: null, role }],
      lawyer_profiles: [{ user_id: 'own-id', full_name: 'Original', verification_status: 'approved' }],
    }, writes: [], authUpdates: [], verifierSignedOut: false,
  };
  const db = { from(table) {
    let changes;
    const filters = [];
    const q = {
      select() { return q; }, eq(k, v) { filters.push(r => r[k] === v); return q; },
      update(value) { changes = value; return q; },
      async maybeSingle() {
        if (changes && table === failTable) return { data: null, error: { message: 'Test failure' } };
        const row = state.rows[table].find(r => filters.every(f => f(r)));
        if (changes && row) { Object.assign(row, changes); state.writes.push({ table, changes }); }
        return { data: row ?? null, error: null };
      },
    };
    return q;
  } };
  const auth = { auth: {
    getUser: async () => ({ data: { user: signedIn ? state.user : null }, error: null }),
    updateUser: async (update) => {
      if (failAuth) return { error: { message: 'Auth unavailable' } };
      state.authUpdates.push(update);
      if (update.data) Object.assign(state.user.user_metadata, update.data);
      return { error: null };
    },
  } };
  const modules = {};
  function load(path) {
    if (modules[path]) return modules[path];
    const exports = {};
    const compiled = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    vm.runInNewContext(compiled, { exports, process: { env: {} }, require(name) {
      if (name === 'next/cache') return { revalidatePath() {} };
      if (name === '@/lib/supabase/server') return { createClient: async () => auth, createServiceClient: async () => db };
      if (name === '@/lib/moderation/accountStatus') return { checkAccountAccess: async () => blocked ? 'Account suspended.' : null, signalUsers() {} };
      if (name === '@/lib/account/preferences') return load('src/lib/account/preferences.ts');
      if (name === '@supabase/supabase-js') return { createClient: () => ({ auth: {
        signInWithPassword: async () => ({ data: { user: currentPasswordValid ? state.user : null }, error: currentPasswordValid ? null : {} }),
        signOut: async () => { state.verifierSignedOut = true; },
      } }) };
      throw new Error(name);
    } });
    modules[path] = exports;
    return exports;
  }
  return { actions: load('src/app/actions/accountActions.ts'), state };
}

test('all account mutations reject unauthenticated and suspended sessions', async () => {
  for (const config of [{ signedIn: false }, { blocked: true }]) {
    const { actions, state } = fixture(config);
    assert.equal((await actions.updatePersonalAccountAction({ fullName: 'Changed', phone: '' })).success, false);
    assert.equal((await actions.updateAccountPreferencesAction({ consultationNotifications: false })).success, false);
    assert.equal((await actions.changeAccountPasswordAction({})).success, false);
    assert.equal(state.writes.length, 0);
    assert.equal(state.authUpdates.length, 0);
  }
});

test('each role saves and reloads personal fields without modifying another account or privileged fields', async () => {
  for (const role of ['client', 'lawyer', 'admin']) {
    const { actions, state } = fixture({ role });
    const expectedName = role === 'lawyer' ? 'Original' : 'Updated Name';
    const result = await actions.updatePersonalAccountAction({ fullName: expectedName, phone: '+63 912 345 6789', role: 'admin', id: 'other-id', verification_status: 'approved' });
    assert.equal(result.success, true);
    const reloaded = await actions.getPersonalAccountAction();
    assert.equal(reloaded.account.fullName, expectedName);
    assert.equal(reloaded.account.phone, '+63 912 345 6789');
    assert.equal(reloaded.account.role, role);
    assert.equal(state.rows.user_accounts[1].full_name, 'Untouched');
    assert.equal(state.rows.user_accounts[0].role, role);
    assert.equal(state.rows.lawyer_profiles[0].full_name, 'Original');
  }
});

test('uses database profile role for legacy accounts, never user-editable role metadata', async () => {
  const { actions } = fixture({ missingAccount: true, role: 'client' });
  assert.equal((await actions.getPersonalAccountAction()).account.role, 'client');
  assert.equal((await actions.updatePersonalAccountAction({ fullName: 'Legacy Name', phone: '' })).success, true);
  assert.equal((await actions.getPersonalAccountAction()).account.fullName, 'Legacy Name');
});

test('invalid names and phone numbers cause no writes', async () => {
  for (const input of [{ fullName: '', phone: '' }, { fullName: 'a'.repeat(121), phone: '' }, { fullName: 'Name', phone: 'invalid' }]) {
    const { actions, state } = fixture();
    assert.equal((await actions.updatePersonalAccountAction(input)).success, false);
    assert.equal(state.writes.length, 0);
  }
});

test('a failed or partial database save is reported accurately', async () => {
  const first = fixture({ failTable: 'user_accounts' });
  assert.equal((await first.actions.updatePersonalAccountAction({ fullName: 'Changed', phone: '' })).success, false);
  assert.equal(first.state.writes.length, 0);
  const partial = fixture({ failTable: 'profiles' });
  const result = await partial.actions.updatePersonalAccountAction({ fullName: 'Changed', phone: '' });
  assert.equal(result.success, false);
  assert.match(result.error, /Some profile details were saved/);
});

test('preferences persist in Supabase metadata, preserve unrelated metadata and reject invalid input', async () => {
  const { actions, state } = fixture();
  assert.equal((await actions.getPersonalAccountAction()).account.consultationNotifications, true);
  assert.equal((await actions.updateAccountPreferencesAction({ consultationNotifications: false, role: 'lawyer' })).success, true);
  assert.equal((await actions.getPersonalAccountAction()).account.consultationNotifications, false);
  assert.equal(state.user.user_metadata.unrelated, 'keep');
  assert.equal((await actions.updateAccountPreferencesAction({ consultationNotifications: 'false' })).success, false);
  const failed = fixture({ failAuth: true });
  assert.equal((await failed.actions.updateAccountPreferencesAction({ consultationNotifications: false })).success, false);
  assert.equal((await failed.actions.getPersonalAccountAction()).account.consultationNotifications, true);
});

test('the email updates switch is saved on its own and keeps the other choices', async () => {
  const { actions } = fixture();
  assert.equal((await actions.getPersonalAccountAction()).account.emailUpdates, true);
  assert.equal((await actions.updateAccountPreferencesAction({ notifications: { payments: false } })).success, true);
  assert.equal((await actions.updateAccountPreferencesAction({ emailUpdates: false })).success, true);
  const account = (await actions.getPersonalAccountAction()).account;
  assert.equal(account.emailUpdates, false);
  assert.equal(account.notifications.payments, false);
  // Changing a category later leaves the email switch alone.
  assert.equal((await actions.updateAccountPreferencesAction({ notifications: { payments: true } })).success, true);
  assert.equal((await actions.getPersonalAccountAction()).account.emailUpdates, false);
  assert.equal((await actions.updateAccountPreferencesAction({ emailUpdates: 'no' })).success, false);
});

test('password change requires matching new passwords and successful current-password verification', async () => {
  const input = { currentPassword: 'old-password', password: 'new-password', confirmPassword: 'new-password' };
  const wrong = fixture({ currentPasswordValid: false });
  assert.equal((await wrong.actions.changeAccountPasswordAction(input)).success, false);
  assert.equal(wrong.state.authUpdates.length, 0);
  const valid = fixture();
  assert.equal((await valid.actions.changeAccountPasswordAction({ ...input, confirmPassword: 'mismatch' })).success, false);
  assert.equal((await valid.actions.changeAccountPasswordAction(input)).success, true);
  assert.equal(valid.state.verifierSignedOut, true);
  assert.equal(valid.state.authUpdates[0].password, input.password);
  const failed = fixture({ failAuth: true });
  assert.equal((await failed.actions.changeAccountPasswordAction(input)).success, false);
  assert.equal(failed.state.verifierSignedOut, true);
});

test('lawyer legal-name changes cannot bypass credential verification or partially update identity records', async () => {
  const { actions, state } = fixture({ role: 'lawyer' });
  const result = await actions.updatePersonalAccountAction({ fullName: 'Different Legal Name', phone: '' });
  assert.equal(result.success, false);
  assert.match(result.error, /credential verification/);
  assert.equal(state.writes.length, 0);
  assert.equal(state.authUpdates.length, 0);
  assert.equal(state.rows.lawyer_profiles[0].verification_status, 'approved');
});
