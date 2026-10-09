import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/index.js';
import { db } from '../../src/db/prisma.js';

describe('Policy API Integration Tests', () => {
  let server: any;

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
    await db.$disconnect();
  });

  it('POST /api/v1/policies/parse extracts structured policy from natural language', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/policies/parse',
      payload: {
        text: 'Buy running shoes under ₹8000, no subscriptions, ask before paying'
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.data.interpreted_policy).toBeDefined();

    const rules = body.data.interpreted_policy.rules;
    expect(rules.max_amount).toBe(8000);
    expect(rules.currency).toBe('INR');
    expect(rules.recurring_allowed).toBe(false);
    expect(rules.approval_required).toBe(true);
    expect(rules.allowed_categories).toContain('running_shoes');
    expect(body.data.summary_bullets.length).toBeGreaterThan(0);
  });

  it('POST /api/v1/policies/parse returns 400 for empty or invalid text', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/policies/parse',
      payload: { text: '' }
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/policies creates and activates a new policy in the database', async () => {
    const payload = {
      user_id: 'usr_demo_shopper',
      name: 'Sprint 2 Test Policy',
      description: 'Test policy for automated testing',
      rules: {
        max_amount: 5000,
        currency: 'INR',
        max_quantity: 1,
        allowed_categories: ['groceries'],
        blocked_categories: ['alcohol'],
        allowed_merchants: [],
        blocked_merchants: [],
        recurring_allowed: false,
        approval_required: true,
        recheck_on_change: true
      }
    };

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/policies',
      payload
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.data.policy_id).toBeDefined();
    expect(body.data.version).toBe(1);
    expect(body.data.status).toBe('ACTIVE');
    expect(body.data.rules.max_amount).toBe(5000);
  });

  it('GET /api/v1/policies returns the list of policies', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/policies'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/policies/:id returns details with version history', async () => {
    // Fetch seeded policy
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/policies/pol_running_shoes_default'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('pol_running_shoes_default');
    expect(body.data.version_history.length).toBeGreaterThan(0);
    expect(body.data.active_rules.max_amount).toBe(8000);
  });
});
