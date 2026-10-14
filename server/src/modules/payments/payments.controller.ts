import { FastifyRequest, FastifyReply } from 'fastify';
import { PaymentsService } from './payments.service.js';
import { createPaymentOrderSchema, capturePaymentSchema } from './payments.schema.js';
import { TamperDetectedError, ApprovalExpiredError } from '../../core/security/tamper-guard.js';

export class PaymentsController {
  /**
   * POST /api/v1/payments/paypal/create-order
   * Initializes PayPal Orders v2 instance for an approved transaction.
   */
  public static async createOrder(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = createPaymentOrderSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid payment order request',
          details: parseResult.error.flatten()
        }
      });
    }

    try {
      const data = await PaymentsService.createPaymentOrder(parseResult.data.transaction_id);
      return reply.status(201).send({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      request.log.error(err, 'Failed to create PayPal order');

      if (err instanceof TamperDetectedError) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'ORDER_CHANGED',
            message: err.message,
            details: { expected_hash: err.expectedHash, actual_hash: err.actualHash }
          }
        });
      }

      const isClientError = err.message.includes('not found') || err.message.includes('required');
      return reply.status(isClientError ? 400 : 500).send({
        success: false,
        error: {
          code: 'PAYPAL_ORDER_CREATION_FAILED',
          message: err.message || 'Failed to initialize PayPal order'
        }
      });
    }
  }

  /**
   * POST /api/v1/payments/paypal/capture
   * Executes server-side capture of approved PayPal order after snapshot integrity check.
   */
  public static async capturePayment(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = capturePaymentSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid capture request',
          details: parseResult.error.flatten()
        }
      });
    }

    try {
      const data = await PaymentsService.capturePayment(
        parseResult.data.transaction_id,
        parseResult.data.paypal_order_id,
        parseResult.data.expected_snapshot_hash
      );

      return reply.send({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      request.log.error(err, 'Failed to capture PayPal payment');

      if (err instanceof TamperDetectedError) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'ORDER_CHANGED',
            message: 'Cart snapshot hash altered after authorization. Payment capture aborted.',
            details: {
              expected_hash: err.expectedHash,
              actual_hash: err.actualHash
            }
          }
        });
      }

      if (err instanceof ApprovalExpiredError) {
        return reply.status(410).send({
          success: false,
          error: {
            code: 'APPROVAL_EXPIRED',
            message: err.message,
            expired_at: err.expiredAt
          }
        });
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'PAYPAL_CAPTURE_FAILED',
          message: err.message || 'Failed to capture payment'
        }
      });
    }
  }
}
