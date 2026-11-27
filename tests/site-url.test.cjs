/* The site address used in email links (src/lib/siteUrl.ts). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(env) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('src/lib/siteUrl.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, URL, process: { env } });
  return exports;
}

const SITE = 'https://justicia-chi.vercel.app';

test('a pasted value is cleaned down to the bare origin', () => {
  const { cleanSiteUrl } = load({});
  // The value found in the deployed settings: a Markdown link copied from a chat.
  assert.equal(cleanSiteUrl(`[${SITE}](${SITE})`), SITE);
  assert.equal(cleanSiteUrl(`${SITE}/`), SITE);
  assert.equal(cleanSiteUrl(` "${SITE}" `), SITE);
  assert.equal(cleanSiteUrl(`<${SITE}>`), SITE);
  assert.equal(cleanSiteUrl(`${SITE}/client/dashboard`), SITE);
  assert.equal(cleanSiteUrl('http://localhost:3000'), 'http://localhost:3000');
  for (const junk of ['', '   ', 'justicia-chi.vercel.app', 'not a url', null, undefined]) {
    assert.equal(cleanSiteUrl(junk), null);
  }
});

test('NEXT_PUBLIC_APP_URL wins, then NEXT_PUBLIC_SITE_URL, then the default', () => {
  assert.equal(load({}).publicSiteUrl(), SITE);
  assert.equal(load({ NEXT_PUBLIC_SITE_URL: `[${SITE}](${SITE})` }).publicSiteUrl(), SITE);
  assert.equal(load({ NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }).publicSiteUrl(), 'http://localhost:3000');
  assert.equal(
    load({ NEXT_PUBLIC_APP_URL: 'https://app.example.ph/', NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }).publicSiteUrl(),
    'https://app.example.ph'
  );
  // A broken first setting falls through to the next one instead of producing a dead link.
  assert.equal(load({ NEXT_PUBLIC_APP_URL: 'garbage', NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }).publicSiteUrl(), 'http://localhost:3000');
  assert.equal(load({ NEXT_PUBLIC_SITE_URL: 'garbage' }).publicSiteUrl(), SITE);
});
