import { describe, it, expect, afterAll } from 'vitest';
import { buildServer } from '../../src/index.js';
import { db } from '../../src/db/prisma.js';

describe('Health Check Endpoint', () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it('GET /health returns 200 OK and connected database', async () => {
    const server = await buildServer();
    const response = await server.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('paypal-guardian-server');
    expect(body.database).toBe('connected');
  });
});
