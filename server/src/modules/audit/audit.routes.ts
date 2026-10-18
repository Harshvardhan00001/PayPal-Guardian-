import { FastifyInstance } from 'fastify';
import { AuditController } from './audit.controller.js';

export async function auditRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/transactions/:id/audit', AuditController.getTransactionTimeline);
  fastify.get('/api/v1/audit', AuditController.getRecentLogs);
}
