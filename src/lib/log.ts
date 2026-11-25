/**
 * Structured server logging that never writes sensitive values.
 *
 * Use instead of console.* for new server code: `log.warn('booking.conflict', { consultationId })`.
 * Keys that can carry secrets or private content (passwords, tokens, message text, documents,
 * payment details, full request bodies) are replaced with "[redacted]", and long strings are cut.
 */

type Level = 'info' | 'warn' | 'error';

const SENSITIVE_KEY =
  /pass(word)?|token|secret|authorization|cookie|api[-_]?key|content|body|message|text|note|reason|description|document|file|attachment|card|payment_?proof|evidence|phone|address/i;
const MAX_STRING = 200;
const MAX_DEPTH = 4;

export function redact(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (value instanceof Error) return { name: value.name, message: redact(value.message, depth + 1) };
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redact(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

function write(level: Level, event: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...(redact(fields ?? {}) as object) });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) => write('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write('error', event, fields),
};
