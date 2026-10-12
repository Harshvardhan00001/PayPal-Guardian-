import { FastifyRequest, FastifyReply } from 'fastify';
import { TransactionsService } from './transactions.service.js';
import {
  createProposalSchema,
  approveTransactionSchema,
  rejectTransactionSchema,
  mutateProposalSchema
} from './transactions.schema.js';

export class TransactionsController {
  /**
   * POST /api/v1/transactions/proposals
   * AI Shopping Agent submits order proposal for policy evaluation.
   */
  public static async createProposal(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = createProposalSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid proposal payload',
          details: parseResult.error.flatten()
        }
      });
    }

    try {
      const data = await TransactionsService.createProposal(parseResult.data);
      const statusCode = data.decision === 'BLOCK' ? 200 : 201; // Proposals are accepted and acknowledged even when blocked
      return reply.status(statusCode).send({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      request.log.error(err, 'Failed to create transaction proposal');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'PROPOSAL_CREATE_ERROR',
          message: err.message || 'Failed to process transaction proposal'
        }
      });
    }
  }

  /**
   * GET /api/v1/transactions/:id
   * Retrieves single transaction details and live snapshot hash integrity check.
   */
  public static async getTransaction(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    try {
      const data = await TransactionsService.getTransactionById(id);
      if (!data) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'TRANSACTION_NOT_FOUND',
            message: `Transaction with ID '${id}' was not found.`
          }
        });
      }

      return reply.send({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      request.log.error(err, 'Failed to get transaction');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'TRANSACTION_FETCH_ERROR',
          message: err.message || 'Failed to retrieve transaction'
        }
      });
    }
  }

  /**
   * GET /api/v1/transactions
   * Lists all transactions.
   */
  public static async listTransactions(request: FastifyRequest, reply: FastifyReply) {
    const { user_id } = request.query as { user_id?: string };

    try {
      const data = await TransactionsService.listTransactions(user_id);
      return reply.send({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      request.log.error(err, 'Failed to list transactions');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'TRANSACTIONS_FETCH_ERROR',
          message: err.message || 'Failed to list transactions'
        }
      });
    }
  }

  /**
   * POST /api/v1/transactions/:id/approve
   * User signs off on the exact snapshot hash.
   */
  public static async approveTransaction(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const parseResult = approveTransactionSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid approval payload',
          details: parseResult.error.flatten()
        }
      });
    }

    try {
      const userId = parseResult.data.user_id || 'usr_demo_shopper';
      const data = await TransactionsService.approveTransaction(id, userId, parseResult.data.snapshot_hash);

      return reply.send({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      request.log.error(err, 'Failed to approve transaction');
      const isClientError =
        err.message.includes('mismatch') ||
        err.message.includes('expired') ||
        err.message.includes('mandatory policy bounds') ||
        err.message.includes('finalized') ||
        err.message.includes('modified');
      const status = isClientError ? 400 : 500;
      let errorCode = 'APPROVAL_ERROR';
      if (err.message.includes('mismatch')) errorCode = 'SNAPSHOT_HASH_MISMATCH';
      if (err.message.includes('mandatory policy bounds')) errorCode = 'POLICY_VIOLATION_BLOCKED';
      if (err.message.includes('modified')) errorCode = 'ORDER_CHANGED';

      return reply.status(status).send({
        success: false,
        error: {
          code: errorCode,
          message: err.message || 'Failed to approve transaction'
        }
      });
    }
  }

  /**
   * POST /api/v1/transactions/:id/reject
   * User declines proposal.
   */
  public static async rejectTransaction(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const parseResult = rejectTransactionSchema.safeParse(request.body);

    try {
      const userId = parseResult.success && parseResult.data.user_id ? parseResult.data.user_id : 'usr_demo_shopper';
      const reason = parseResult.success && parseResult.data.reason ? parseResult.data.reason : 'Rejected by user';
      const data = await TransactionsService.rejectTransaction(id, userId, reason);

      return reply.send({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      request.log.error(err, 'Failed to reject transaction');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'REJECTION_ERROR',
          message: err.message || 'Failed to reject transaction'
        }
      });
    }
  }

  /**
   * PATCH /api/v1/transactions/:id
   * Mutates proposal (triggers tamper detection if already approved).
   */
  public static async mutateProposal(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const parseResult = mutateProposalSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid mutation payload',
          details: parseResult.error.flatten()
        }
      });
    }

    try {
      const data = await TransactionsService.mutateProposal(id, parseResult.data);
      const status = data.is_tampered ? 409 : 200; // 409 Conflict when order was tampered after approval
      return reply.status(status).send({
        success: !data.is_tampered,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      request.log.error(err, 'Failed to mutate transaction proposal');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'MUTATION_ERROR',
          message: err.message || 'Failed to mutate proposal'
        }
      });
    }
  }
}
