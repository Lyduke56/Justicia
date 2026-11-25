/**
 * RBAC — Role-Based Access Control Helpers
 *
 * Roles are stored on the user_accounts table (not just in Supabase Auth metadata)
 * and enforced server-side via Postgres Row Level Security policies.
 * These helpers are convenience wrappers for use in middleware and server code.
 */

export type UserRole = 'client' | 'lawyer' | 'admin';

/** Dashboard routes by role */
export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  client: '/client/dashboard',
  lawyer: '/lawyer/dashboard',
  admin: '/admin/dashboard',
};

/** Public routes that do not require authentication */
export const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/auth/callback',       // Supabase email confirmation + password reset code exchange
  '/auth/reset-password', // Set new password after reset link
  '/lawyers',             // Public lawyer profiles (/lawyers/[id])
  '/lawyer/register',     // Lawyer registration flow (account creation + application)
  '/api/ai/chat',         // AI chat endpoint
  '/api/ai/assistant',    // AI assistant endpoint
  '/terms',               // Terms of Service
  '/privacy',             // Privacy Policy
  '/ai-disclaimer',       // AI disclaimer
  '/api/health',          // Health check (no private data)
  '/api/cron',            // Vercel Cron jobs (each checks CRON_SECRET itself)
];

/** Routes every signed-in role may use (account restore, data export). */
const SHARED_ACCOUNT_PREFIXES = ['/account', '/api/account'];

/** Route prefixes that require a specific role */
export const ROLE_ROUTE_PREFIXES: Record<UserRole, string[]> = {
  // '/api/live' = read-only tab loaders and '/api/messages' = conversation extras
  // (each route checks the session user and conversation membership itself).
  client: ['/client', '/ai-assistant', '/legal-research', '/consultations', '/cases', '/documents', '/messages', '/profile', '/settings', '/api/live', '/api/messages', ...SHARED_ACCOUNT_PREFIXES],
  lawyer: ['/lawyer', '/api/live', '/api/messages', ...SHARED_ACCOUNT_PREFIXES],
  admin: ['/admin', '/api/admin', ...SHARED_ACCOUNT_PREFIXES],
};

/**
 * Returns true if the given pathname is a public route (no auth required).
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Returns the dashboard URL for the given role.
 */
export function getDashboardForRole(role: UserRole): string {
  return ROLE_DASHBOARDS[role] ?? '/';
}

/**
 * Returns true if the user's role is allowed to access the given pathname.
 */
export function isAuthorizedForRoute(role: UserRole, pathname: string): boolean {
  const allowedPrefixes = ROLE_ROUTE_PREFIXES[role] ?? [];
  return allowedPrefixes.some((prefix) => (pathname === prefix || pathname.startsWith(prefix + '/')));
}

/**
 * Asserts that the current user has at least one of the required roles.
 * Throws if not authorized — use in Server Actions / API routes.
 */
export function assertRole(userRole: UserRole, ...allowedRoles: UserRole[]): void {
  if (!allowedRoles.includes(userRole)) {
    throw new Error(
      `Forbidden: role "${userRole}" is not authorized. Required: ${allowedRoles.join(' | ')}`
    );
  }
}
