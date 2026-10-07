# Sprint 7: End-to-End Verification, Demos & Delivery

> **Focus:** Full System Integration Testing, 7-Scene Hackathon Demo Rehearsal, Packaging, and Deployment  
> **Status:** ⚪ Pending  
> **Reference Specs:** [`docs/06_IMPLEMENTATION_ROADMAP_AND_TASK_BREAKDOWN.md`](../06_IMPLEMENTATION_ROADMAP_AND_TASK_BREAKDOWN.md)  

---

## 1. Sprint Objectives

1. Execute full end-to-end integration test suite linking Frontend, Fastify Backend, Deterministic Engine, Snapshot Hasher, and PayPal Mock/Sandbox.
2. Verify all 4 demo scenarios (Honest Agent, Hidden Subscription, Budget Breaker, Cart Tamperer) execute flawlessly in both UI and API.
3. Validate database resilience, error handling, and performance (<500ms policy evaluation latency).
4. Rehearse the 7-scene hackathon pitch presentation script.
5. Create production deployment configurations (Docker, Render, Vercel) and final README.

---

## 2. Task Checklist

- [ ] **Task 7.1: End-to-End Integration Test Suite**
  - Path: `server/tests/e2e/guardian-e2e.test.ts`
  - Action: Automated script testing full user journey from policy creation to payment capture and audit retrieval.
  - Acceptance Criteria: All E2E assertions pass.

- [ ] **Task 7.2: Demo Script Verification (7-Scene Rehearsal)**
  - Action: Step through all 7 scenes:
    1. Conversational Policy Input
    2. Structured Policy Confirmation & Activation
    3. AI Proposes Valid Cart (Decision: ASK)
    4. User Approves & PayPal Checkout
    5. Completed Payment & Audit Timeline
    6. Wow Moment: AI adds hidden ₹499/mo subscription -> Deterministic BLOCK
    7. Tamper Moment: Order modified after approval -> Hash Mismatch & REVOKED
  - Acceptance Criteria: Flawless demo execution with zero unexpected crashes or console errors.

- [ ] **Task 7.3: Performance & Latency Audit**
  - Action: Measure policy evaluation and snapshot hashing execution latency.
  - Acceptance Criteria: Policy evaluation executes in < 20ms (well beneath the <500ms PRD target).

- [ ] **Task 7.4: Production Build & Containerization**
  - Path: `Dockerfile` & docker-compose configuration
  - Action: Verify both `npm run build` in `server` and `client` pass with zero type or bundling errors.
  - Acceptance Criteria: Production builds pass cleanly.

- [ ] **Task 7.5: Final Documentation & Submission Package**
  - Path: `README.md`
  - Action: Add project banners, architecture diagrams, demo GIF/video link, API quickstart, and hackathon presentation summary.
  - Acceptance Criteria: High-caliber repository presentation ready for judges.

---

## 3. Verification Commands

```bash
# Run all test suites
cd server
npm test

# Verify production builds
npm run build
cd ../client
npm run build
```
