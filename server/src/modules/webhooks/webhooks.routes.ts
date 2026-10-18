import { FastifyInstance } from 'fastify';
import { WebhooksController } from './webhooks.controller.js';

export async function webhookRoutes(fastify: FastifyInstance) {
  fastify.post('/api/v1/webhooks/paypal', WebhooksController.handlePayPalWebhook);
}
