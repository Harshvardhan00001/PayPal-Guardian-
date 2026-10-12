import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/index.js';
import { db } from '../../src/db/prisma.js';

describe('Transaction Proposals & Tamper Guard Integration Tests', () => {
  let server: any;
  const policyId = 'pol_running_shoes_default'; // Seeded in Sprint 1

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
    await db.$disconnect();
  });

  it('1. Ingests valid proposal and deterministically evaluates to ASK', async () => {
    const payload = {
      user_id: 'usr_demo_shopper',
      policy_id: policyId,
      merchant: 'Nike Official Store',
      currency: 'INR',
      items: [
        {
          sku: 'NK-PEG-40',
          name: 'Nike Air Zoom Pegasus 40',
          category: 'running_shoes',
          quantity: 1,
          unit_price: 7499
        }
      ],
      shipping: 0,
      tax: 0,
      fees: 0,
      recurring: false
    };

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/transactions/proposals',
      payload
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.data.decision).toBe('ASK');
    expect(body.data.status).toBe('ASK');
    expect(body.data.snapshot_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(body.data.summary.total).toBe(7499);
    expect(body.data.reasons.some((r: any) => r.code === 'APPROVAL_REQUIRED')).toBe(true);
  });

  it('2. User approves transaction with exact matching snapshot hash', async () => {
    // Create proposal
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/v1/transactions/proposals',
      payload: {
        user_id: 'usr_demo_shopper',
        policy_id: policyId,
        merchant: 'Adidas Store',
        currency: 'INR',
        items: [
          {
            sku: 'AD-UB-23',
            name: 'Adidas Ultraboost Light',
            category: 'running_shoes',
            quantity: 1,
            unit_price: 7800
          }
        ],
        shipping: 0,
        tax: 0,
        fees: 0,
        recurring: false
      }
    });

    const createBody = JSON.parse(createRes.payload);
    const txId = createBody.data.transaction_id;
    const snapshotHash = createBody.data.snapshot_hash;

    // Approve with exact hash
    const approveRes = await server.inject({
      method: 'POST',
      url: `/api/v1/transactions/${txId}/approve`,
      payload: {
        user_id: 'usr_demo_shopper',
        snapshot_hash: snapshotHash
      }
    });

    expect(approveRes.statusCode).toBe(200);
    const approveBody = JSON.parse(approveRes.payload);
    expect(approveBody.success).toBe(true);
    expect(approveBody.data.status).toBe('USER_APPROVED');
    expect(approveBody.data.snapshot_hash).toBe(snapshotHash);

    // Verify database record
    const getRes = await server.inject({
      method: 'GET',
      url: `/api/v1/transactions/${txId}`
    });
    const getBody = JSON.parse(getRes.payload);
    expect(getBody.data.status).toBe('USER_APPROVED');
    expect(getBody.data.approval).toBeDefined();
    expect(getBody.data.is_hash_intact).toBe(true);
  });

  it('3. Rejects approval attempt if snapshot hash does NOT match', async () => {
    // Create proposal
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/v1/transactions/proposals',
      payload: {
        user_id: 'usr_demo_shopper',
        policy_id: policyId,
        merchant: 'Puma Store',
        currency: 'INR',
        items: [
          {
            sku: 'PM-NITRO-01',
            name: 'Puma Deviate Nitro',
            category: 'running_shoes',
            quantity: 1,
            unit_price: 6999
          }
        ],
        shipping: 0,
        tax: 0,
        fees: 0,
        recurring: false
      }
    });

    const createBody = JSON.parse(createRes.payload);
    const txId = createBody.data.transaction_id;

    // Attempt approval with altered hash
    const fakeHash = '1111111111111111111111111111111111111111111111111111111111111111';
    const approveRes = await server.inject({
      method: 'POST',
      url: `/api/v1/transactions/${txId}/approve`,
      payload: {
        user_id: 'usr_demo_shopper',
        snapshot_hash: fakeHash
      }
    });

    expect(approveRes.statusCode).toBe(400);
    const approveBody = JSON.parse(approveRes.payload);
    expect(approveBody.success).toBe(false);
    expect(approveBody.error.code).toBe('SNAPSHOT_HASH_MISMATCH');
  });

  it('4. Blocks proposal when budget exceeds limit (Total ₹9,200 > ₹8,000)', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/transactions/proposals',
      payload: {
        user_id: 'usr_demo_shopper',
        policy_id: policyId,
        merchant: 'Luxury Running Boutique',
        currency: 'INR',
        items: [
          {
            sku: 'LUX-RUN-01',
            name: 'Carbon Fiber Pro',
            category: 'running_shoes',
            quantity: 1,
            unit_price: 8500
          }
        ],
        shipping: 300,
        tax: 400,
        fees: 0,
        recurring: false
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.data.decision).toBe('BLOCK');
    expect(body.data.status).toBe('BLOCK');
    expect(body.data.reasons.some((r: any) => r.code === 'BUDGET_EXCEEDED')).toBe(true);

    // Cannot approve a blocked proposal
    const approveRes = await server.inject({
      method: 'POST',
      url: `/api/v1/transactions/${body.data.transaction_id}/approve`,
      payload: {
        snapshot_hash: body.data.snapshot_hash
      }
    });
    expect(approveRes.statusCode).toBe(400);
    const approveBody = JSON.parse(approveRes.payload);
    expect(approveBody.error.code).toBe('POLICY_VIOLATION_BLOCKED');
    expect(approveBody.error.message).toContain('violates mandatory policy bounds');
  });

  it('5. Blocks proposal when recurring subscription is present', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/transactions/proposals',
      payload: {
        user_id: 'usr_demo_shopper',
        policy_id: policyId,
        merchant: 'Sneaker Club',
        currency: 'INR',
        items: [
          {
            sku: 'SC-SHOE',
            name: 'Running Shoes Monthly',
            category: 'running_shoes',
            quantity: 1,
            unit_price: 5000
          }
        ],
        shipping: 0,
        tax: 0,
        fees: 0,
        recurring: true // subscription charge
      }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.decision).toBe('BLOCK');
    expect(body.data.reasons.some((r: any) => r.code === 'RECURRING_NOT_ALLOWED')).toBe(true);
  });

  it('6. The Tamper Demo: Order mutated after user approval triggers ORDER_CHANGED and revokes approval', async () => {
    // Step A: AI Agent proposes valid order for ₹7,499
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/v1/transactions/proposals',
      payload: {
        user_id: 'usr_demo_shopper',
        policy_id: policyId,
        merchant: 'Pegasus Store',
        currency: 'INR',
        items: [
          {
            sku: 'NK-PEG-01',
            name: 'Nike Pegasus',
            category: 'running_shoes',
            quantity: 1,
            unit_price: 7499
          }
        ],
        shipping: 0,
        tax: 0,
        fees: 0,
        recurring: false
      }
    });

    const createBody = JSON.parse(createRes.payload);
    const txId = createBody.data.transaction_id;
    const originalHash = createBody.data.snapshot_hash;

    // Step B: User approves exact order
    const approveRes = await server.inject({
      method: 'POST',
      url: `/api/v1/transactions/${txId}/approve`,
      payload: {
        user_id: 'usr_demo_shopper',
        snapshot_hash: originalHash
      }
    });
    expect(approveRes.statusCode).toBe(200);
    expect(JSON.parse(approveRes.payload).data.status).toBe('USER_APPROVED');

    // Step C: Rogue agent silently mutates cart (injects ₹500 warranty fee)
    const mutateRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/transactions/${txId}`,
      payload: {
        fees: 500
      }
    });

    expect(mutateRes.statusCode).toBe(409); // 409 Conflict
    const mutateBody = JSON.parse(mutateRes.payload);
    expect(mutateBody.success).toBe(false);
    expect(mutateBody.data.is_tampered).toBe(true);
    expect(mutateBody.data.status).toBe('ORDER_CHANGED');
    expect(mutateBody.data.previous_hash).toBe(originalHash);
    expect(mutateBody.data.new_snapshot_hash).not.toBe(originalHash);

    // Step D: Confirm database status is now ORDER_CHANGED and approval was deleted
    const verifyRes = await server.inject({
      method: 'GET',
      url: `/api/v1/transactions/${txId}`
    });
    const verifyBody = JSON.parse(verifyRes.payload);
    expect(verifyBody.data.status).toBe('ORDER_CHANGED');
    expect(verifyBody.data.approval).toBeNull(); // prior approval revoked
  });
});
