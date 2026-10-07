# Sprint 1: Foundations & Database Setup

> **Focus:** Monorepo/Workspace Scaffolding, Fastify TypeScript Server, Prisma ORM, PostgreSQL Schema, and Seeding  
> **Status:** 🟢 Completed  
> **Reference Specs:** [`docs/01_ARCHITECTURE_SYSTEM_DESIGN.md`](../01_ARCHITECTURE_SYSTEM_DESIGN.md), [`docs/02_DATA_MODELS_AND_DATABASE_SCHEMA.md`](../02_DATA_MODELS_AND_DATABASE_SCHEMA.md)  

---

## 1. Sprint Objectives

1. Initialize Git repository and root environment configuration.
2. Initialize backend directory (`server/`) with Node.js 22+, TypeScript, Fastify, and strict JSON schema support.
3. Configure Prisma ORM with PostgreSQL/SQLite provider matching the architecture schema (users, policies, policy_versions, transaction_proposals, transaction_items, evaluations, approvals, paypal_orders, webhook_events, audit_events).
4. Create database migrations and establish baseline database connectivity.
5. Create seed scripts with sample users, baseline policy templates, and mock merchant catalog.
6. Initialize client directory (`client/`) structure with Next.js 14 (App Router), Tailwind CSS, and TypeScript.
7. Verify backend server runs and exposes a clean health check endpoint (`GET /health`).

---

## 2. Task Checklist

- [x] **Task 1.1: Git & Workspace Root Setup**
  - Path: `root`
  - Action: Initialize `git init`, create `.gitignore`, `.env.example`, and root `package.json` with workspace coordination scripts.
  - Acceptance Criteria: Git initialized, root `.gitignore` excludes `node_modules`, `.env`, `dist`, `.next`.

- [x] **Task 1.2: Server Scaffolding (Fastify + TypeScript)**
  - Path: `server/`
  - Action: Initialize `server/package.json`, install `@fastify/cors`, `@fastify/sensible`, `dotenv`, `zod`, `pino`, `prisma`, `@prisma/client`, `tsx`, `typescript`, `@types/node`.
  - Config: Create `tsconfig.json` with strict type checking.
  - Acceptance Criteria: `npm run build` succeeds, server starts via `tsx src/index.ts`.

- [x] **Task 1.3: Prisma Schema Configuration**
  - Path: `server/prisma/schema.prisma` & `server/prisma/schema.postgresql.prisma`
  - Action: Define all 8 models (`User`, `Policy`, `PolicyVersion`, `TransactionProposal`, `TransactionItem`, `Evaluation`, `Approval`, `PayPalOrder`, `WebhookEvent`, `AuditEvent`) with exact types, enums, indexes, and relations.
  - Acceptance Criteria: `npx prisma validate` passes with zero errors.

- [x] **Task 1.4: Database Connectivity & Migration**
  - Path: `server/prisma/dev.db`
  - Action: Generate migration or deploy schema to target database (`npx prisma db push`). Ensure fallback SQLite and cloud PostgreSQL schema are configured.
  - Acceptance Criteria: `npx prisma generate` outputs fresh TypeScript Prisma client types.

- [x] **Task 1.5: Seed Data Generation**
  - Path: `server/prisma/seed.ts`
  - Action: Create seed script populating:
    - Default Test User (`user_id`: `usr_demo_shopper`, Email: `shopper@paypalguardian.com`)
    - Sample Active Policy (Budget: ₹8,000, Category: `running_shoes`, Approval: Required, Recurring: Prohibited)
  - Acceptance Criteria: `npx tsx prisma/seed.ts` successfully populates database.

- [x] **Task 1.6: Server Entry Point & Health Check Route**
  - Path: `server/src/index.ts` & `server/src/routes/health.ts`
  - Action: Expose `GET /health` returning server status, database latency, and timestamp.
  - Acceptance Criteria: Request returns `200 OK` with `{ status: "ok", service: "paypal-guardian-server", database: "connected" }`. Tested via Vitest.

---

## 3. Verification Commands

```bash
# Verify Server builds and types check
cd server
npm run build

# Verify Prisma schema
npx prisma validate
npx prisma generate

# Run Server locally
npm run dev

# Test Health Endpoint
curl http://localhost:4000/health
```
