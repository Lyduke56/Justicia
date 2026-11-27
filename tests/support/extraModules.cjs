/**
 * Modules added by the backend audit work, for the test sandboxes that load app sources with a
 * hand-written `require`. Pure helpers are the real code; anything that talks to the network,
 * rate limits or Next.js request APIs is a harmless stand-in. Returns undefined for other names.
 */
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');

const cache = new Map();

function loadReal(file, extraRequire = {}) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    process: { env: {} },
    Buffer,
    URL,
    console,
    require: (name) => {
      if (name in extraRequire) return extraRequire[name];
      if (name === 'node:crypto' || name === 'crypto') return crypto;
      const extra = extraModule(name);
      if (extra) return extra;
      throw new Error(`unexpected import ${name} in ${file}`);
    },
  });
  cache.set(file, exports);
  return exports;
}

function extraModule(name) {
  switch (name) {
    case '@/lib/consultationReminders':
      return { ensureConsultationReminders: async () => {} };
    case '@/lib/security/rateLimit':
      return { checkRateLimit: async () => null, clientIp: async () => '127.0.0.1', hitRateLimit: async () => ({ ok: true, retryAfterSec: 0 }) };
    case '@/lib/security/fileType':
      return loadReal('src/lib/security/fileType.ts');
    case '@/lib/account/profileExtras':
      return loadReal('src/lib/account/profileExtras.ts');
    case '@/lib/lawyer/dashboardSchedule':
      // Pure date helpers (consultation start / end, "soonest first" ordering).
      return loadReal('src/lib/lawyer/dashboardSchedule.ts');
    case '@/lib/utils/attorneyName':
      return loadReal('src/lib/utils/attorneyName.ts');
    case '@/lib/consultations/extras':
      // Pure helpers; callers pass `now` explicitly, so the sandbox clock is respected.
      return loadReal('src/lib/consultations/extras.ts');
    case '@/lib/consultations/call':
      // Pure helpers for in-app calls (path, availability).
      return loadReal('src/lib/consultations/call.ts');
    case '@/lib/lawyer/consultationHours':
      return loadReal('src/lib/lawyer/consultationHours.ts');
    case '@/lib/lawyer/consultationHoursServer':
      return loadReal('src/lib/lawyer/consultationHoursServer.ts');
    case '@/lib/lawyer/paymentQr':
      return loadReal('src/lib/lawyer/paymentQr.ts');
    case '@/lib/consultations/monthAvailability':
      return loadReal('src/lib/consultations/monthAvailability.ts');
    case '@/lib/legal':
      return loadReal('src/lib/legal.ts');
    case '@/lib/auth/roles':
      return loadReal('src/lib/auth/roles.ts');
    case '@/lib/auth/email':
      return loadReal('src/lib/auth/email.ts');
    case '@/lib/email/layout':
      return loadReal('src/lib/email/layout.ts');
    case '@/lib/email/notificationEmail':
      // Emails go through the network; the sandboxes only check the bell rows.
      return { queueNotificationEmail: () => {}, sendNotificationEmail: async () => false, appUrl: () => 'https://justicia.ph' };
    case '@/lib/auth/verificationEmail':
      // The sign-up verification email goes through the network too.
      return { sendSignupVerificationEmail: async () => false, resendSignupVerificationEmail: async () => {} };
    case '@/lib/siteUrl':
      return loadReal('src/lib/siteUrl.ts');
    case '@/lib/auth/returnPath':
      return loadReal('src/lib/auth/returnPath.ts', { '@/lib/utils/rbac': loadReal('src/lib/utils/rbac.ts') });
    case '@/lib/auth/verifyToken':
      return loadReal('src/lib/auth/verifyToken.ts');
    case '@/lib/support':
      return { SUPPORT_EMAIL: 'support@justicia.ph', DELETION_GRACE_DAYS: 7 };
    case '@/lib/auth/demo':
      return { DEMO_COOKIE: 'justicia_demo_session', isDemoEnabled: () => false, isDemoFor: () => false };
    case '@/lib/notifications':
      return { writeAuditLog: async () => {}, createNotification: async () => {} };
    case '@supabase/supabase-js':
      // Stateless clients made directly by app code (password reset emails, password checks).
      return {
        createClient: () => ({
          auth: {
            resetPasswordForEmail: async () => ({ data: {}, error: null }),
            signInWithPassword: async () => ({ data: { user: null }, error: { message: 'Invalid login credentials' } }),
            signOut: async () => ({ error: null }),
          },
        }),
      };
    default:
      return undefined;
  }
}

module.exports = { extraModule, loadReal };
