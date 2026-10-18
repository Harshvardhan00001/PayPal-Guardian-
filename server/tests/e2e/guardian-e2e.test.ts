import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/index.js';
import { db } from '../../src/db/prisma.js';

describe.sequential('PayPal Guardian Full End-to-End Journey (PRD 7-Step Flow + Threat Defenses)', () => {
  let server: any;
  const userId = 'usr_demo_shopper';
  let policyId: string;
  let transactionId: string;
  let snapshotHash: string;
  let paypalOrderId: string;

  beforeAll(async () => {
    server = await buildServer();

    // Ensure user exists
    await db.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: 'demo@shopper.test',
        name: 'Demo Shopper'
      }
    });
  });

  afterAll(async () => {
    await server.close();
    await db.$disconnect();
  });

  it('Scene 1 & 2: Natural Language Policy Parsing and Activation', async () => {
    // Step 1: User inputs natural language spending instruction
    const parseRes = await server.inject({
      method: 'POST',
      url: '/api/v1/policies/parse',
      payload: {
        natural_language:
          'Buy me running shoes under ₹8,000. Only one pair. No subscriptions. Ask me before making payment.'
      }
    });

    expect(parseRes.statusCode).toBe(200);
    const parseBody = JSON.parse(parseRes.payload);
    expect(parseBody.success).toBe(true);

    const rules = parseBody.data.interpreted_policy?.rules || parseBody.data.parsed_rules;
    expect(rules.max_amount).toBe(8000);
    expect(rules.currency).toBe('INR');
    expect(rules.max_quantity).toBe(1);
    expect(rules.recurring_allowed).toBe(false);
    expect(rules.approval_required).toBe(true);

    // Step 2: User activates policy ("Guardian Understood")
    const createPolicyRes = await server.inject({
      method: 'POST',
      url: '/api/v1/policies',
      payload: {
        user_id: userId,
        name: 'E2E Running Shoes Protection Policy',
        description: 'Auto-tested running shoes policy',
        rules
      }
    });

    expect(createPolicyRes.statusCode).toBe(201);
    const policyBody = JSON.parse(createPolicyRes.payload);
    expect(policyBody.success).toBe(true);
    expect(policyBody.data.policy_id).toBeDefined();
    policyId = policyBody.data.policy_id;
  });

  it('Scene 3: Autonomous AI Agent Proposes Order -> Deterministic Decision: ASK', async () => {
    const startTime = performance.now();

    const proposalRes = await server.inject({
      method: 'POST',
      url: '/api/v1/transactions/proposals',
      payload: {
        user_id: userId,
        policy_id: policyId,
        merchant: 'Nike Flagship Online',
        currency: 'INR',
        items: [
          {
            sku: 'NK-ZOOM-PEG-40',
            name: 'Nike Air Zoom Pegasus 40 Running Shoes',
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

    const elapsedMs = performance.now() - startTime;
    // Latency target: < 500ms
    expect(elapsedMs).toBeLessThan(500);

    expect(proposalRes.statusCode).toBe(201);
    const body = JSON.parse(proposalRes.payload);
    expect(body.success).toBe(true);
    expect(body.data.decision).toBe('ASK');
    expect(body.data.reasons).toHaveLength(1);
    expect(body.data.reasons[0].code).toBe('APPROVAL_REQUIRED');

    transactionId = body.data.transaction_id;
    snapshotHash = body.data.snapshot_hash;
    expect(snapshotHash).toHaveLength(64); // SHA-256
  });

  it('Scene 4: User Cryptographically Approves Order Snapshot', async () => {
    const approveRes = await server.inject({
      method: 'POST',
      url: `/api/v1/transactions/${transactionId}/approve`,
      payload: {
        snapshot_hash: snapshotHash
      }
    });

    expect(approveRes.statusCode).toBe(200);
    const body = JSON.parse(approveRes.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('USER_APPROVED');
    expect(body.data.snapshot_hash).toBe(snapshotHash);
  });

  it('Scene 5: Server-Authoritative PayPal Orders v2 Creation and Payment Capture', async () => {
    // Create server-side order
    const orderRes = await server.inject({
      method: 'POST',
      url: '/api/v1/payments/paypal/create-order',
      payload: {
        transaction_id: transactionId
      }
    });

    expect(orderRes.statusCode).toBe(201);
    const orderBody = JSON.parse(orderRes.payload);
    expect(orderBody.success).toBe(true);
    expect(orderBody.data.paypal_order_id).toBeDefined();
    paypalOrderId = orderBody.data.paypal_order_id;

    // Capture payment
    const captureRes = await server.inject({
      method: 'POST',
      url: '/api/v1/payments/paypal/capture',
      payload: {
        transaction_id: transactionId,
        paypal_order_id: paypalOrderId
      }
    });

    expect(captureRes.statusCode).toBe(200);
    const captureBody = JSON.parse(captureRes.payload);
    expect(captureBody.success).toBe(true);
    expect(captureBody.data.status).toBe('COMPLETED');
    expect(captureBody.data.capture_id).toBeDefined();
  });

  it('Scene 6 (Forensic Audit): Complete Immutable Audit Trail Verified', async () => {
    const auditRes = await server.inject({
      method: 'GET',
      url: `/api/v1/transactions/${transactionId}/audit`
    });

    expect(auditRes.statusCode).toBe(200);
    const auditBody = JSON.parse(auditRes.payload);
    expect(auditBody.success).toBe(true);

    const timeline = auditBody.data.timeline;
    expect(timeline.length).toBeGreaterThanOrEqual(5);

    const eventTypes = timeline.map((t: any) => t.event_type);
    expect(eventTypes).toContain('ORDER_PROPOSED');
    expect(eventTypes).toContain('POLICY_EVALUATED');
    expect(eventTypes).toContain('USER_APPROVED');
    expect(eventTypes).toContain('PAYPAL_ORDER_CREATED');
    expect(eventTypes).toContain('PAYMENT_CAPTURED');
  });

  it('Scene 7A (Subscription Threat Defense): Rejects Hidden Recurring Fee with Decision: BLOCK', async () => {
    const subRes = await server.inject({
      method: 'POST',
      url: '/api/v1/transactions/proposals',
      payload: {
        user_id: userId,
        policy_id: policyId,
        merchant: 'SneakerClub.io',
        currency: 'INR',
        items: [
          {
            sku: 'SHOE-01',
            name: 'Running Shoes',
            category: 'running_shoes',
            quantity: 1,
            unit_price: 6999
          },
          {
            sku: 'SUB-VIP',
            name: 'VIP Club Monthly Care',
            category: 'running_shoes',
            quantity: 1,
            unit_price: 499
          }
        ],
        shipping: 0,
        tax: 0,
        fees: 0,
        recurring: true
      }
    });

    expect(subRes.statusCode).toBe(200);
    const subBody = JSON.parse(subRes.payload);
    expect(subBody.data.decision).toBe('BLOCK');
    const reasons = subBody.data.reasons.map((r: any) => r.code);
    expect(reasons).toContain('RECURRING_NOT_ALLOWED');
  });

  it('Scene 7B (Tamper Guard Defense): Post-Approval Cart Shift Triggers 409 Conflict & Revocation', async () => {
    // 1. Propose clean order
    const propRes = await server.inject({
      method: 'POST',
      url: '/api/v1/transactions/proposals',
      payload: {
        user_id: userId,
        policy_id: policyId,
        merchant: 'Nike Tamper Store',
        currency: 'INR',
        items: [
          {
            sku: 'NK-TMP-1',
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

    const txId = JSON.parse(propRes.payload).data.transaction_id;
    const initialHash = JSON.parse(propRes.payload).data.snapshot_hash;

    // 2. User approves initial hash
    await server.inject({
      method: 'POST',
      url: `/api/v1/transactions/${txId}/approve`,
      payload: { snapshot_hash: initialHash }
    });

    // 3. Create PayPal order
    await server.inject({
      method: 'POST',
      url: '/api/v1/payments/paypal/create-order',
      payload: { transaction_id: txId }
    });

    // 4. Cart tampered behind the scenes: +₹300 hidden fee
    await server.inject({
      method: 'PATCH',
      url: `/api/v1/transactions/${txId}`,
      payload: { fees: 300 }
    });

    // 5. Payment capture attempted -> Immediately blocked by TamperGuard!
    const captureTamperRes = await server.inject({
      method: 'POST',
      url: '/api/v1/payments/paypal/capture',
      payload: { transaction_id: txId }
    });

    expect(captureTamperRes.statusCode).toBe(409);
    const tamperBody = JSON.parse(captureTamperRes.payload);
    expect(tamperBody.success).toBe(false);
    expect(tamperBody.error.code).toBe('ORDER_CHANGED');

    // Verify transaction status was shifted to ORDER_CHANGED
    const record = await db.transactionProposal.findUnique({ where: { id: txId } });
    expect(record?.status).toBe('ORDER_CHANGED');
  });
});
