import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/index.js';
import { db } from '../../src/db/prisma.js';

describe('PayPal Webhook & Audit Integration Tests', () => {
  let server: any;
  const policyId = 'pol_running_shoes_default';
  let transactionId: string;
  let paypalOrderId: string;

  beforeAll(async () => {
    server = await buildServer();

    // Setup an approved transaction and payPal order for testing
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/v1/transactions/proposals',
      payload: {
        user_id: 'usr_demo_shopper',
        policy_id: policyId,
        merchant: 'Webhook Store',
        currency: 'INR',
        items: [
          {
            sku: 'WH-01',
            name: 'Running Cap',
            category: 'running_shoes',
            quantity: 1,
            unit_price: 1500
          }
        ],
        shipping: 0,
        tax: 0,
        fees: 0,
        recurring: false
      }
    });

    const createBody = JSON.parse(createRes.payload);
    transactionId = createBody.data.transaction_id;
    const snapshotHash = createBody.data.snapshot_hash;

    // Approve the transaction
    const approveRes = await server.inject({
      method: 'POST',
      url: `/api/v1/transactions/${transactionId}/approve`,
      payload: { snapshot_hash: snapshotHash }
    });
    expect(approveRes.statusCode).toBe(200);

    // Create PayPal order
    const orderRes = await server.inject({
      method: 'POST',
      url: '/api/v1/payments/paypal/create-order',
      payload: { transaction_id: transactionId }
    });
    expect(orderRes.statusCode).toBe(201);
    const orderBody = JSON.parse(orderRes.payload);
    paypalOrderId = orderBody.data.paypal_order_id;
  });

  afterAll(async () => {
    await server.close();
    await db.$disconnect();
  });

  it('1. Rejects webhook with invalid cryptographic signature', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/webhooks/paypal',
      headers: {
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT_1',
        'paypal-transmission-id': 'trans_invalid_123',
        'paypal-transmission-sig': 'INVALID_MOCK_SIGNATURE',
        'paypal-transmission-time': new Date().toISOString()
      },
      payload: {
        id: 'WH-EVT-INVALID',
        event_type: 'CHECKOUT.ORDER.APPROVED',
        resource: { id: paypalOrderId }
      }
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_WEBHOOK_SIGNATURE');
  });

  it('2. Rejects malformed webhook payload without event id or event_type', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/webhooks/paypal',
      payload: {
        some_random_field: 'unknown'
      }
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('MALFORMED_WEBHOOK_PAYLOAD');
  });

  it('3. Successfully ingests valid webhook and updates transaction status', async () => {
    const eventId = `WH-EVT-${Date.now()}`;
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/webhooks/paypal',
      headers: {
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT_1',
        'paypal-transmission-id': `trans_${Date.now()}`,
        'paypal-transmission-sig': 'VALID_MOCK_SIGNATURE',
        'paypal-transmission-time': new Date().toISOString()
      },
      payload: {
        id: eventId,
        event_type: 'CHECKOUT.ORDER.APPROVED',
        resource: {
          id: paypalOrderId,
          purchase_units: [
            {
              reference_id: transactionId
            }
          ]
        }
      }
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('PROCESSED');
    expect(body.data.duplicate).toBe(false);

    // Verify transaction status was updated
    const updatedTx = await db.transactionProposal.findUnique({ where: { id: transactionId } });
    expect(updatedTx?.status).toBe('PAYPAL_APPROVED');
  });

  it('4. Enforces idempotency by deduplicating previously processed event IDs', async () => {
    const eventId = `WH-EVT-IDEMP-${Date.now()}`;
    const payload = {
      id: eventId,
      event_type: 'CHECKOUT.ORDER.APPROVED',
      resource: {
        id: paypalOrderId,
        purchase_units: [{ reference_id: transactionId }]
      }
    };

    // First delivery
    const res1 = await server.inject({
      method: 'POST',
      url: '/api/v1/webhooks/paypal',
      payload
    });
    expect(res1.statusCode).toBe(200);
    expect(JSON.parse(res1.payload).data.duplicate).toBe(false);

    // Duplicate delivery
    const res2 = await server.inject({
      method: 'POST',
      url: '/api/v1/webhooks/paypal',
      payload
    });
    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.payload);
    expect(body2.success).toBe(true);
    expect(body2.data.duplicate).toBe(true);
    expect(body2.data.status).toBe('ALREADY_PROCESSED');
  });

  it('5. Handles PAYMENT.CAPTURE.COMPLETED webhook and marks records completed', async () => {
    const captureEventId = `WH-CAPTURE-${Date.now()}`;
    const res = await server.inject({
      method: 'POST',
      url: '/api/v1/webhooks/paypal',
      payload: {
        id: captureEventId,
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: `CAP-${Date.now()}`,
          custom_id: transactionId,
          supplementary_data: {
            related_ids: {
              order_id: paypalOrderId
            }
          }
        }
      }
    });

    expect(res.statusCode).toBe(200);

    const tx = await db.transactionProposal.findUnique({ where: { id: transactionId } });
    expect(tx?.status).toBe('COMPLETED');
  });

  it('6. Exposes immutable transaction audit timeline via GET /api/v1/transactions/:id/audit', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/api/v1/transactions/${transactionId}/audit`
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.transaction_id).toBe(transactionId);
    expect(body.data.event_count).toBeGreaterThanOrEqual(4);

    const eventTypes = body.data.timeline.map((t: any) => t.event_type);
    expect(eventTypes).toContain('ORDER_PROPOSED');
    expect(eventTypes).toContain('POLICY_EVALUATED');
    expect(eventTypes).toContain('USER_APPROVED');
    expect(eventTypes).toContain('PAYPAL_ORDER_CREATED');
    expect(eventTypes).toContain('PAYPAL_WEBHOOK_PROCESSED');
  });

  it('7. Exposes global audit logs via GET /api/v1/audit', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/audit?limit=10'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });
});
