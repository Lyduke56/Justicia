import { notImplementedResponse } from '@/lib/api/notImplemented';

/**
 * Moderation API (reserved).
 *
 * Reports are submitted with submitAccountReportAction and decided with moderateReportAction
 * (src/app/actions/reportActions.ts); admin suspensions use src/app/actions/adminAccountActions.ts.
 * This route returns 501 instead of a fake success.
 */
export const dynamic = 'force-dynamic';

const respond = () => notImplementedResponse('Moderation');
export { respond as GET, respond as POST, respond as PATCH, respond as DELETE };
