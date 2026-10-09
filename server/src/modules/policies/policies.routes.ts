import { FastifyInstance } from 'fastify';
import { PolicyController } from './policies.controller.js';

export async function policyRoutes(fastify: FastifyInstance) {
  fastify.post('/api/v1/policies/parse', PolicyController.parsePolicy);
  fastify.post('/api/v1/policies', PolicyController.createPolicy);
  fastify.get('/api/v1/policies', PolicyController.listPolicies);
  fastify.get('/api/v1/policies/:id', PolicyController.getPolicy);
}
