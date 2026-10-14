import { FastifyInstance } from 'fastify';
import { PaymentsController } from './payments.controller.js';

export async function paymentRoutes(fastify: FastifyInstance) {
  fastify.post('/api/v1/payments/paypal/create-order', PaymentsController.createOrder);
  fastify.post('/api/v1/payments/paypal/capture', PaymentsController.capturePayment);
}
