import { notImplementedResponse } from '@/lib/api/notImplemented';

/**
 * Notifications API (reserved).
 *
 * The bell loads through getUserNotificationsAction (src/app/actions/consultationActions.ts) and
 * server code creates notifications directly. This route returns 501 instead of a fake success.
 */
export const dynamic = 'force-dynamic';

const respond = () => notImplementedResponse('Notifications');
export { respond as GET, respond as POST, respond as PATCH, respond as DELETE };
