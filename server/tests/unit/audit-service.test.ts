import { describe, it, expect, beforeAll } from 'vitest';
import { AuditService } from '../../src/services/audit/audit-service.js';
import { db } from '../../src/db/prisma.js';

describe('AuditService Unit Tests', () => {
  const testUserId = 'usr_demo_shopper';
  let testTxId: string;

  beforeAll(async () => {
    // Ensure test user exists
    await db.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        email: 'demo@shopper.test',
        name: 'Demo Shopper'
      }
    });

    // Create a dummy transaction proposal to link audit events to
    const dummyPolicy = await db.policy.findFirst();
    if (!dummyPolicy) {
      throw new Error('Default policy not found. Seed must be run.');
    }

    const tx = await db.transactionProposal.create({
      data: {
        userId: testUserId,
        policyId: dummyPolicy.id,
        policyVersion: 1,
        merchant: 'Audit Test Merchant',
        currency: 'INR',
        subtotal: 5000,
        shipping: 0,
        tax: 0,
        fees: 0,
        total: 5000,
        recurring: false,
        status: 'PENDING_APPROVAL',
        snapshotHash: 'mock_audit_snapshot_hash_123',
        expiresAt: new Date(Date.now() + 3600000)
      }
    });
    testTxId = tx.id;
  });

  it('should log audit events with actor and metadata', async () => {
    const event = await AuditService.logEvent(
      testUserId,
      testTxId,
      'ORDER_PROPOSED',
      'AI_AGENT',
      { merchant: 'Audit Test Merchant', total: 5000 }
    );

    expect(event).toBeDefined();
    expect(event.id).toBeDefined();
    expect(event.eventType).toBe('ORDER_PROPOSED');
    expect(event.actor).toBe('AI_AGENT');
    expect(event.transactionId).toBe(testTxId);
  });

  it('should retrieve a chronological, human-readable forensic timeline', async () => {
    await AuditService.logEvent(
      testUserId,
      testTxId,
      'POLICY_EVALUATED',
      'POLICY_ENGINE',
      { decision: 'ASK' }
    );

    await AuditService.logEvent(
      testUserId,
      testTxId,
      'USER_APPROVED',
      'USER',
      { snapshot_hash: 'mock_audit_snapshot_hash_123' }
    );

    const timeline = await AuditService.getTransactionAuditTimeline(testTxId);

    expect(timeline.length).toBeGreaterThanOrEqual(3);
    const eventTypes = timeline.map((e) => e.event_type);
    expect(eventTypes).toContain('ORDER_PROPOSED');
    expect(eventTypes).toContain('POLICY_EVALUATED');
    expect(eventTypes).toContain('USER_APPROVED');

    // Verify narrative formatting
    const evaluatedEvent = timeline.find((e) => e.event_type === 'POLICY_EVALUATED');
    expect(evaluatedEvent).toBeDefined();
    expect(evaluatedEvent?.title).toBe('Deterministic Decision: ASK');
    expect(evaluatedEvent?.description).toContain('Explicit human approval required');
    expect(evaluatedEvent?.verified).toBe(true);
  });

  it('should fetch recent global audit logs with limit', async () => {
    const logs = await AuditService.getRecentAuditLogs(5);
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeLessThanOrEqual(5);
    if (logs.length > 0) {
      expect(logs[0]).toHaveProperty('event_type');
      expect(logs[0]).toHaveProperty('actor');
      expect(logs[0]).toHaveProperty('timestamp');
    }
  });
});
