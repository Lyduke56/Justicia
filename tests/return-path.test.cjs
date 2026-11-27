/* Where sign-in sends someone back to (src/lib/auth/returnPath.ts). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const compile = (file) => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const rbac = {};
vm.runInNewContext(compile('src/lib/utils/rbac.ts'), { exports: rbac });
const { safeReturnPath } = (() => {
  const exports = {};
  vm.runInNewContext(compile('src/lib/auth/returnPath.ts'), { exports, URL, require: () => rbac });
  return exports;
})();

test('email link targets of the right role come back whole', () => {
  const id = '3531288b-e3d1-4410-9ad9-4eae23c4fda2';
  assert.equal(safeReturnPath(`/client/messages?thread=${id}`, 'client'), `/client/messages?thread=${id}`);
  assert.equal(safeReturnPath(`/lawyer/messages?thread=${id}`, 'lawyer'), `/lawyer/messages?thread=${id}`);
  assert.equal(safeReturnPath(`/call/${id}`, 'client'), `/call/${id}`);
  assert.equal(safeReturnPath(`/call/${id}`, 'lawyer'), `/call/${id}`);
  assert.equal(safeReturnPath('/lawyer/verification', 'lawyer'), '/lawyer/verification');
  assert.equal(safeReturnPath('/client/settings', 'client'), '/client/settings');
});

test('other sites, other roles and junk are refused', () => {
  for (const raw of ['//evil.example/client', '/\evil.example', 'https://evil.example/client', 'client/dashboard', '', null, undefined, 42, '/client\u0000x', '/login', '/register']) {
    assert.equal(safeReturnPath(raw, 'client'), null, String(raw));
  }
  assert.equal(safeReturnPath('/lawyer/consultations', 'client'), null);
  assert.equal(safeReturnPath('/client/consultations', 'lawyer'), null);
  assert.equal(safeReturnPath('/admin/dashboard', 'lawyer'), null);
  assert.equal(safeReturnPath('/client/../admin/dashboard', 'client'), null);
});
