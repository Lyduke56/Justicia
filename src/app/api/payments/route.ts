import { notImplementedResponse } from '@/lib/api/notImplemented';

/**
 * Payments API (reserved).
 *
 * Justicia uses manual proof of payment: the client uploads a receipt and the lawyer verifies it
 * (submitPaymentProofAction / reviewPaymentAction in src/app/actions/consultationActions.ts).
 * There is no payment gateway, so this route returns 501 instead of a fake success.
 */
export const dynamic = 'force-dynamic';

const respond = () => notImplementedResponse('Online payment');
export { respond as GET, respond as POST, respond as PATCH, respond as DELETE };
