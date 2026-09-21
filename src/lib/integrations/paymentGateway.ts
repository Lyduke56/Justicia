/**
 * Payment Gateway Client Stub
 *
 * All payment operations MUST be called server-side only.
 * Target integration: PayMongo (Philippine payment gateway) or Stripe.
 *
 * TODO: Integrate PayMongo or Stripe once PAYMENT_GATEWAY_API_KEY is configured
 */

export interface PaymentIntent {
  id: string;
  amount: number; // in centavos (PHP)
  currency: string;
  status: string;
  clientSecret?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  maskedCardLast4?: string;
  error?: string;
}

/**
 * Creates a payment intent for a consultation fee.
 * TODO: Implement with real payment gateway
 */
export async function createPaymentIntent(
  amountCentavos: number,
  consultationId: string
): Promise<PaymentIntent> {
  console.log('[Payment Stub] createPaymentIntent', { amountCentavos, consultationId });
  // TODO: POST to payment gateway API
  return {
    id: `stub_pi_${Date.now()}`,
    amount: amountCentavos,
    currency: 'PHP',
    status: 'pending',
    clientSecret: 'stub_client_secret',
  };
}

/**
 * Confirms a payment and records the result.
 * TODO: Implement webhook verification from payment provider
 */
export async function confirmPayment(paymentIntentId: string): Promise<PaymentResult> {
  console.log('[Payment Stub] confirmPayment', paymentIntentId);
  return {
    success: true,
    transactionId: `stub_txn_${Date.now()}`,
    maskedCardLast4: '4242',
  };
}
