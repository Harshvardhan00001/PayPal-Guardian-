import { db } from '../../db/prisma.js';

export interface AuditTimelineItem {
  id: string;
  timestamp: string;
  event_type: string;
  actor: string;
  title: string;
  description: string;
  metadata: Record<string, any>;
  verified: boolean;
}

export class AuditService {
  /**
   * Appends an immutable forensic audit event.
   */
  public static async logEvent(
    userId: string | null | undefined,
    transactionId: string | null | undefined,
    eventType: string,
    actor: 'USER' | 'AI_AGENT' | 'POLICY_ENGINE' | 'PAYPAL_SERVICE' | 'PAYPAL_WEBHOOK',
    metadata: Record<string, any> = {}
  ) {
    return await db.auditEvent.create({
      data: {
        userId: userId || null,
        transactionId: transactionId || null,
        eventType,
        actor,
        metadata: JSON.stringify(metadata)
      }
    });
  }

  /**
   * Generates a chronological forensic audit timeline for a transaction.
   */
  public static async getTransactionAuditTimeline(transactionId: string): Promise<AuditTimelineItem[]> {
    const events = await db.auditEvent.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'asc' }
    });

    return events.map((ev) => {
      let parsedMetadata: Record<string, any> = {};
      try {
        parsedMetadata = JSON.parse(ev.metadata);
      } catch {
        parsedMetadata = {};
      }

      const { title, description } = this.formatEventNarrative(ev.eventType, ev.actor, parsedMetadata);

      return {
        id: ev.id,
        timestamp: ev.createdAt.toISOString(),
        event_type: ev.eventType,
        actor: ev.actor,
        title,
        description,
        metadata: parsedMetadata,
        verified: true
      };
    });
  }

  /**
   * Generates recent audit events across the platform.
   */
  public static async getRecentAuditLogs(limit = 50) {
    const events = await db.auditEvent.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        transaction: true
      }
    });

    return events.map((ev) => {
      let metadata: Record<string, any> = {};
      try {
        metadata = JSON.parse(ev.metadata);
      } catch {
        metadata = {};
      }

      return {
        id: ev.id,
        timestamp: ev.createdAt.toISOString(),
        event_type: ev.eventType,
        actor: ev.actor,
        transaction_id: ev.transactionId,
        user_name: ev.user?.name || 'System / Anonymous',
        metadata
      };
    });
  }

  /**
   * Translates raw event data into clear, human-readable forensic timeline text.
   */
  private static formatEventNarrative(eventType: string, actor: string, metadata: Record<string, any>) {
    switch (eventType) {
      case 'ORDER_PROPOSED':
        return {
          title: 'Order Proposal Ingested',
          description: `AI Agent proposed order from '${metadata.merchant || 'Store'}' totaling ₹${metadata.total?.toLocaleString() || '0'}. Snapshot hash computed.`
        };
      case 'POLICY_EVALUATED':
        return {
          title: `Deterministic Decision: ${metadata.decision || 'EVALUATED'}`,
          description:
            metadata.decision === 'ALLOW'
              ? 'Order satisfies all policy bounds. Direct payment permitted.'
              : metadata.decision === 'ASK'
              ? 'Order satisfies spending rules. Explicit human approval required before checkout.'
              : 'Order violates mandatory financial boundaries. Payment blocked.'
        };
      case 'USER_APPROVED':
        return {
          title: 'User Authorization Granted',
          description: `User cryptographically approved snapshot hash '${(metadata.snapshot_hash || '').substring(0, 16)}...'.`
        };
      case 'USER_REJECTED':
        return {
          title: 'User Declined Proposal',
          description: `User declined proposed order. Reason: ${metadata.reason || 'User cancelled'}.`
        };
      case 'ORDER_TAMPERING_DETECTED':
        return {
          title: '🚨 Tampering Detected (Authorization Revoked)',
          description: 'Cart contents or price modified after approval. Prior authorization immediately revoked.'
        };
      case 'PAYPAL_ORDER_CREATED':
        return {
          title: 'PayPal Orders v2 Instantiated',
          description: `Server-side PayPal Order '${metadata.paypal_order_id}' created for checkout.`
        };
      case 'PAYMENT_CAPTURED':
        return {
          title: 'Payment Successfully Captured',
          description: `PayPal capture '${metadata.capture_id}' finalized for ₹${metadata.amount?.value || metadata.amount}.`
        };
      case 'PAYPAL_WEBHOOK_PROCESSED':
        return {
          title: 'PayPal Webhook Verified',
          description: `Asynchronous payment status update verified from PayPal: ${metadata.event_type || 'Event'}.`
        };
      default:
        return {
          title: eventType.replace(/_/g, ' '),
          description: `Recorded by ${actor}.`
        };
    }
  }
}
