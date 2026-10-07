# 06. Implementation Roadmap & Task Breakdown

## 1. Project Directory Structure

```
PayPal_GUARDIAN/
├── docs/                                # Technical Architecture & Specs
│   ├── README.md
│   ├── 01_ARCHITECTURE_SYSTEM_DESIGN.md
│   ├── 02_DATA_MODELS_AND_DATABASE_SCHEMA.md
│   ├── 03_API_SPECIFICATION.md
│   ├── 04_POLICY_ENGINE_AND_SECURITY_SPEC.md
│   ├── 05_PAYPAL_INTEGRATION_AND_CHECKOUT_FLOW.md
│   ├── 06_IMPLEMENTATION_ROADMAP_AND_TASK_BREAKDOWN.md
│   └── 07_THREAT_MODEL_AND_SECURITY_AUDIT.md
├── server/                              # Guardian Backend (Fastify / TypeScript)
│   ├── src/
│   │   ├── config/                      # Environment & validation
│   │   ├── core/                        # Pure deterministic business logic
│   │   │   ├── policy-engine/           # Evaluator, rule validation
│   │   │   ├── crypto/                  # Canonical JSON, SHA-256 snapshot hasher
│   │   │   └── risk-detector/           # Prompt injection & untrusted content analyzer
│   │   ├── modules/                     # Domain modules (routes, controllers, services)
│   │   │   ├── policies/
│   │   │   ├── transactions/
│   │   │   ├── payments/
│   │   │   ├── webhooks/
│   │   │   └── audit/
│   │   ├── services/                    # External service clients
│   │   │   ├── ai/                      # Gemini / OpenAI Structured API
│   │   │   └── paypal/                  # Orders v2 & OAuth2 token manager
│   │   ├── db/                          # Prisma Client & seeds
│   │   └── index.ts                     # Fastify server entry point
│   ├── prisma/
│   │   └── schema.prisma                # Database schema
│   ├── tests/                           # Unit & Integration test suites
│   ├── package.json
│   └── tsconfig.json
├── client/                              # Guardian Web Dashboard (Next.js 14)
│   ├── src/
│   │   ├── app/                         # App Router pages
│   │   │   ├── dashboard/               # Metrics, active policies, recent tx
│   │   │   ├── policies/new/            # Conversational NL policy creator
│   │   │   ├── transactions/            # Review proposals, approval modal
│   │   │   ├── audit/                   # Forensic audit timeline
│   │   │   └── checkout/                # Success & cancel return pages
│   │   ├── components/                  # shadcn/ui & custom visual widgets
│   │   │   ├── PolicyConfirmationCard.tsx
│   │   │   ├── OrderProposalReview.tsx
│   │   │   ├── TamperWarningBadge.tsx
│   │   │   └── AuditTimelineVisualizer.tsx
│   │   ├── lib/                         # API fetcher & utilities
│   │   └── styles/
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

---

## 2. 7-Day Phased Implementation Plan

### Phase 1 — Project Scaffold & Data Foundations (Day 1)
- [ ] Initialize Git repository and workspace root structure.
- [ ] Setup `server/` with TypeScript, Fastify, ESLint, Prettier, and Vitest.
- [ ] Setup `client/` with Next.js 14 (App Router), Tailwind CSS, and shadcn/ui.
- [ ] Configure PostgreSQL instance (local or Neon serverless).
- [ ] Write `prisma/schema.prisma` and execute initial migration (`prisma migrate dev`).
- [ ] Seed database with demo user (`test_user@paypalguardian.com`) and default policy categories.

### Phase 2 — Policy Engine & AI Parser (Day 2)
- [ ] Implement `DeterministicPolicyEngine` in `server/src/core/policy-engine/`.
- [ ] Write 100% unit test coverage for budget, quantity, category, and recurring rules.
- [ ] Implement `SnapshotHasher` (Canonical JSON serialization + SHA-256 digest).
- [ ] Implement `AIService` using Google Gemini 1.5 Pro / OpenAI function calling with strict JSON schema.
- [ ] Expose `POST /api/v1/policies/parse` and `POST /api/v1/policies`.
- [ ] Build Frontend conversational policy creation screen (`/policies/new`) with live preview card.

### Phase 3 — Transaction Proposals & Tamper Guard (Day 3)
- [ ] Implement `POST /api/v1/transactions/proposals` endpoint for AI agents.
- [ ] Wire deterministic policy evaluation into transaction flow.
- [ ] Implement snapshot hash generation and database storage.
- [ ] Implement `POST /api/v1/transactions/:id/approve` with incoming hash validation.
- [ ] Implement tamper detection test suite: verify that mutating any order parameter causes approval invalidation (`ORDER_CHANGED`).
- [ ] Build Frontend Transaction Review card with clear ALLOW / ASK / BLOCK badges.

### Phase 4 — PayPal Orders v2 Sandbox Integration (Day 4)
- [ ] Configure PayPal Developer Sandbox App (Client ID & Secret).
- [ ] Implement `PayPalClient` with automatic OAuth2 token caching and expiration handling.
- [ ] Implement `PayPalOrderService.createOrder` with exact items and breakdown.
- [ ] Implement `PayPalOrderService.captureOrder` with pre-capture snapshot hash assertion.
- [ ] Expose `POST /api/v1/payments/paypal/create-order` and `POST /api/v1/payments/paypal/capture`.
- [ ] Build Frontend redirect / modal integration to complete sandbox checkout.

### Phase 5 — Webhooks, Security & Audit Timeline (Day 5)
- [ ] Implement PayPal Webhook endpoint `POST /api/v1/webhooks/paypal` with cryptographic signature verification.
- [ ] Build idempotent webhook event processor (`webhook_events`).
- [ ] Implement append-only `audit_events` logger tracking all actor actions.
- [ ] Implement untrusted instruction heuristic detector (`SUSPICIOUS_INSTRUCTION`).
- [ ] Expose `GET /api/v1/transactions/:id/audit`.
- [ ] Build Frontend interactive timeline component displaying verified chronological events.

### Phase 6 — Agent Simulator & UI Polish (Day 6)
- [ ] Build built-in **AI Shopping Agent Simulator** in the UI:
  - Scenario 1: Honest Agent proposing running shoes under ₹8,000.
  - Scenario 2: Hidden Subscription Agent proposing running shoes + ₹499/mo club.
  - Scenario 3: Budget Breaker proposing ₹9,200 shoes.
  - Scenario 4: Tamperer modifying cart after user approval.
- [ ] Polish UI with sleek animations, clear status alerts, dark mode support, and metric counters.
- [ ] Add real-time sound/visual feedback on BLOCKED transactions.

### Phase 7 — End-to-End Testing & Demo Packaging (Day 7)
- [ ] Run full end-to-end integration test suite.
- [ ] Record 3-minute hackathon demo video following the 7-scene narrative script.
- [ ] Deploy backend to Render/Railway and frontend to Vercel.
- [ ] Finalize root `README.md` and repository release tag `v1.0.0`.

---

## 3. Comprehensive Testing Strategy

### 3.1 Deterministic Test Matrix (Unit Tests)

| Test Case ID | Test Description | Input Policy | Input Proposal | Expected Decision | Reason Code |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-DET-01** | Standard valid purchase within limit | Max ₹8,000, approval: false | Total ₹7,499 | `ALLOW` | `ALL_CHECKS_PASSED` |
| **TC-DET-02** | Valid purchase requiring approval | Max ₹8,000, approval: true | Total ₹7,499 | `ASK` | `APPROVAL_REQUIRED` |
| **TC-DET-03** | Budget exceeded | Max ₹8,000 | Total ₹9,200 | `BLOCK` | `BUDGET_EXCEEDED` |
| **TC-DET-04** | Hidden subscription fee | Recurring: false | Recurring: true | `BLOCK` | `RECURRING_NOT_ALLOWED` |
| **TC-DET-05** | Quantity limit exceeded | Max quantity: 1 | Quantity: 2 | `BLOCK` | `QUANTITY_EXCEEDED` |
| **TC-DET-06** | Blocked merchant | Blocked: `["scam.com"]` | Merchant: `scam.com` | `BLOCK` | `MERCHANT_BLOCKED` |
| **TC-DET-07** | Currency mismatch | Currency: `INR` | Currency: `USD` | `BLOCK` | `CURRENCY_MISMATCH` |
| **TC-DET-08** | Tampered snapshot hash | Approved: `Hash_A` | Capture cart: `Hash_B` | `REJECTED (409)` | `ORDER_CHANGED` |

---

## 4. Hackathon Demo Script: 7-Scene Winning Narrative

| Scene | Action | Visual Display | Narration Key Message |
| :--- | :--- | :--- | :--- |
| **Scene 1: Natural Language Policy** | User types: *"Buy running shoes under ₹8,000. No subscriptions. Ask me before paying."* | Conversational input box with instant typing effect. | *"We don't force users into complicated permission dashboards. Guardian extracts financial bounds directly from natural speech."* |
| **Scene 2: Structured Activation** | System renders *"Guardian Understood"* card. User clicks *"Activate Policy"*. | Clean card showing: Max: ₹8,000 \| Quantity: 1 \| Subs: Blocked \| Approval: Mandatory. | *"Notice: The LLM suggests, but the user activates. Probabilistic AI never quietly becomes a financial rule."* |
| **Scene 3: AI Proposes Valid Cart** | Agent Simulator proposes Nike Pegasus 40 for ₹7,499. | Proposal card appears with green checkmarks on budget, category, quantity. | *"The shopping agent finds shoes. Guardian deterministically checks every rule. Result: ASK, because the policy demanded human confirmation."* |
| **Scene 4: Approval & PayPal Checkout** | User clicks *"Approve & Continue with PayPal"*. | PayPal Sandbox checkout launches. User logs in and approves ₹7,499. | *"Guardian locks this exact cart snapshot with a SHA-256 hash and server-side creates the PayPal Orders v2 request."* |
| **Scene 5: Completed Payment & Audit** | PayPal redirects. Capture succeeds. | Confetti, Green COMPLETED badge, interactive audit timeline updates. | *"The payment is captured securely on the backend, and an immutable audit timeline is permanently recorded."* |
| **Scene 6: The Wow Moment (Hidden Sub)** | Agent Simulator proposes Shoes ₹7,499 + Premium Membership ₹499/mo. | Large Red BLOCKED Alert instantly flashes! Badge: `RECURRING_NOT_ALLOWED`. | *"Here is what happens when a sneaky agent tries to add a recurring subscription. Blocked instantly. Zero money leaves your account."* |
| **Scene 7: The Tamper Test (Cart Mutation)** | User approves ₹7,499 shoes. Rogue agent injects ₹1,000 fee before capture. | Alert: `ORDER_CHANGED`. Mismatched Hash graphic shown. Capture blocked. | *"Even if an agent alters 1 cent after your approval, the cryptographic snapshot hash breaks. The authorization is dead. Your money is safe."* |
