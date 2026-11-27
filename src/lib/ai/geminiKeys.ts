/**
 * Gemini API keys with fallback. SERVER-SIDE ONLY.
 *
 * Up to four keys: GEMINI_API_KEY (primary), then GEMINI_API_KEY_2, GEMINI_API_KEY_3 and
 * GEMINI_API_KEY_4. Keys from different Google Cloud projects have separate free-tier quotas, so
 * when one runs out (429) or stops working (revoked / invalid), the next one answers instead.
 *
 * A key that hit its quota or was rejected sits out for a while (in this server instance), so
 * later requests start with a working key instead of failing on the same one again. If every key
 * is sitting out, they are all tried anyway. Key values are never logged, only their env names.
 */

export const GEMINI_KEY_ENV_NAMES = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4'] as const;

export interface GeminiKey {
  /** Env variable name, safe to log. */
  name: string;
  value: string;
}

/** How long a key sits out after a quota error, and after being rejected. */
export const RATE_LIMIT_COOLDOWN_MS = 60 * 1000;
export const REJECTED_COOLDOWN_MS = 10 * 60 * 1000;
/** Retries of a temporarily overloaded model (503) before moving on to the next key. */
const TRANSIENT_RETRIES = 2;

/** The configured keys in fallback order, without blanks or duplicates. */
export function geminiApiKeys(env: Record<string, string | undefined> = process.env): GeminiKey[] {
  const seen = new Set<string>();
  const keys: GeminiKey[] = [];
  for (const name of GEMINI_KEY_ENV_NAMES) {
    const value = env[name]?.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    keys.push({ name, value });
  }
  return keys;
}

export type GeminiErrorKind =
  /** Quota or rate limit on this key: try the next key now. */
  | 'rate_limited'
  /** The key is invalid, revoked or not allowed to use the model: try the next key now. */
  | 'rejected'
  /** The model is overloaded or the network failed: worth a retry. */
  | 'transient'
  /** A problem with the request itself; another key would fail the same way. */
  | 'fatal';

export function classifyGeminiError(err: unknown): GeminiErrorKind {
  const e = (err ?? {}) as { status?: unknown; code?: unknown; message?: unknown };
  const status = Number(e.status ?? e.code);
  const message = String(e.message ?? err ?? '');
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(message)) return 'rate_limited';
  if (status === 401 || status === 403 || /API[_ ]KEY[_ ]INVALID|API key not valid|API key expired|PERMISSION_DENIED|UNAUTHENTICATED/i.test(message)) {
    return 'rejected';
  }
  if (status >= 500 || /UNAVAILABLE|high demand|overloaded|fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up|timed? ?out/i.test(message)) {
    return 'transient';
  }
  return 'fatal';
}

const sittingOut = new Map<string, number>();

/** Keys that are not sitting out come first; if all are, every key is tried in the usual order. */
function keysToTry(keys: GeminiKey[], now: number): GeminiKey[] {
  const ready = keys.filter((k) => (sittingOut.get(k.value) ?? 0) <= now);
  return ready.length ? ready : keys;
}

export interface WithGeminiKeysOptions {
  keys?: GeminiKey[];
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Runs `call` with the first working key. Quota and rejected-key errors move straight to the next
 * key; an overloaded model (503) is retried a couple of times with a short pause first. Throws the
 * last error when no key succeeds (the caller falls back to the knowledge-base answer).
 */
export async function withGeminiKeys<T>(call: (apiKey: string, key: GeminiKey) => Promise<T>, options: WithGeminiKeysOptions = {}): Promise<T> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const keys = options.keys ?? geminiApiKeys();
  if (keys.length === 0) throw new Error('No Gemini API key is configured.');

  const queue = keysToTry(keys, now());
  let transientRetries = 0;
  let lastError: unknown = null;
  for (let i = 0; i < queue.length; ) {
    const key = queue[i];
    try {
      const result = await call(key.value, key);
      sittingOut.delete(key.value);
      return result;
    } catch (err) {
      lastError = err;
      const kind = classifyGeminiError(err);
      if (kind === 'fatal') throw err;
      if (kind === 'transient' && transientRetries < TRANSIENT_RETRIES) {
        transientRetries++;
        const delay = transientRetries * 1500;
        console.warn(`[Gemini] ${key.name}: model busy, retrying in ${delay}ms (${transientRetries}/${TRANSIENT_RETRIES})`);
        await sleep(delay);
        continue;
      }
      if (kind === 'rate_limited') sittingOut.set(key.value, now() + RATE_LIMIT_COOLDOWN_MS);
      if (kind === 'rejected') sittingOut.set(key.value, now() + REJECTED_COOLDOWN_MS);
      const next = queue[i + 1];
      console.warn(`[Gemini] ${key.name} failed (${kind})${next ? `, trying ${next.name}` : ', no keys left'}`);
      i++;
    }
  }
  throw lastError;
}

/** For tests: forget which keys are sitting out. */
export function resetGeminiKeyState(): void {
  sittingOut.clear();
}
