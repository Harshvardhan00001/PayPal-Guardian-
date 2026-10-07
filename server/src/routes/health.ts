import { FastifyInstance } from 'fastify';
import { db } from '../db/prisma.js';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_request, reply) => {
    let dbStatus = 'connected';
    try {
      await db.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'disconnected';
    }

    return reply.send({
      status: 'ok',
      service: 'paypal-guardian-server',
      version: '1.0.0',
      database: dbStatus,
      timestamp: new Date().toISOString()
    });
  });
}
