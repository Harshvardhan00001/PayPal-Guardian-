# Sprint 5: Webhooks, Forensic Audit & Security

> **Focus:** PayPal Webhook Verification, Deduplication, Append-Only Audit Logging, and Prompt Injection Defense  
> **Status:** ⚪ Pending  
> **Reference Specs:** [`docs/05_PAYPAL_INTEGRATION_AND_CHECKOUT_FLOW.md`](../05_PAYPAL_INTEGRATION_AND_CHECKOUT_FLOW.md), [`docs/07_THREAT_MODEL_AND_SECURITY_AUDIT.md`](../07_THREAT_MODEL_AND_SECURITY_AUDIT.md)  

---

## 1. Sprint Objectives

1. Build PayPal webhook ingestion endpoint `POST /api/v1/webhooks/paypal`.
2. Implement cryptographic signature verification using PayPal's `/v1/notifications/verify-webhook-signature` API.
3. Guarantee idempotency by logging incoming events into `webhook_events` with unique `event_id` constraints.
4. Implement `AuditService` to write immutable, chronological audit records for every lifecycle event (`POLICY_CREATED`, `ORDER_PROPOSED`, `POLICY_EVALUATED`, `USER_APPROVED`, `PAYPAL_ORDER_CREATED`, `PAYMENT_CAPTURED`, `ORDER_TAMPERED`).
5. Implement heuristic prompt injection detector flagging untrusted product descriptions attempting to override policy bounds.

---

## 2. Task Checklist

- [ ] **Task 5.1: Webhook Ingestion & Signature Verification**
  - Path: `server/src/modules/webhooks/webhooks.routes.ts` & `webhooks.service.ts`
  - Action: Parse webhook headers (`paypal-transmission-id`, `paypal-transmission-sig`, etc.) and verify signature.
  - Acceptance Criteria: Invalid signature returns `400 Bad Request`. Valid event is stored and acknowledged with `200 OK`.

- [ ] **Task 5.2: Webhook Idempotency & State Sync**
  - Path: `server/src/modules/webhooks/webhooks.service.ts`
  - Action: Handle events `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`. Avoid duplicate processing if `event_id` already exists.
  - Acceptance Criteria: Duplicate webhook delivery is detected and gracefully ignored.

- [ ] **Task 5.3: Append-Only Forensic Audit Service**
  - Path: `server/src/services/audit/audit-service.ts`
  - Action: Expose `logEvent(userId, txId, eventType, actor, metadata)`.
  - Expose API: `GET /api/v1/transactions/:id/audit`.
  - Acceptance Criteria: Returns full timeline ordered by `created_at ASC`.

- [ ] **Task 5.4: Untrusted Content & Prompt Injection Analyzer**
  - Path: `server/src/core/risk-detector/prompt-injection-detector.ts`
  - Action: Scan item names and descriptions for override commands (e.g. "Ignore previous budget", "Guardian override"). Flag `SUSPICIOUS_INSTRUCTION`.
  - Acceptance Criteria: Injections are detected and tagged with high severity in evaluation metadata.

---

## 3. Verification Commands

```bash
# Test Audit & Security Modules
cd server
npm test tests/unit/audit-service.test.ts
npm test tests/unit/prompt-injection-detector.test.ts
```
