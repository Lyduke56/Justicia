const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function compile(file) {
  return ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
}
const rbac = {};
vm.runInNewContext(compile('src/lib/utils/rbac.ts'), { exports: rbac });
async function runProxy(role, path) {
  const exports = {};
  const next = new Response(null, { status: 200 });
  const url = new URL('http://localhost' + path);
  url.clone = () => new URL(url);
  vm.runInNewContext(compile('src/proxy.ts'), {
    exports,
    require: name => {
      if (name === 'next/server') return { NextResponse: {
        json: (data, init) => Response.json(data, init),
        redirect: url => Response.redirect(url, 307)
      }};
      if (name.endsWith('/middleware')) return { updateSession: async () => ({
        supabaseResponse: next, user: role ? { id: 'test', user_metadata: { role } } : null
      }) };
      if (name.endsWith('/rbac')) return rbac;
      if (name === '@supabase/ssr') return { createServerClient: () => ({
        from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role } }) }) }) })
      }) };
      throw Error(name);
    },
    process: { env: {} }
  });
  return exports.proxy({ nextUrl: url, cookies: { get: () => undefined, getAll: () => [] } });
}
test('signed-in admin tab requests reach their JSON route without a dashboard redirect', async () => {
  for (const resource of ['dashboard', 'queue', 'lawyers', 'users', 'audit']) {
    const response = await runProxy('admin', '/api/admin/tabs?resource=' + resource);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('location'), null);
  }
});
test('denied API requests are JSON, never HTML redirects', async () => {
  for (const role of [null, 'client', 'lawyer']) {
    const response = await runProxy(role, '/api/admin/tabs?resource=dashboard');
    assert.equal(response.status, role ? 403 : 401);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.equal(response.headers.get('location'), null);
  }
});
test('demo query parameters do not redirect API requests', async () => {
  const response = await runProxy('admin', '/api/admin/tabs?resource=dashboard&demo=admin');
  assert.equal(response.status, 200);
});
test('role route matching requires a path segment boundary', () => {
  assert.equal(rbac.isAuthorizedForRoute('admin', '/api/admin/tabs'), true);
  assert.equal(rbac.isAuthorizedForRoute('admin', '/api/administrator'), false);
  assert.equal(rbac.isAuthorizedForRoute('client', '/clientele'), false);
});
