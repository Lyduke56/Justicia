import { notImplementedResponse } from '@/lib/api/notImplemented';

/**
 * Consultations API (reserved).
 *
 * Booking, responses, cancellation and rescheduling run through the Server Actions in
 * src/app/actions/consultationActions.ts. This route returns 501 instead of a fake success.
 */
export const dynamic = 'force-dynamic';

const respond = () => notImplementedResponse('Consultation management');
export { respond as GET, respond as POST, respond as PATCH, respond as DELETE };
