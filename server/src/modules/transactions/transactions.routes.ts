import { FastifyInstance } from 'fastify';
import { TransactionsController } from './transactions.controller.js';

export async function transactionRoutes(fastify: FastifyInstance) {
  fastify.post('/api/v1/transactions/proposals', TransactionsController.createProposal);
  fastify.get('/api/v1/transactions', TransactionsController.listTransactions);
  fastify.get('/api/v1/transactions/:id', TransactionsController.getTransaction);
  fastify.post('/api/v1/transactions/:id/approve', TransactionsController.approveTransaction);
  fastify.post('/api/v1/transactions/:id/reject', TransactionsController.rejectTransaction);
  fastify.patch('/api/v1/transactions/:id', TransactionsController.mutateProposal);
}
