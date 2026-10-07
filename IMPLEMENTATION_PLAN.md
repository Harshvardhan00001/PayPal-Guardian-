# PayPal Guardian — Master Implementation Plan

> **Author:** Senior Principal Software Engineer & Security Architect  
> **Repository:** `PayPal_GUARDIAN`  
> **Status:** Architecture Approved & Ready for Development  

---

## 1. Executive Summary

This document outlines the end-to-end engineering execution plan for **PayPal Guardian**, an AI-powered transaction safety and policy authorization gateway. Guardian sits between autonomous AI shopping agents and PayPal checkout to enforce user spending boundaries deterministically, preventing unwanted purchases, subscription traps, and prompt-injection-driven cart mutations.

Full architectural and technical specifications have been authored in the **[`docs/`](./docs/README.md)** directory:
- [01. Architecture & System Design](./docs/01_ARCHITECTURE_SYSTEM_DESIGN.md)
- [02. Database Schema & Data Models](./docs/02_DATA_MODELS_AND_DATABASE_SCHEMA.md)
- [03. REST API Specification](./docs/03_API_SPECIFICATION.md)
- [04. Policy Engine & Security Specification](./docs/04_POLICY_ENGINE_AND_SECURITY_SPEC.md)
- [05. PayPal Integration & Checkout Flow](./docs/05_PAYPAL_INTEGRATION_AND_CHECKOUT_FLOW.md)
- [06. Implementation Roadmap & Task Breakdown](./docs/06_IMPLEMENTATION_ROADMAP_AND_TASK_BREAKDOWN.md)
- [07. Threat Model & Security Audit](./docs/07_THREAT_MODEL_AND_SECURITY_AUDIT.md)

---

## 2. Core Architectural Decisions

1. **Strict Probabilistic vs. Deterministic Separation:**
   - LLMs parse natural language and extract candidate JSON rules.
   - Deterministic TypeScript engine makes **100% of payment authorization decisions** (`ALLOW`, `ASK`, `BLOCK`). LLMs have zero payment execution authority.
2. **Canonical SHA-256 Snapshot Binding:**
   - Order proposals are cryptographically hashed using canonical RFC 8785 JSON.
   - Any cart mutation (e.g., hidden subscriptions, silent price increases) between approval and capture breaks the hash, immediately revoking approval.
3. **Server-Authoritative PayPal Orders v2:**
   - All PayPal interactions (`createOrder`, `captureOrder`, webhook verification) occur strictly server-side with idempotency keys (`PayPal-Request-Id`).
   - Zero payment credentials are exposed to the browser or AI agent.

---

## 3. Step-by-Step Execution Phases

### Phase 1: Project Scaffolding & Database Setup
- Initialize Git repository and directories (`server/`, `client/`, `docs/`).
- Setup Node.js / Fastify backend with TypeScript and Prisma ORM.
- Setup Next.js 14 frontend with Tailwind CSS and shadcn/ui.
- Deploy initial PostgreSQL migrations and verify database connectivity.

### Phase 2: Core Deterministic Engine & Cryptographic Hasher
- Implement `DeterministicPolicyEngine` with unit test suite covering:
  - Budget overages & minimums
  - Recurring charge prohibition
  - Item quantity limits
  - Category and merchant whitelists/blacklists
- Implement `SnapshotHasher` (Canonical JSON serialization + SHA-256 hashing).
- Implement `AIService` for natural language policy parsing with structured JSON schema output.

### Phase 3: Transaction Proposals & Invalidation Lifecycle
- Build API routes for proposal submission (`POST /api/v1/transactions/proposals`).
- Implement user approval flow (`POST /api/v1/transactions/:id/approve`).
- Build tamper detection logic: assert snapshot hash matches on every mutation and capture attempt.

### Phase 4: PayPal Orders v2 Sandbox Integration
- Implement `PayPalClient` with in-memory OAuth2 token caching.
- Implement order creation with item breakdown and capture flow.
- Build client-side redirect and approval callback handling.

### Phase 5: Webhooks, Security & Observability
- Implement PayPal webhook endpoint with signature verification.
- Implement append-only forensic audit trail (`audit_events`).
- Implement heuristic prompt injection detector for untrusted merchant strings.

### Phase 6: Frontend Experience & AI Shopping Agent Simulator
- Build Next.js Dashboard:
  - Conversational Policy Creator with live structured preview.
  - Pending Approval Drawer with item breakdown & policy checks.
  - Blocked Transaction explainer view.
  - Interactive Audit Timeline.
  - Built-in **AI Shopping Agent Simulator** with one-click test cases (Honest Agent, Hidden Subscription, Budget Breaker, Cart Tamperer).

### Phase 7: Verification, Demo Recording & Deployment
- Execute test suites (Unit, Integration, Tamper scenarios).
- Record 3-minute hackathon demo video following the 7-scene narrative script.
- Deploy backend to Render/Railway and frontend to Vercel.
