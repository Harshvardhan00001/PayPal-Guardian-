import { FastifyRequest, FastifyReply } from 'fastify';
import { AuditService } from '../../services/audit/audit-service.js';

export class AuditController {
  /**
   * GET /api/v1/transactions/:id/audit
   * Retrieves the immutable forensic timeline for a transaction.
   */
  public static async getTransactionTimeline(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    try {
      const timeline = await AuditService.getTransactionAuditTimeline(id);
      return reply.send({
        success: true,
        data: {
          transaction_id: id,
          event_count: timeline.length,
          timeline
        },
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch transaction audit timeline');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'AUDIT_FETCH_ERROR',
          message: err.message || 'Failed to fetch audit timeline'
        }
      });
    }
  }

  /**
   * GET /api/v1/audit
   * Retrieves recent audit logs across the platform.
   */
  public static async getRecentLogs(request: FastifyRequest, reply: FastifyReply) {
    const { limit } = request.query as { limit?: string };
    const numLimit = limit ? parseInt(limit, 10) : 50;

    try {
      const logs = await AuditService.getRecentAuditLogs(numLimit);
      return reply.send({
        success: true,
        data: logs,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch audit logs');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'AUDIT_FETCH_ERROR',
          message: err.message || 'Failed to retrieve audit logs'
        }
      });
    }
  }
}
