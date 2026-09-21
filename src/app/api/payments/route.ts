import { NextRequest, NextResponse } from 'next/server';

/**
 * Payments API Route
 *
 * All payment operations are server-side only. Never expose payment keys to the client.
 * Target: PayMongo (Philippine gateway) or Stripe.
 *
 * TODO: POST /api/payments/intent — create payment intent (calls paymentGateway.ts)
 * TODO: POST /api/payments/confirm — confirm payment after client-side 3DS (calls paymentGateway.ts)
 * TODO: POST /api/payments/webhook — receive webhook from payment provider, update payments table
 *   - Verify webhook signature
 *   - Update payment status
 *   - Trigger consultation confirmation
 *   - Send email receipt
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  console.log('[/api/payments] POST stub received:', body);
  return NextResponse.json({
    data: null,
    message: '[STUB] POST /api/payments — payment integration not yet implemented',
  }, { status: 201 });
}
