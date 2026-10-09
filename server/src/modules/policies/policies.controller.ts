import { FastifyRequest, FastifyReply } from 'fastify';
import { AIService } from '../../services/ai/ai-service.js';
import { PolicyService } from './policies.service.js';
import { parsePolicySchema, createPolicySchema } from './policies.schema.js';

const aiService = new AIService();

export class PolicyController {
  /**
   * POST /api/v1/policies/parse
   * Converts natural language into structured policy rules.
   */
  public static async parsePolicy(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = parsePolicySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request payload',
          details: parseResult.error.flatten()
        }
      });
    }

    try {
      const data = await aiService.parsePolicy(parseResult.data.text);
      return reply.send({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      request.log.error(err, 'Failed to parse policy text');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'AI_PARSER_ERROR',
          message: err.message || 'Failed to parse policy text'
        }
      });
    }
  }

  /**
   * POST /api/v1/policies
   * Creates and activates a new policy.
   */
  public static async createPolicy(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = createPolicySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request payload',
          details: parseResult.error.flatten()
        }
      });
    }

    try {
      const policy = await PolicyService.createPolicy(parseResult.data);
      return reply.status(201).send({
        success: true,
        data: policy,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      request.log.error(err, 'Failed to create policy');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'POLICY_CREATE_ERROR',
          message: err.message || 'Failed to create policy'
        }
      });
    }
  }

  /**
   * GET /api/v1/policies
   * Lists policies.
   */
  public static async listPolicies(request: FastifyRequest, reply: FastifyReply) {
    const { user_id } = request.query as { user_id?: string };
    try {
      const policies = await PolicyService.listPolicies(user_id);
      return reply.send({
        success: true,
        data: policies,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      request.log.error(err, 'Failed to list policies');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'POLICY_FETCH_ERROR',
          message: err.message || 'Failed to list policies'
        }
      });
    }
  }

  /**
   * GET /api/v1/policies/:id
   * Retrieves single policy details.
   */
  public static async getPolicy(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    try {
      const policy = await PolicyService.getPolicyById(id);
      if (!policy) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'POLICY_NOT_FOUND',
            message: `Policy with ID '${id}' was not found.`
          }
        });
      }

      return reply.send({
        success: true,
        data: policy,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      request.log.error(err, 'Failed to get policy');
      return reply.status(500).send({
        success: false,
        error: {
          code: 'POLICY_FETCH_ERROR',
          message: err.message || 'Failed to get policy'
        }
      });
    }
  }
}
