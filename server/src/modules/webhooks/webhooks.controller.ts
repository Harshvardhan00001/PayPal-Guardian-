import { FastifyRequest, FastifyReply } from 'fastify';
import { WebhooksService } from './webhooks.service.js';
import { WebhookSignatureError } from '../../services/paypal/webhook-verifier.js';

export class WebhooksController {
  /**
   * POST /api/v1/webhooks/paypal
   * Handles incoming PayPal webhook notifications with cryptographic verification.
   */
  public static async handlePayPalWebhook(request: FastifyRequest, reply: FastifyReply) {
    try {
      const headers = request.headers as Record<string, string | string[] | undefined>;
      const payload = request.body;

      const result = await WebhooksService.processWebhook(headers, payload);

      return reply.status(200).send({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      if (err instanceof WebhookSignatureError) {
        request.log.warn({ err }, 'PayPal webhook signature verification failed');
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_WEBHOOK_SIGNATURE',
            message: err.message
          }
        });
      }

      if (err.message && err.message.includes('Malformed webhook payload')) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'MALFORMED_WEBHOOK_PAYLOAD',
            message: err.message
          }
        });
      }

      request.log.error({ err }, 'Error processing PayPal webhook');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'WEBHOOK_PROCESSING_ERROR',
          message: err.message || 'Internal error processing webhook'
        }
      });
    }
  }
}
