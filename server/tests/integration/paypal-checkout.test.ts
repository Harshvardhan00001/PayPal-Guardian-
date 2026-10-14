import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/index.js';
import { db } from '../../src/db/prisma.js';

describe('PayPal Checkout Flow Integration Tests', () => {
  let server: any;
  const policyId = 'pol_running_shoes_default';

  beforeAll(async () => {
    server = await buildServer();
  });

  afterAll(async () => {
    await server.close();
    await db.$disconnect();
  });

  it('1. Blocks PayPal order creation if transaction is not yet approved by human', async () => {
    // Create proposal (status = ASK)
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/v1/transactions/proposals',
      payload: {
        user_id: 'usr_demo_shopper',
        policy_id: policyId,
        merchant: 'Nike Store',
        currency: 'INR',
        items: [
          {
            sku: 'NK-PEG',
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

    const txId = JSON.parse(createRes.payload).data.transaction_id;

    // Attempt to create PayPal order without user approval
    const payRes = await server.inject({
      method: 'POST',
      url: '/api/v1/payments/paypal/create-order',
      payload: { transaction_id: txId }
    });

    expect(payRes.statusCode).toBe(400);
    const payBody = JSON.parse(payRes.payload);
    expect(payBody.success).toBe(false);
    expect(payBody.error.message).toContain('Human approval is required');
  });

  it('2. Successfully creates PayPal Order v2 after human approval', async () => {
    // Step A: Create proposal
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/v1/transactions/proposals',
      payload: {
        user_id: 'usr_demo_shopper',
        policy_id: policyId,
        merchant: 'Nike Store',
        currency: 'INR',
        items: [
          {
            sku: 'NK-PEG',
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

    const createData = JSON.parse(createRes.payload).data;
    const txId = createData.transaction_id;
    const snapshotHash = createData.snapshot_hash;

    // Step B: User approves
    const approveRes = await server.inject({
      method: 'POST',
      url: `/api/v1/transactions/${txId}/approve`,
      payload: { snapshot_hash: snapshotHash }
    });
    expect(approveRes.statusCode).toBe(200);

    // Step C: Create PayPal order
    const payRes = await server.inject({
      method: 'POST',
      url: '/api/v1/payments/paypal/create-order',
      payload: { transaction_id: txId }
    });

    expect(payRes.statusCode).toBe(201);
    const payBody = JSON.parse(payRes.payload);
    expect(payBody.success).toBe(true);
    expect(payBody.data.status).toBe('PAYPAL_CREATED');
    expect(payBody.data.paypal_order_id).toBeDefined();
    expect(payBody.data.approval_url).toContain('https://www.sandbox.paypal.com/checkoutnow');
  });

  it('3. Successfully captures PayPal payment when snapshot hash is intact', async () => {
    // Step A: Propose & Approve
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
            sku: 'AD-UB',
            name: 'Adidas Ultraboost',
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

    const createData = JSON.parse(createRes.payload).data;
    const txId = createData.transaction_id;
    const snapshotHash = createData.snapshot_hash;

    await server.inject({
      method: 'POST',
      url: `/api/v1/transactions/${txId}/approve`,
      payload: { snapshot_hash: snapshotHash }
    });

    // Step B: Create PayPal order
    const payRes = await server.inject({
      method: 'POST',
      url: '/api/v1/payments/paypal/create-order',
      payload: { transaction_id: txId }
    });
    const paypalOrderId = JSON.parse(payRes.payload).data.paypal_order_id;

    // Step C: Capture payment
    const captureRes = await server.inject({
      method: 'POST',
      url: '/api/v1/payments/paypal/capture',
      payload: {
        transaction_id: txId,
        paypal_order_id: paypalOrderId,
        expected_snapshot_hash: snapshotHash
      }
    });

    expect(captureRes.statusCode).toBe(200);
    const captureBody = JSON.parse(captureRes.payload);
    expect(captureBody.success).toBe(true);
    expect(captureBody.data.status).toBe('COMPLETED');
    expect(captureBody.data.capture_id).toBeDefined();

    // Verify DB status is COMPLETED
    const getRes = await server.inject({
      method: 'GET',
      url: `/api/v1/transactions/${txId}`
    });
    expect(JSON.parse(getRes.payload).data.status).toBe('COMPLETED');
  });

  it('4. Aborts PayPal capture with 409 Conflict if snapshot hash does NOT match (Tamper Protection)', async () => {
    // Step A: Propose & Approve
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
            sku: 'PM-NITRO',
            name: 'Puma Nitro',
            category: 'running_shoes',
            quantity: 1,
            unit_price: 6500
          }
        ],
        shipping: 0,
        tax: 0,
        fees: 0,
        recurring: false
      }
    });

    const createData = JSON.parse(createRes.payload).data;
    const txId = createData.transaction_id;
    const originalHash = createData.snapshot_hash;

    await server.inject({
      method: 'POST',
      url: `/api/v1/transactions/${txId}/approve`,
      payload: { snapshot_hash: originalHash }
    });

    const payRes = await server.inject({
      method: 'POST',
      url: '/api/v1/payments/paypal/create-order',
      payload: { transaction_id: txId }
    });
    const paypalOrderId = JSON.parse(payRes.payload).data.paypal_order_id;

    // Step B: Rogue agent mutates cart before capture (adds ₹500 fee)
    await server.inject({
      method: 'PATCH',
      url: `/api/v1/transactions/${txId}`,
      payload: { fees: 500 }
    });

    // Step C: Attempt to capture with the old snapshot hash
    const captureRes = await server.inject({
      method: 'POST',
      url: '/api/v1/payments/paypal/capture',
      payload: {
        transaction_id: txId,
        paypal_order_id: paypalOrderId,
        expected_snapshot_hash: originalHash
      }
    });

    expect(captureRes.statusCode).toBe(409); // 409 Conflict
    const captureBody = JSON.parse(captureRes.payload);
    expect(captureBody.success).toBe(false);
    expect(captureBody.error.code).toBe('ORDER_CHANGED');
    expect(captureBody.error.message).toContain('Payment capture aborted');

    // Verify DB status remains ORDER_CHANGED, not COMPLETED
    const getRes = await server.inject({
      method: 'GET',
      url: `/api/v1/transactions/${txId}`
    });
    expect(JSON.parse(getRes.payload).data.status).toBe('ORDER_CHANGED');
  });
});
