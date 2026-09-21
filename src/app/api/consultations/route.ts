import { NextRequest, NextResponse } from 'next/server';

/**
 * Consultations API Route
 *
 * Handles consultation CRUD operations for all roles.
 * All business logic must run server-side (auth, payment verification, conferencing setup).
 *
 * TODO: GET  — list consultations (filtered by role: client sees their own, lawyer sees theirs, admin sees all)
 * TODO: POST — create a new consultation booking
 *   - Verify client auth
 *   - Verify lawyer is verified and available at requested slot
 *   - Process payment via paymentGateway.ts
 *   - Create conferencing room via conferencing.ts
 *   - Insert into consultations table
 *   - Send confirmation emails via email.ts
 * TODO: PATCH [consultationId] — update status (accept/decline/cancel/complete)
 * TODO: DELETE [consultationId] — cancel (with cancellation policy check)
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  // TODO: Implement
  return NextResponse.json({
    data: [],
    message: '[STUB] GET /api/consultations — not yet implemented',
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // TODO: Implement booking flow
  const body = await request.json();
  console.log('[/api/consultations] POST stub received:', body);
  return NextResponse.json({
    data: null,
    message: '[STUB] POST /api/consultations — booking flow not yet implemented',
  }, { status: 201 });
}
