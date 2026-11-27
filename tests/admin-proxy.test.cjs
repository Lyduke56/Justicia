const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { loadReal } = require('./support/extraModules.cjs');
function compile(file) {
  return ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
}
const rbac = {};
vm.runInNewContext(compile('src/lib/utils/rbac.ts'), { exports: rbac });
const roles = loadReal('src/lib/auth/roles.ts');
const returnPath = {};
vm.runInNewContext(compile('src/lib/auth/returnPath.ts'), { exports: returnPath, URL, require: () => rbac });

/**
 * Runs the proxy for one request.
 *  role:      the database role (user_accounts.role); null = signed out
 *  metaRole:  user_metadata.role, which users can edit themselves (defaults to `role`)
 *  appRole / appStatus: the server-written app_metadata claims
 *  demo:      whether JUSTICIA_DEMO is on (development only)
 */
async function runProxy(role, path, { metaRole = role, appRole, appStatus, demo = false, cookie } = {}) {
  const exports = {};
  const next = new Response(null, { status: 200 });
  const url = new URL('http://localhost' + path);
  url.clone = () => new URL(url);
  const env = demo ? { NODE_ENV: 'development', JUSTICIA_DEMO: 'true' } : {};
  const demoModule = {};
  vm.runInNewContext(compile('src/lib/auth/demo.ts'), { exports: demoModule, process: { env } });
  vm.runInNewContext(compile('src/proxy.ts'), {
    exports,
    require: name => {
      if (name === 'next/server') return { NextResponse: {
        json: (data, init) => Response.json(data, init),
        redirect: url => {
          const res = Response.redirect(url, 307);
          return new Proxy(res, { get: (t, k) => (k === 'cookies' ? { set() {} } : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) });
        },
      }};
      if (name.endsWith('/middleware')) return { updateSession: async () => ({
        supabaseResponse: next,
        user: role ? { id: 'test', user_metadata: { role: metaRole }, app_metadata: { ...(appRole ? { role: appRole } : {}), ...(appStatus ? { account_status: appStatus } : {}) } } : null
      }) };
      if (name.endsWith('/rbac')) return rbac;
      if (name === '@/lib/auth/demo') return demoModule;
      if (name === '@/lib/auth/roles') return roles;
      if (name === '@/lib/auth/returnPath') return returnPath;
      if (name === '@supabase/ssr') return { createServerClient: () => ({
        from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role } }) }) }) })
      }) };
      throw Error(name);
    },
    process: { env },
    URL
  });
  return exports.proxy({ nextUrl: url, cookies: { get: (k) => (k === 'justicia_demo_session' && cookie ? { value: cookie } : undefined), getAll: () => [] } });
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
test('a user who edits user_metadata.role to admin is still routed by their real role', async () => {
  const page = await runProxy('client', '/admin/dashboard', { metaRole: 'admin' });
  assert.equal(page.status, 307);
  assert.match(page.headers.get('location'), /\/client\/dashboard$/);
  const api = await runProxy('client', '/api/admin/tabs?resource=users', { metaRole: 'admin' });
  assert.equal(api.status, 403);
  const lawyerPortal = await runProxy('client', '/lawyer/dashboard', { metaRole: 'lawyer' });
  assert.match(lawyerPortal.headers.get('location'), /\/client\/dashboard$/);
});
test('the server-written app_metadata role is used without a database lookup', async () => {
  const res = await runProxy('client', '/admin/dashboard', { appRole: 'admin' });
  assert.equal(res.status, 200);
});
test('demo mode is off unless JUSTICIA_DEMO is set in development, and never opens APIs or admin', async () => {
  const off = await runProxy(null, '/client/dashboard?demo=client');
  assert.match(off.headers.get('location'), /\/login/);
  const cookieOnly = await runProxy(null, '/client/dashboard', { cookie: 'client' });
  assert.match(cookieOnly.headers.get('location'), /\/login/);
  const on = await runProxy(null, '/client/dashboard', { cookie: 'client', demo: true });
  assert.equal(on.status, 200);
  const api = await runProxy(null, '/api/live?resource=x', { cookie: 'client', demo: true });
  assert.equal(api.status, 401);
  const admin = await runProxy(null, '/admin/dashboard', { cookie: 'admin', demo: true });
  assert.match(admin.headers.get('location'), /\/login/);
});
test('an account scheduled for deletion can only open the restore page', async () => {
  const page = await runProxy('client', '/client/dashboard', { appStatus: 'pending_deletion' });
  assert.match(page.headers.get('location'), /\/account\/restore$/);
  const api = await runProxy('client', '/api/live?resource=x', { appStatus: 'pending_deletion' });
  assert.equal(api.status, 423);
  const restore = await runProxy('client', '/account/restore', { appStatus: 'pending_deletion' });
  assert.equal(restore.status, 200);
});
test('stub routes are not reachable as success for any role', async () => {
  for (const role of ['client', 'lawyer', 'admin']) {
    for (const path of ['/api/payments', '/api/moderation', '/api/consultations', '/api/notifications']) {
      const res = await runProxy(role, path);
      assert.notEqual(res.status, 200, `${role} ${path}`);
    }
  }
});
test('a signed-out email link goes to sign-in and keeps the whole address, query included', async () => {
  const res = await runProxy(null, '/client/messages?thread=3531288b-e3d1-4410-9ad9-4eae23c4fda2');
  const location = new URL(res.headers.get('location'));
  assert.equal(location.pathname, '/login');
  assert.equal(location.searchParams.get('redirectTo'), '/client/messages?thread=3531288b-e3d1-4410-9ad9-4eae23c4fda2');
});
test('opening /login while signed in goes to the link target if the role may open it, else the dashboard', async () => {
  const back = await runProxy('client', '/login?redirectTo=' + encodeURIComponent('/client/messages?thread=abc'));
  assert.match(back.headers.get('location'), /\/client\/messages\?thread=abc$/);
  const otherRole = await runProxy('client', '/login?redirectTo=' + encodeURIComponent('/lawyer/consultations'));
  assert.match(otherRole.headers.get('location'), /\/client\/dashboard$/);
  const offsite = await runProxy('client', '/login?redirectTo=' + encodeURIComponent('//evil.example/client'));
  assert.match(offsite.headers.get('location'), /^http:\/\/localhost\/client\/dashboard$/);
});
