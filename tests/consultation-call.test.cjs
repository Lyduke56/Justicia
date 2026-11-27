// In-app consultation calls: STUN/TURN servers handed to the browser (src/lib/consultations/callServer.ts)
// and the pure call helpers (src/lib/consultations/call.ts).
// Run: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');

const compile = (file) =>
  ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

const extras = (() => {
  const mod = {};
  vm.runInNewContext(compile('src/lib/consultations/extras.ts'), { exports: mod, Date });
  return mod;
})();

function loadCall() {
  const mod = {};
  vm.runInNewContext(compile('src/lib/consultations/call.ts'), {
    exports: mod,
    Date,
    require: (n) => {
      if (n === '@/lib/consultations/extras') return extras;
      throw new Error(`unexpected import ${n}`);
    },
  });
  return mod;
}

/** callServer.ts with the given environment and fetch stand-in. */
function loadServer(env, fetchImpl) {
  const mod = {};
  const warnings = [];
  const calls = [];
  vm.runInNewContext(compile('src/lib/consultations/callServer.ts'), {
    exports: mod,
    Date,
    AbortSignal,
    process: { env },
    console: { warn: (...a) => warnings.push(a.join(' ')), error() {}, log() {} },
    fetch: async (url, init) => {
      calls.push({ url, init });
      return fetchImpl(url, init);
    },
    require: (n) => {
      if (n === 'node:crypto') return crypto;
      throw new Error(`unexpected import ${n}`);
    },
  });
  return { mod, warnings, calls };
}

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const urlsOf = (servers) => servers.flatMap((s) => [].concat(s.urls));

test('no TURN provider: public STUN only, no network call', async () => {
  const { mod, calls } = loadServer({}, () => { throw new Error('should not fetch'); });
  const { iceServers, relay } = await mod.iceServersForCall();
  assert.equal(relay, false);
  assert.equal(calls.length, 0);
  assert.ok(urlsOf(iceServers).every((u) => u.startsWith('stun:')));
  assert.equal(mod.turnProvider(), null);
});

test('Cloudflare TURN: short-lived credentials are requested and port 53 URLs are dropped', async () => {
  const { mod, calls } = loadServer({ CLOUDFLARE_TURN_KEY_ID: 'key-1', CLOUDFLARE_TURN_API_TOKEN: 'tok' }, () =>
    json(201, {
      iceServers: [
        { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] },
        {
          urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turn:turn.cloudflare.com:53?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'],
          username: 'u',
          credential: 'c',
        },
      ],
    })
  );
  const { iceServers, relay } = await mod.iceServersForCall();
  assert.equal(relay, true);
  assert.equal(calls[0].url, 'https://rtc.live.cloudflare.com/v1/turn/keys/key-1/credentials/generate-ice-servers');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
  assert.ok(JSON.parse(calls[0].init.body).ttl > 3600, 'credentials outlive a session');
  const urls = urlsOf(iceServers);
  assert.equal(urls.some((u) => /:53(\?|$)/.test(u)), false);
  assert.ok(urls.includes('turns:turn.cloudflare.com:443?transport=tcp'));
  const turn = iceServers.find((s) => urlsOf([s]).some((u) => u.startsWith('turn')));
  assert.equal(turn.username, 'u');
  assert.equal(turn.credential, 'c');
});

test('Metered TURN: the credentials list is used as is', async () => {
  const { mod, calls } = loadServer({ METERED_TURN_DOMAIN: 'https://justicia.metered.live/', METERED_TURN_API_KEY: 'k&1' }, () =>
    json(200, [
      { urls: 'stun:stun.relay.metered.ca:80' },
      { urls: 'turn:global.relay.metered.ca:80', username: 'a', credential: 'b' },
      { urls: 'turn:global.relay.metered.ca:443?transport=tcp', username: 'a', credential: 'b' },
    ])
  );
  const { iceServers, relay } = await mod.iceServersForCall();
  assert.equal(relay, true);
  assert.equal(calls[0].url, 'https://justicia.metered.live/api/v1/turn/credentials?apiKey=k%261');
  assert.ok(urlsOf(iceServers).includes('turn:global.relay.metered.ca:443?transport=tcp'));
});

test('static TURN settings; TURN entries without credentials are ignored', async () => {
  const ok = loadServer({ TURN_URLS: 'turn:turn.example.ph:3478, turns:turn.example.ph:5349', TURN_USERNAME: 'x', TURN_CREDENTIAL: 'y' }, () => { throw new Error('no fetch'); });
  const res = await ok.mod.iceServersForCall();
  assert.equal(res.relay, true);
  assert.ok(urlsOf(res.iceServers).includes('turns:turn.example.ph:5349'));

  const noCreds = loadServer({ TURN_URLS: 'turn:turn.example.ph:3478' }, () => { throw new Error('no fetch'); });
  assert.equal((await noCreds.mod.iceServersForCall()).relay, false);
});

test('a TURN provider that fails never breaks the call: STUN only, with a warning', async () => {
  const down = loadServer({ CLOUDFLARE_TURN_KEY_ID: 'k', CLOUDFLARE_TURN_API_TOKEN: 't' }, () => json(500, {}));
  const res = await down.mod.iceServersForCall();
  assert.equal(res.relay, false);
  assert.ok(urlsOf(res.iceServers).length > 0);
  assert.match(down.warnings.join('\n'), /STUN only/);

  const offline = loadServer({ METERED_TURN_DOMAIN: 'x.metered.live', METERED_TURN_API_KEY: 'k' }, () => { throw new Error('getaddrinfo ENOTFOUND'); });
  assert.equal((await offline.mod.iceServersForCall()).relay, false);
});

test('the call topic needs the server secret', () => {
  const { mod } = loadServer({}, () => null);
  assert.equal(mod.callTopicFor('33333333-0000-4333-8333-000000000001', null), null);
  const withSecret = loadServer({ REALTIME_TOPIC_SECRET: 's3cret' }, () => null).mod;
  const other = loadServer({ REALTIME_TOPIC_SECRET: 'different' }, () => null).mod;
  const a = withSecret.callTopicFor('33333333-0000-4333-8333-000000000001', '2026-11-26T02:00:00Z');
  assert.match(a, /^call-[0-9a-f]{40}$/);
  assert.notEqual(a, other.callTopicFor('33333333-0000-4333-8333-000000000001', '2026-11-26T02:00:00Z'), 'unguessable without the secret');
});

test('call availability and timer helpers', () => {
  const call = loadCall();
  const w = { start: Date.parse('2026-11-26T02:00:00Z'), end: Date.parse('2026-11-26T03:00:00Z') };
  assert.equal(call.callAvailability('confirmed', w, Date.parse('2026-11-26T00:59:59Z')), 'not_yet');
  assert.equal(call.callAvailability('confirmed', w, Date.parse('2026-11-26T01:00:00Z')), 'open', 'opens exactly 1 hour before');
  assert.equal(call.callAvailability('confirmed', w, Date.parse('2026-11-26T02:59:59Z')), 'open');
  assert.equal(call.callAvailability('confirmed', w, Date.parse('2026-11-26T03:00:00Z')), 'ended', 'closes at the end');
  assert.equal(call.callAvailability('awaiting_client_confirmation', w, w.start), 'not_confirmed');
  assert.equal(call.callAvailability('cancelled', w, w.start), 'closed');
  assert.equal(call.callAvailability('declined', w, w.start), 'closed');
  assert.equal(call.callAvailability('completed', w, w.start), 'ended');
  assert.equal(call.consultationCallPath('abc'), '/call/abc');
  assert.equal(call.formatCallDuration(65_000), '1:05');
  assert.equal(call.formatCallDuration(3_725_000), '1:02:05');
});
