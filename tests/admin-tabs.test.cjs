const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('src/app/api/admin/tabs/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
function handler(user, role, fail = false) {
  const exports = {};
  let reads = 0;
  const loader = async () => { reads++; if (fail) throw Error('private database error'); return [{ id: 'safe-result' }]; };
  vm.runInNewContext(source, {
    exports, Response, URL,
    require: name => name.endsWith('/server') ? {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user } }) },
        from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role } }) }) }) })
      })
    } : {
      getAdminDashboardData: loader, getVerificationQueueData: loader,
      getLawyerDirectoryData: loader, getAdminUsersData: loader, getAdminAuditLogsData: loader
    }
  });
  return { get: resource => exports.GET(new Request('http://localhost/api/admin/tabs?resource=' + resource)), reads: () => reads };
}
test('anonymous and non-admin requests never invoke privileged loaders', async () => {
  for (const [user, role, status] of [[null, null, 401], [{ id: 'user' }, 'client', 403], [{ id: 'user' }, 'lawyer', 403]]) {
    const h = handler(user, role);
    assert.equal((await h.get('users')).status, status);
    assert.equal(h.reads(), 0);
  }
});
test('unknown and prototype resource names cannot invoke a loader', async () => {
  const h = handler({ id: 'admin' }, 'admin');
  for (const key of ['unknown', 'constructor', '__proto__']) assert.equal((await h.get(key)).status, 400);
  assert.equal(h.reads(), 0);
});
test('all admin resources return private uncached responses', async () => {
  const h = handler({ id: 'admin' }, 'admin');
  for (const key of ['dashboard', 'queue', 'lawyers', 'users', 'audit']) {
    const response = await h.get(key);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await response.json(), { data: [{ id: 'safe-result' }] });
  }
  assert.equal(h.reads(), 5);
});
test('loader failures are retryable and do not expose internal errors', async () => {
  const response = await handler({ id: 'admin' }, 'admin', true).get('dashboard');
  assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /private database error/);
});
