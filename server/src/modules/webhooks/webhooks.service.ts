import { db } from '../../db/prisma.js';
import { PayPalWebhookVerifier, WebhookSignatureError } from '../../services/paypal/webhook-verifier.js';
import { AuditService } from '../../services/audit/audit-service.js';

const webhookVerifier = new PayPalWebhookVerifier();

export class WebhooksService {
  /**
   * Processes incoming PayPal webhook events with cryptographic validation and idempotent deduplication.
   */
  public static async processWebhook(headers: Record<string, string | string[] | undefined>, payload: any) {
    if (!payload || !payload.id || !payload.event_type) {
      throw new Error('Malformed webhook payload: missing event id or event_type.');
    }

    const eventId = payload.id;
    const eventType = payload.event_type;

    // 1. Idempotency Check: Avoid processing duplicated deliveries
    const existing = await db.webhookEvent.findUnique({
      where: { eventId }
    });

    if (existing) {
      return {
        event_id: eventId,
        event_type: eventType,
        status: 'ALREADY_PROCESSED',
        duplicate: true
      };
    }

    // 2. Cryptographic Signature Verification
    const isValid = await webhookVerifier.verifySignature(headers, payload);
    if (!isValid) {
      throw new WebhookSignatureError(`Cryptographic verification failed for webhook event '${eventId}'.`);
    }

    // 3. Persist Event in Database
    const webhookRecord = await db.webhookEvent.create({
      data: {
        eventId,
        eventType,
        payload: JSON.stringify(payload),
        processed: false
      }
    });

    // 4. Handle Event Transitions
    await this.handleEventStateSync(eventType, payload);

    // 5. Mark as Processed
    await db.webhookEvent.update({
      where: { id: webhookRecord.id },
      data: { processed: true }
    });

    return {
      event_id: eventId,
      event_type: eventType,
      status: 'PROCESSED',
      duplicate: false
    };
  }

  /**
   * Synchronizes database models with PayPal event status changes.
   */
  private static async handleEventStateSync(eventType: string, payload: any) {
    const resource = payload.resource || {};
    let transactionId: string | null = null;
    let paypalOrderId: string | null = null;

    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      paypalOrderId = resource.id;
      transactionId = resource.purchase_units?.[0]?.reference_id;

      if (transactionId) {
        await db.transactionProposal.update({
          where: { id: transactionId },
          data: { status: 'PAYPAL_APPROVED' }
        });

        await AuditService.logEvent(null, transactionId, 'PAYPAL_WEBHOOK_PROCESSED', 'PAYPAL_WEBHOOK', {
          event_type: eventType,
          status: 'PAYPAL_APPROVED',
          paypal_order_id: paypalOrderId
        });
      }
    } else if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const supplementary = resource.supplementary_data?.related_ids || {};
      paypalOrderId = supplementary.order_id || resource.id;
      transactionId = resource.custom_id || resource.invoice_id;

      // Try finding transaction by paypal order id if not directly in custom_id
      if (!transactionId && paypalOrderId) {
        const orderRecord = await db.payPalOrder.findUnique({
          where: { paypalOrderId }
        });
        if (orderRecord) {
          transactionId = orderRecord.transactionId;
        }
      }

      if (transactionId) {
        await db.transactionProposal.update({
          where: { id: transactionId },
          data: { status: 'COMPLETED' }
        });

        if (paypalOrderId) {
          await db.payPalOrder.updateMany({
            where: { paypalOrderId },
            data: { status: 'COMPLETED' }
          });
        }

        await AuditService.logEvent(null, transactionId, 'PAYPAL_WEBHOOK_PROCESSED', 'PAYPAL_WEBHOOK', {
          event_type: eventType,
          capture_id: resource.id,
          status: 'COMPLETED'
        });
      }
    } else if (eventType === 'PAYMENT.CAPTURE.DENIED' || eventType === 'PAYMENT.CAPTURE.DECLINED') {
      const supplementary = resource.supplementary_data?.related_ids || {};
      paypalOrderId = supplementary.order_id;

      if (paypalOrderId) {
        const orderRecord = await db.payPalOrder.findUnique({
          where: { paypalOrderId }
        });
        if (orderRecord) {
          transactionId = orderRecord.transactionId;
        }
      }

      if (transactionId) {
        await db.transactionProposal.update({
          where: { id: transactionId },
          data: { status: 'FAILED' }
        });

        await AuditService.logEvent(null, transactionId, 'PAYPAL_WEBHOOK_PROCESSED', 'PAYPAL_WEBHOOK', {
          event_type: eventType,
          status: 'FAILED',
          reason: resource.status_details?.reason || 'Payment denied by PayPal'
        });
      }
    }
  }
}
