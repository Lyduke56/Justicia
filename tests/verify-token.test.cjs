/* Signed sign-up verification tokens (src/lib/auth/verifyToken.ts). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');

function load(env) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('src/lib/auth/verifyToken.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, Buffer, process: { env }, require: () => crypto });
  return exports;
}

const USER = '3531288b-e3d1-4410-9ad9-4eae23c4fda2';
const NOW = Date.UTC(2026, 10, 27, 10, 0, 0);
const t = load({ SUPABASE_SERVICE_ROLE_KEY: 'service-key-a' });

test('a token reads back as the account and lower-cased address it was made for', () => {
  const res = t.readVerifyToken(t.createVerifyToken(USER, ' Juan@Example.com ', NOW), NOW + 1000);
  assert.equal(res.ok, true);
  assert.equal(res.payload.userId, USER);
  assert.equal(res.payload.email, 'juan@example.com');
  assert.equal(res.payload.expiresAt, NOW + t.VERIFY_LINK_TTL_MS);
});

test('a token stops working after 24 hours', () => {
  const token = t.createVerifyToken(USER, 'juan@example.com', NOW);
  assert.equal(t.readVerifyToken(token, NOW + t.VERIFY_LINK_TTL_MS).ok, true);
  assert.deepEqual({ ...t.readVerifyToken(token, NOW + t.VERIFY_LINK_TTL_MS + 1) }, { ok: false, reason: 'expired' });
});

test('an edited token is rejected', () => {
  const token = t.createVerifyToken(USER, 'juan@example.com', NOW);
  const [, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ u: 'someone-else', e: 'juan@example.com', x: NOW + 1e9 })).toString('base64url');
  assert.deepEqual({ ...t.readVerifyToken(`${forged}.${sig}`, NOW) }, { ok: false, reason: 'invalid' });
  assert.deepEqual({ ...t.readVerifyToken(`${token}x`, NOW) }, { ok: false, reason: 'invalid' });
  assert.deepEqual({ ...t.readVerifyToken(`${token}.extra`, NOW) }, { ok: false, reason: 'invalid' });
  for (const junk of [null, undefined, '', 'abc', '.', 'a.b']) assert.equal(t.readVerifyToken(junk, NOW).ok, false);
});

test('a token signed with another key is rejected, and EMAIL_VERIFY_SECRET takes priority', () => {
  const token = t.createVerifyToken(USER, 'juan@example.com', NOW);
  assert.equal(load({ SUPABASE_SERVICE_ROLE_KEY: 'service-key-b' }).readVerifyToken(token, NOW).ok, false);
  const withSecret = load({ SUPABASE_SERVICE_ROLE_KEY: 'service-key-a', EMAIL_VERIFY_SECRET: 'own-secret' });
  assert.equal(withSecret.readVerifyToken(token, NOW).ok, false);
  assert.equal(withSecret.readVerifyToken(withSecret.createVerifyToken(USER, 'juan@example.com', NOW), NOW).ok, true);
});
