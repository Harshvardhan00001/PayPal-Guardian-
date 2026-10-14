import { db } from '../../db/prisma.js';
import { PayPalOrderService } from '../../services/paypal/paypal-order-service.js';
import { SnapshotHasher } from '../../core/crypto/snapshot-hasher.js';
import { TamperGuard, TamperDetectedError } from '../../core/security/tamper-guard.js';
import { CartProposal } from '../../core/policy-engine/types.js';

const paypalOrderService = new PayPalOrderService();

export class PaymentsService {
  /**
   * Creates a PayPal checkout order for a verified and approved transaction.
   */
  public static async createPaymentOrder(transactionId: string) {
    const proposal = await db.transactionProposal.findUnique({
      where: { id: transactionId },
      include: {
        items: true,
        paypalOrders: true,
        approvals: { orderBy: { approvedAt: 'desc' }, take: 1 }
      }
    });

    if (!proposal) {
      throw new Error(`Transaction proposal '${transactionId}' not found.`);
    }

    // Only USER_APPROVED or ALLOW transactions can initiate payment
    const isPermitted = proposal.status === 'USER_APPROVED' || proposal.status === 'ALLOW';
    if (!isPermitted) {
      throw new Error(
        `Cannot create PayPal order for transaction with status '${proposal.status}'. Human approval is required.`
      );
    }

    // Check if an order was already created (idempotency)
    const existingOrder = proposal.paypalOrders[0];
    if (existingOrder) {
      return {
        transaction_id: transactionId,
        paypal_order_id: existingOrder.paypalOrderId,
        status: proposal.status,
        snapshot_hash: proposal.snapshotHash,
        approval_url: `https://www.sandbox.paypal.com/checkoutnow?token=${existingOrder.paypalOrderId}`
      };
    }

    // Reconstruct CartProposal
    const cartProposal: CartProposal = {
      merchant: proposal.merchant,
      currency: proposal.currency,
      items: proposal.items.map((i) => ({
        sku: i.sku || 'N/A',
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        unit_price: Number(i.unitPrice),
        total_price: Number(i.totalPrice)
      })),
      subtotal: Number(proposal.subtotal),
      shipping: Number(proposal.shipping),
      tax: Number(proposal.tax),
      fees: Number(proposal.fees),
      total: Number(proposal.total),
      recurring: proposal.recurring
    };

    // Verify hash integrity before contacting PayPal
    const currentHash = SnapshotHasher.computeHash(cartProposal);
    if (currentHash.toLowerCase() !== proposal.snapshotHash.toLowerCase()) {
      await db.transactionProposal.update({
        where: { id: transactionId },
        data: { status: 'ORDER_CHANGED' }
      });
      throw new TamperDetectedError('Order hash mismatch prior to order creation.', proposal.snapshotHash, currentHash);
    }

    // Call PayPal Orders v2 API
    const orderResult = await paypalOrderService.createOrder(cartProposal, transactionId);

    // Save paypal_orders record and update proposal status
    await db.payPalOrder.create({
      data: {
        transactionId,
        paypalOrderId: orderResult.orderId,
        intent: 'CAPTURE',
        status: 'CREATED',
        amount: proposal.total,
        currency: proposal.currency,
        rawPayPalResponse: JSON.stringify(orderResult.rawResponse)
      }
    });

    await db.transactionProposal.update({
      where: { id: transactionId },
      data: { status: 'PAYPAL_CREATED' }
    });

    // Write audit event
    await db.auditEvent.create({
      data: {
        userId: proposal.userId,
        transactionId,
        eventType: 'PAYPAL_ORDER_CREATED',
        actor: 'PAYPAL_SERVICE',
        metadata: JSON.stringify({
          paypal_order_id: orderResult.orderId,
          amount: Number(proposal.total),
          currency: proposal.currency
        })
      }
    });

    return {
      transaction_id: transactionId,
      paypal_order_id: orderResult.orderId,
      approval_url: orderResult.approvalUrl,
      status: 'PAYPAL_CREATED',
      snapshot_hash: currentHash
    };
  }

  /**
   * Captures an approved PayPal payment after enforcing strict snapshot hash assertion.
   */
  public static async capturePayment(transactionId: string, paypalOrderId: string, expectedSnapshotHash: string) {
    const proposal = await db.transactionProposal.findUnique({
      where: { id: transactionId },
      include: {
        items: true,
        paypalOrders: true,
        approvals: { orderBy: { approvedAt: 'desc' }, take: 1 }
      }
    });

    if (!proposal) {
      throw new Error(`Transaction proposal '${transactionId}' not found.`);
    }

    // Reconstruct current CartProposal
    const currentCart: CartProposal = {
      merchant: proposal.merchant,
      currency: proposal.currency,
      items: proposal.items.map((i) => ({
        sku: i.sku || 'N/A',
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        unit_price: Number(i.unitPrice),
        total_price: Number(i.totalPrice)
      })),
      subtotal: Number(proposal.subtotal),
      shipping: Number(proposal.shipping),
      tax: Number(proposal.tax),
      fees: Number(proposal.fees),
      total: Number(proposal.total),
      recurring: proposal.recurring
    };

    // 1. STRICT PRE-CAPTURE TAMPER INTEGRITY CHECK
    try {
      TamperGuard.assertSnapshotIntegrity(currentCart, expectedSnapshotHash);
    } catch (err: any) {
      if (err instanceof TamperDetectedError) {
        // Automatically revoke approval and set ORDER_CHANGED
        await db.approval.deleteMany({ where: { transactionId } });
        await db.transactionProposal.update({
          where: { id: transactionId },
          data: { status: 'ORDER_CHANGED' }
        });
        await db.auditEvent.create({
          data: {
            userId: proposal.userId,
            transactionId,
            eventType: 'ORDER_TAMPERING_DETECTED',
            actor: 'POLICY_ENGINE',
            metadata: JSON.stringify({
              reason: 'Snapshot hash mismatch during PayPal payment capture attempt',
              expected_hash: err.expectedHash,
              actual_hash: err.actualHash
            })
          }
        });
      }
      throw err;
    }

    // 2. Check approval session expiration if an approval exists
    const approval = proposal.approvals[0];
    if (approval) {
      TamperGuard.assertApprovalNotExpired(approval.expiresAt);
    }

    // 3. Execute PayPal Capture
    const captureResult = await paypalOrderService.captureOrder(paypalOrderId, transactionId, {
      currency: proposal.currency,
      value: Number(proposal.total)
    });

    // 4. Update Database records to COMPLETED
    await db.payPalOrder.updateMany({
      where: { paypalOrderId },
      data: {
        status: 'COMPLETED',
        updatedAt: new Date()
      }
    });

    await db.transactionProposal.update({
      where: { id: transactionId },
      data: {
        status: 'COMPLETED',
        updatedAt: new Date()
      }
    });

    // 5. Forensic audit log
    await db.auditEvent.create({
      data: {
        userId: proposal.userId,
        transactionId,
        eventType: 'PAYMENT_CAPTURED',
        actor: 'PAYPAL_SERVICE',
        metadata: JSON.stringify({
          paypal_order_id: paypalOrderId,
          capture_id: captureResult.captureId,
          amount: captureResult.amount,
          completed_at: new Date().toISOString()
        })
      }
    });

    return {
      transaction_id: transactionId,
      paypal_order_id: paypalOrderId,
      capture_id: captureResult.captureId,
      status: 'COMPLETED',
      captured_amount: captureResult.amount,
      completed_at: new Date().toISOString()
    };
  }
}
