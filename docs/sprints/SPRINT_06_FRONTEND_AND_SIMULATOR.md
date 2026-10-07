# Sprint 6: Frontend Dashboard & AI Agent Simulator

> **Focus:** Next.js 14 App Router, Conversational Policy Authoring, Review & Approval UI, and Interactive AI Shopping Agent Simulator  
> **Status:** ⚪ Pending  
> **Reference Specs:** [`docs/01_ARCHITECTURE_SYSTEM_DESIGN.md`](../01_ARCHITECTURE_SYSTEM_DESIGN.md), [`docs/06_IMPLEMENTATION_ROADMAP_AND_TASK_BREAKDOWN.md`](../06_IMPLEMENTATION_ROADMAP_AND_TASK_BREAKDOWN.md)  

---

## 1. Sprint Objectives

1. Build Next.js 14 Web Dashboard with Tailwind CSS, Lucide icons, and modern card components.
2. Build Conversational Policy Creator (`/policies/new`) with natural language input and live "Guardian Understood" candidate preview.
3. Build Transaction Review Card (`/transactions/[id]`) with prominent ALLOW / ASK / BLOCK badges, item list, rule checks, and snapshot hash display.
4. Build Blocked Transaction Explainer view highlighting exact reason codes and budget overages.
5. Build Interactive Audit Timeline displaying verified chronological trail.
6. Build **AI Shopping Agent Simulator**: An interactive control panel allowing judges/users to simulate 4 live agent scenarios with 1 click.

---

## 2. Task Checklist

- [ ] **Task 6.1: Next.js Client Scaffolding & Theme**
  - Path: `client/src/app/layout.tsx` & `client/src/styles/globals.css`
  - Action: Setup clean modern theme with dark/light mode and PayPal Guardian branding ("The firewall between AI and your money").
  - Acceptance Criteria: Client compiles with zero TypeScript errors.

- [ ] **Task 6.2: Conversational Policy Authoring UI**
  - Path: `client/src/app/policies/new/page.tsx` & `client/src/components/PolicyConfirmationCard.tsx`
  - Action: Add conversational prompt input, quick suggestion pills ("Under ₹8,000", "No subscriptions", "Ask before paying"), and parsed candidate preview.
  - Acceptance Criteria: User can type text, inspect parsed JSON, and click "Activate Policy".

- [ ] **Task 6.3: Transaction Review & Approval Modal**
  - Path: `client/src/components/TransactionReviewModal.tsx`
  - Action: Render order items, merchant, snapshot hash, and checklist badges. Add "Approve & Pay with PayPal" button.
  - Acceptance Criteria: Clicking approve initiates PayPal checkout session.

- [ ] **Task 6.4: Blocked Transaction View & Rationale Display**
  - Path: `client/src/components/BlockedAlertCard.tsx`
  - Action: Render high-impact alert for rejected orders detailing exact reasons (e.g. Budget exceeded by ₹1,200, recurring subscription detected).
  - Acceptance Criteria: Clear visual feedback for policy violations.

- [ ] **Task 6.5: Interactive Audit Timeline**
  - Path: `client/src/components/AuditTimelineVisualizer.tsx`
  - Action: Render chronological breadcrumb with timestamps, actors (User, AI Agent, Policy Engine, PayPal), and verification checkmarks.
  - Acceptance Criteria: Displays real-time trail fetched from `/api/v1/transactions/:id/audit`.

- [ ] **Task 6.6: AI Shopping Agent Simulator Component**
  - Path: `client/src/components/AgentSimulatorPanel.tsx`
  - Action: Add one-click test trigger buttons:
    - 🛒 Scenario 1: Clean Running Shoes (₹7,499) -> triggers `ASK`
    - 🚨 Scenario 2: Hidden Subscription (₹7,499 + ₹499/mo) -> triggers `BLOCK`
    - 💥 Scenario 3: Budget Breaker (₹9,200) -> triggers `BLOCK`
    - 🦹 Scenario 4: Tamper Attack (Alters cart after approval) -> triggers `ORDER_CHANGED`
  - Acceptance Criteria: Seamless demo walkthrough for hackathon judges.

---

## 3. Verification Commands

```bash
# Start Client Development Server
cd client
npm run dev

# Open in Browser
# http://localhost:3000
```
