# Sprint 3: Transaction Proposals & Tamper Guard

> **Focus:** Cart Proposal Ingestion, Snapshot Hash Assertion, Approval Lifecycle, and Cart Mutation / Tamper Detection  
> **Status:** ⚪ Pending  
> **Reference Specs:** [`docs/04_POLICY_ENGINE_AND_SECURITY_SPEC.md`](../04_POLICY_ENGINE_AND_SECURITY_SPEC.md), [`docs/03_API_SPECIFICATION.md`](../03_API_SPECIFICATION.md)  

---

## 1. Sprint Objectives

1. Build `POST /api/v1/transactions/proposals` endpoint for AI Shopping Agents.
2. Ingest cart items, calculate initial canonical SHA-256 snapshot hash, and evaluate deterministically against user's active policy.
3. Persist proposal, items, and evaluation record with status: `ALLOW`, `ASK`, or `BLOCK`.
4. Build `POST /api/v1/transactions/:id/approve` allowing user to sign off on exact snapshot hash.
5. Implement order modification guard: any attempt to alter cart fields (price, quantity, items, fees) recalculates hash, detects discrepancy with approved hash, revokes approval, and transitions status to `ORDER_CHANGED`.

---

## 2. Task Checklist

- [ ] **Task 3.1: Transaction Proposal Ingestion API**
  - Path: `server/src/modules/transactions/transactions.routes.ts` & `transactions.service.ts`
  - Action: Handle cart proposals with merchant, items list, subtotal, shipping, tax, fees, and recurring flag.
  - Acceptance Criteria: Valid proposals are stored with computed `snapshot_hash` and evaluated decision (`ALLOW`, `ASK`, `BLOCK`).

- [ ] **Task 3.2: Human Approval Endpoint & Cryptographic Binding**
  - Path: `server/src/modules/transactions/transactions.controller.ts`
  - Action: Expose `POST /api/v1/transactions/:id/approve` requiring `{ snapshot_hash }`. Verify provided hash matches current proposal hash before issuing approval record.
  - Acceptance Criteria: Invalid/mismatched hash returns `400 Bad Request`. Matching hash updates status to `USER_APPROVED`.

- [ ] **Task 3.3: Order Mutation & Tamper Detection Engine**
  - Path: `server/src/core/security/tamper-guard.ts`
  - Action: Write verification helper checking `current_hash === approved_hash` before any downstream state change.
  - Acceptance Criteria: Mutated order raises `ORDER_CHANGED` error and invalidates prior approvals.

- [ ] **Task 3.4: Automated Tampering Test Suite**
  - Path: `server/tests/integration/tamper-detection.test.ts`
  - Action: Simulate attack where shopping agent injects an item or inflates total after user approval. Assert transaction enters `ORDER_CHANGED` and capture is aborted.
  - Acceptance Criteria: Test passes 100%.

---

## 3. Verification Commands

```bash
# Run Tamper Detection Test
cd server
npm test tests/integration/tamper-detection.test.ts
```
