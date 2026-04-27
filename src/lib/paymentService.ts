/**
 * PaymentService — Abstraction layer for High Wire Payments
 * Phase 9: Payment Processor Hook
 *
 * This module provides a clean interface for all payment operations.
 * When High Wire API credentials are available, replace the mock
 * implementations in each method with real API calls.
 *
 * Supported processors (configured via app_config):
 * - 'high_wire_payments' (primary)
 * - 'stripe' (future)
 * - 'square' (future)
 * - 'authorize_net' (future)
 */

import { supabase } from '@/lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────

export interface PaymentConfig {
  processor: string;           // e.g. 'high_wire_payments'
  mode: 'test' | 'live';       // test or live transactions
  clientId: string | null;     // API client ID / merchant ID
  apiKey: string | null;       // API key / secret
  endpointUrl: string | null;  // Processor API base URL
  webhookSecret: string | null;// Webhook verification secret
}

export interface PaymentIntent {
  id: string;                  // Internal payment intent ID
  invoiceId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'requires_action' | 'succeeded' | 'failed' | 'cancelled';
  processorToken: string | null; // Token returned by processor
  paymentUrl: string | null;   // URL customer clicks to pay
  createdAt: string;
  metadata: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  transactionId: string | null;
  errorMessage: string | null;
  receiptUrl: string | null;
}

export interface RefundResult {
  success: boolean;
  refundId: string | null;
  amountRefunded: number;
  errorMessage: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function getPaymentConfig(): Promise<PaymentConfig> {
  const { data, error } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', [
      'payment_processor',
      'payment_mode',
      'payment_client_id',
      'payment_api_key',
      'payment_endpoint_url',
      'payment_webhook_secret',
    ]);

  if (error) {
    console.error('[PaymentService] Failed to load config:', error);
  }

  const map = new Map((data || []).map((r: any) => [r.key, r.value]));

  return {
    processor: map.get('payment_processor') || 'high_wire_payments',
    mode: (map.get('payment_mode') as 'test' | 'live') || 'test',
    clientId: map.get('payment_client_id') || null,
    apiKey: map.get('payment_api_key') || null,
    endpointUrl: map.get('payment_endpoint_url') || null,
    webhookSecret: map.get('payment_webhook_secret') || null,
  };
}

function generateIntentId(): string {
  return `pi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Service Methods ─────────────────────────────────────────────────

export const PaymentService = {
  /**
   * Load current payment processor configuration.
   * Returns mock config if nothing is configured yet.
   */
  async getConfig(): Promise<PaymentConfig> {
    return getPaymentConfig();
  },

  /**
   * Create a payment intent / invoice link for a customer to pay.
   *
   * MOCK: Logs intent, returns a mock token and payment URL.
   * REAL: Call High Wire API to create a payment session / invoice link.
   */
  async createPaymentIntent(options: {
    invoiceId: string;
    amount: number;
    currency?: string;
    customerEmail: string;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<PaymentIntent> {
    const config = await getPaymentConfig();

    // ── MOCK IMPLEMENTATION ────────────────────────────────────────
    console.log('[PaymentService.createPaymentIntent]', {
      processor: config.processor,
      mode: config.mode,
      ...options,
    });

    const intentId = generateIntentId();

    // Store intent in database for tracking
    await supabase.from('payment_intents').insert({
      id: intentId,
      invoice_id: options.invoiceId,
      amount: options.amount,
      currency: options.currency || 'USD',
      status: 'pending',
      processor: config.processor,
      mode: config.mode,
      payment_url: `#/pay/${intentId}`, // Mock internal URL
      customer_email: options.customerEmail,
      description: options.description || null,
      metadata: options.metadata || {},
    });

    // Return mock payment intent
    return {
      id: intentId,
      invoiceId: options.invoiceId,
      amount: options.amount,
      currency: options.currency || 'USD',
      status: 'pending',
      processorToken: `mock_token_${intentId}`,
      paymentUrl: `https://pay.microdos2.com/pay/${intentId}`, // Placeholder external URL
      createdAt: new Date().toISOString(),
      metadata: options.metadata || {},
    };
  },

  /**
   * Check status of a payment intent with the processor.
   *
   * MOCK: Returns pending unless status was manually updated.
   * REAL: Query High Wire API for transaction status.
   */
  async getPaymentStatus(intentId: string): Promise<PaymentIntent | null> {
    const { data, error } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('id', intentId)
      .maybeSingle();

    if (error || !data) {
      console.error('[PaymentService.getPaymentStatus] Not found:', intentId);
      return null;
    }

    return {
      id: data.id,
      invoiceId: data.invoice_id,
      amount: data.amount,
      currency: data.currency,
      status: data.status,
      processorToken: data.processor_token,
      paymentUrl: data.payment_url,
      createdAt: data.created_at,
      metadata: data.metadata || {},
    };
  },

  /**
   * Capture / confirm a payment after customer completes checkout.
   *
   * MOCK: Updates status to succeeded.
   * REAL: Call High Wire capture endpoint with processor token.
   */
  async capturePayment(intentId: string): Promise<PaymentResult> {
    const config = await getPaymentConfig();

    console.log('[PaymentService.capturePayment]', { intentId, processor: config.processor });

    // MOCK: always succeed
    const transactionId = `txn_${Date.now()}`;

    await supabase
      .from('payment_intents')
      .update({
        status: 'succeeded',
        transaction_id: transactionId,
        captured_at: new Date().toISOString(),
      })
      .eq('id', intentId);

    return {
      success: true,
      transactionId,
      errorMessage: null,
      receiptUrl: `https://pay.microdos2.com/receipt/${transactionId}`,
    };
  },

  /**
   * Refund a captured payment (partial or full).
   *
   * MOCK: Logs refund, returns mock refund ID.
   * REAL: Call High Wire refund endpoint with original transaction ID.
   */
  async refundPayment(options: {
    transactionId: string;
    amount: number;
    reason?: string;
  }): Promise<RefundResult> {
    const config = await getPaymentConfig();

    console.log('[PaymentService.refundPayment]', { processor: config.processor, ...options });

    // MOCK
    const refundId = `ref_${Date.now()}`;

    await supabase.from('payment_refunds').insert({
      id: refundId,
      transaction_id: options.transactionId,
      amount: options.amount,
      reason: options.reason || null,
      status: 'succeeded',
      processor: config.processor,
    });

    return {
      success: true,
      refundId,
      amountRefunded: options.amount,
      errorMessage: null,
    };
  },

  /**
   * Void / cancel a pending payment intent before capture.
   *
   * MOCK: Updates status to cancelled.
   * REAL: Call High Wire void endpoint.
   */
  async cancelPayment(intentId: string): Promise<boolean> {
    const config = await getPaymentConfig();

    console.log('[PaymentService.cancelPayment]', { intentId, processor: config.processor });

    const { error } = await supabase
      .from('payment_intents')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', intentId);

    return !error;
  },

  /**
   * Build a customer-facing payment link for an invoice.
   * Returns a URL the wholesaler/distributor can click to pay online.
   */
  async getInvoicePaymentUrl(invoiceId: string, amount: number, customerEmail: string): Promise<string | null> {
    const intent = await PaymentService.createPaymentIntent({
      invoiceId,
      amount,
      customerEmail,
      description: `Payment for Invoice ${invoiceId}`,
    });

    return intent.paymentUrl;
  },

  /**
   * Validate incoming webhook from payment processor.
   * Returns true if signature is valid.
   *
   * MOCK: Always returns true.
   * REAL: Verify HMAC signature using webhookSecret.
   */
  async validateWebhook(_payload: any, _signature: string): Promise<boolean> {
    const config = await getPaymentConfig();

    if (!config.webhookSecret) {
      console.warn('[PaymentService.validateWebhook] No webhook secret configured');
      return true; // In test mode, allow through
    }

    // REAL implementation: crypto.timingSafeEqual(hmac, signature)
    console.log('[PaymentService.validateWebhook] Mock validation passed');
    return true;
  },

  /**
   * Handle webhook events from the processor.
   * Updates payment_intents status based on processor events.
   */
  async handleWebhook(event: { type: string; data: any }): Promise<void> {
    console.log('[PaymentService.handleWebhook]', event);

    switch (event.type) {
      case 'payment.succeeded':
      case 'charge.success':
        await supabase
          .from('payment_intents')
          .update({ status: 'succeeded', transaction_id: event.data?.transaction_id || null })
          .eq('id', event.data?.intent_id);
        break;

      case 'payment.failed':
      case 'charge.failed':
        await supabase
          .from('payment_intents')
          .update({ status: 'failed', failure_message: event.data?.message || null })
          .eq('id', event.data?.intent_id);
        break;

      case 'payment.refunded':
        await supabase
          .from('payment_intents')
          .update({ status: 'refunded', refund_id: event.data?.refund_id || null })
          .eq('id', event.data?.intent_id);
        break;
    }
  },
};

// ─── Default Export ──────────────────────────────────────────────────
export default PaymentService;
