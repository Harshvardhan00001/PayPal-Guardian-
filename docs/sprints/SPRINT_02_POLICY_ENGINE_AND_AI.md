# Sprint 2: Policy Engine & AI Parser

> **Focus:** Deterministic Policy Engine, Canonical JSON Snapshot Hasher, Gemini/OpenAI Structured AI Service  
> **Status:** ⚪ Pending  
> **Reference Specs:** [`docs/04_POLICY_ENGINE_AND_SECURITY_SPEC.md`](../04_POLICY_ENGINE_AND_SECURITY_SPEC.md), [`docs/03_API_SPECIFICATION.md`](../03_API_SPECIFICATION.md)  

---

## 1. Sprint Objectives

1. Implement `DeterministicPolicyEngine` as a pure, zero-dependency TypeScript class enforcing 100% deterministic evaluation (Budget, Quantity, Recurring, Category, Merchant, Approval Required).
2. Implement `SnapshotHasher` using RFC 8785 Canonical JSON sorting and SHA-256 cryptographic hashing.
3. Build unit test suite with 100% test coverage for the deterministic evaluation matrix.
4. Implement `AIService` supporting Google Gemini 1.5 Pro and OpenAI structured JSON outputs with schema enforcement.
5. Implement endpoints:
   - `POST /api/v1/policies/parse`: Extract structured policy from human natural language.
   - `POST /api/v1/policies`: Create and activate policy (v1).
   - `GET /api/v1/policies`: List policies with active version and rules.

---

## 2. Task Checklist

- [ ] **Task 2.1: Deterministic Policy Engine Implementation**
  - Path: `server/src/core/policy-engine/evaluator.ts` & `server/src/core/policy-engine/types.ts`
  - Action: Implement pure evaluation logic with detailed reason codes: `BUDGET_EXCEEDED`, `QUANTITY_EXCEEDED`, `RECURRING_NOT_ALLOWED`, `CATEGORY_BLOCKED`, `MERCHANT_BLOCKED`, `APPROVAL_REQUIRED`.
  - Acceptance Criteria: Pure function runs in < 5ms with zero external side effects.

- [ ] **Task 2.2: Policy Engine Unit Test Suite**
  - Path: `server/tests/unit/policy-engine.test.ts`
  - Action: Write comprehensive Vitest unit tests covering all edge cases (budget overage, multi-item quantities, recurring charges, whitelists, blacklists).
  - Acceptance Criteria: `npm test` passes 100% with all test cases green.

- [ ] **Task 2.3: Cryptographic Snapshot Hasher**
  - Path: `server/src/core/crypto/snapshot-hasher.ts`
  - Action: Implement Canonical JSON serialization (ASCII sorted keys, 2 decimal precision numbers, SKU sorted item arrays) and SHA-256 digest calculation.
  - Acceptance Criteria: Same proposal object always yields identical 64-char hex hash; any modification yields a completely distinct hash.

- [ ] **Task 2.4: Structured AI Intent Parser**
  - Path: `server/src/services/ai/ai-service.ts`
  - Action: Integrate Gemini 1.5 Pro / OpenAI API with strict JSON schema. Extract `max_amount`, `currency`, `max_quantity`, `allowed_categories`, `recurring_allowed`, `approval_required`.
  - Acceptance Criteria: Natural language prompts consistently parse into valid `PolicyRules` JSON schemas.

- [ ] **Task 2.5: Policy API Endpoints & Routes**
  - Path: `server/src/modules/policies/policies.routes.ts` & `policies.controller.ts`
  - Action: Expose `POST /api/v1/policies/parse`, `POST /api/v1/policies`, `GET /api/v1/policies/:id`.
  - Acceptance Criteria: Endpoints accept validated payloads, save records via Prisma, and return standardized envelopes.

---

## 3. Verification Commands

```bash
# Run Policy Engine Unit Tests
cd server
npm test tests/unit/policy-engine.test.ts
npm test tests/unit/snapshot-hasher.test.ts

# Test Policy Parse Endpoint
curl -X POST http://localhost:4000/api/v1/policies/parse \
  -H "Content-Type: application/json" \
  -d '{"text":"Buy running shoes under ₹8000, no subscriptions, ask before paying"}'
```
