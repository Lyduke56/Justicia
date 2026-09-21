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
  client: '/dashboard',
  lawyer: '/lawyer/dashboard',
  admin: '/admin/dashboard',
};

/** Public routes that do not require authentication */
export const PUBLIC_ROUTES = ['/', '/login', '/register', '/verify-email', '/forgot-password'];

/** Route prefixes that require a specific role */
export const ROLE_ROUTE_PREFIXES: Record<UserRole, string[]> = {
  client: ['/dashboard', '/ai-assistant', '/legal-research', '/lawyers', '/consultations', '/cases', '/documents', '/messages', '/profile', '/settings'],
  lawyer: ['/lawyer'],
  admin: ['/admin'],
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
  return allowedPrefixes.some((prefix) => pathname.startsWith(prefix));
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
