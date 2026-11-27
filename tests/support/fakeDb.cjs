/**
 * A small in-memory stand-in for the Supabase client used by server actions in tests:
 * from(table).select/insert/update/upsert/delete with eq/neq/in/is/like/ilike/gte/lte/gt/lt/or,
 * order/limit, single/maybeSingle, head counts, rpc, auth.admin and storage. Rows are plain
 * objects in `tables`; every write is recorded in `writes`.
 */
const crypto = require('node:crypto');

function likeToRegex(pattern, caseInsensitive) {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '\\' && i + 1 < pattern.length) { re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); continue; }
    if (c === '%') re += '.*';
    else if (c === '_') re += '.';
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, caseInsensitive ? 'is' : 's');
}

function getPath(row, key) {
  const m = /^(\w+)->>(\w+)$/.exec(key);
  if (m) {
    const v = row[m[1]];
    return v && typeof v === 'object' ? (v[m[2]] == null ? null : String(v[m[2]])) : null;
  }
  return row[key];
}

function createFakeDb(seed = {}, options = {}) {
  const tables = {};
  for (const [k, v] of Object.entries(seed)) tables[k] = v.map((r) => ({ ...r }));
  const writes = [];
  const authUsers = new Map((options.authUsers ?? []).map((u) => [u.id, { app_metadata: {}, user_metadata: {}, ...u }]));
  const storageLog = { removed: [], uploaded: [] };
  const missingTables = new Set(options.missingTables ?? []);
  const rpcs = options.rpcs ?? {};

  function query(table) {
    const filters = [];
    let op = 'select';
    let payload = null;
    let upsertConflict = null;
    let selectAfter = false;
    let head = false;
    let countMode = null;
    let order = null;
    let limit = null;
    let single = null;
    let ignoreDuplicates = false;

    const q = {
      select(_cols, opts = {}) {
        if (op === 'select') op = 'select'; else selectAfter = true;
        if (opts.head) head = true;
        if (opts.count) countMode = opts.count;
        return q;
      },
      insert(rows) { op = 'insert'; payload = Array.isArray(rows) ? rows : [rows]; return q; },
      update(values) { op = 'update'; payload = values; return q; },
      upsert(rows, opts = {}) { op = 'upsert'; payload = Array.isArray(rows) ? rows : [rows]; upsertConflict = opts.onConflict ?? 'id'; ignoreDuplicates = !!opts.ignoreDuplicates; return q; },
      delete() { op = 'delete'; return q; },
      eq(k, v) { filters.push((r) => getPath(r, k) === v || (v != null && String(getPath(r, k)) === String(v) && typeof v !== 'boolean')); return q; },
      neq(k, v) { filters.push((r) => getPath(r, k) !== v); return q; },
      in(k, vs) { filters.push((r) => vs.includes(getPath(r, k))); return q; },
      is(k, v) { filters.push((r) => (v === null ? getPath(r, k) == null : getPath(r, k) === v)); return q; },
      not(k, opName, v) {
        if (opName === 'like') { const re = likeToRegex(v, false); filters.push((r) => !re.test(String(getPath(r, k) ?? ''))); }
        else if (opName === 'is') filters.push((r) => (v === null ? getPath(r, k) != null : getPath(r, k) !== v));
        return q;
      },
      like(k, p) { const re = likeToRegex(p, false); filters.push((r) => re.test(String(getPath(r, k) ?? ''))); return q; },
      ilike(k, p) { const re = likeToRegex(p, true); filters.push((r) => re.test(String(getPath(r, k) ?? ''))); return q; },
      gte(k, v) { filters.push((r) => getPath(r, k) != null && getPath(r, k) >= v); return q; },
      gt(k, v) { filters.push((r) => getPath(r, k) != null && getPath(r, k) > v); return q; },
      lte(k, v) { filters.push((r) => getPath(r, k) != null && getPath(r, k) <= v); return q; },
      lt(k, v) { filters.push((r) => getPath(r, k) != null && getPath(r, k) < v); return q; },
      or(expr) {
        // Top-level alternatives: `k.eq.v` or `and(k.eq.v,k2.eq.v2)` groups (other operators are ignored).
        const split = (text) => {
          const out = [];
          let depth = 0;
          let cur = '';
          for (const ch of text) {
            if (ch === '(') depth++;
            if (ch === ')') depth--;
            if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
          }
          if (cur) out.push(cur);
          return out;
        };
        const eqOf = (p) => /^(\w+)\.eq\.(.+)$/.exec(p);
        const alternatives = split(expr)
          .map((p) => {
            const group = /^and\((.*)\)$/.exec(p);
            const conds = (group ? split(group[1]) : [p]).map(eqOf);
            return conds.every(Boolean) ? conds : null;
          })
          .filter(Boolean);
        filters.push((r) => alternatives.some((conds) => conds.every(([, k, v]) => String(r[k]) === v)));
        return q;
      },
      order(k, opts = {}) { order = { k, asc: opts.ascending !== false }; return q; },
      limit(n) { limit = n; return q; },
      maybeSingle() { single = 'maybe'; return run(); },
      single() { single = 'one'; return run(); },
      then(resolve, reject) { return run().then(resolve, reject); },
    };

    async function run() {
      if (missingTables.has(table)) return { data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${table}'` }, count: null };
      const rows = (tables[table] ??= []);
      const match = (r) => filters.every((f) => f(r));
      let result;
      if (op === 'select') {
        result = rows.filter(match);
      } else if (op === 'insert') {
        const inserted = payload.map((r) => ({ id: r.id ?? crypto.randomUUID(), created_at: new Date().toISOString(), ...r }));
        if (options.failInsert?.[table]) return { data: null, error: { message: 'insert failed', code: options.failInsert[table] } };
        rows.push(...inserted);
        writes.push({ table, op, rows: inserted });
        result = inserted;
      } else if (op === 'update') {
        result = rows.filter(match);
        for (const r of result) Object.assign(r, payload);
        writes.push({ table, op, values: payload, count: result.length });
      } else if (op === 'upsert') {
        result = [];
        for (const r of payload) {
          const keys = upsertConflict.split(',');
          const existing = rows.find((x) => keys.every((k) => x[k] === r[k]));
          if (existing) { if (!ignoreDuplicates) Object.assign(existing, r); result.push(existing); }
          else { const row = { id: r.id ?? crypto.randomUUID(), ...r }; rows.push(row); result.push(row); }
        }
        writes.push({ table, op, rows: payload });
      } else if (op === 'delete') {
        result = rows.filter(match);
        tables[table] = rows.filter((r) => !match(r));
        writes.push({ table, op, count: result.length });
      }
      if (order) result = [...result].sort((a, b) => (a[order.k] < b[order.k] ? -1 : a[order.k] > b[order.k] ? 1 : 0) * (order.asc ? 1 : -1));
      const count = result.length;
      if (limit != null) result = result.slice(0, limit);
      // Copies, like rows coming back from the API (callers must not see later writes).
      result = result.map((r) => ({ ...r }));
      if (head) return { data: null, error: null, count };
      if (single === 'one') return result.length === 1 ? { data: result[0], error: null } : { data: null, error: { message: 'not single' } };
      if (single === 'maybe') return { data: result[0] ?? null, error: null };
      return { data: result, error: null, count: countMode ? count : null };
    }
    return q;
  }

  const db = {
    tables,
    writes,
    storageLog,
    authUsers,
    from: (table) => query(table),
    rpc: async (name, args) => (rpcs[name] ? rpcs[name](args) : { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${name}` } }),
    auth: {
      admin: {
        getUserById: async (id) => ({ data: { user: authUsers.get(id) ?? null }, error: null }),
        updateUserById: async (id, attrs) => {
          const u = authUsers.get(id);
          if (!u) return { data: null, error: { message: 'User not found' } };
          Object.assign(u, attrs);
          return { data: { user: u }, error: null };
        },
      },
    },
    storage: {
      from: (bucket) => ({
        upload: async (path) => { storageLog.uploaded.push(`${bucket}/${path}`); return { error: null }; },
        remove: async (paths) => { storageLog.removed.push(...paths.map((p) => `${bucket}/${p}`)); return { error: null }; },
        list: async () => ({ data: [], error: null }),
        createSignedUrl: async (path) => ({ data: { signedUrl: `https://signed.example/${bucket}/${path}` }, error: null }),
        getPublicUrl: (path) => ({ data: { publicUrl: `https://public.example/${bucket}/${path}` } }),
      }),
    },
  };
  return db;
}

module.exports = { createFakeDb };
