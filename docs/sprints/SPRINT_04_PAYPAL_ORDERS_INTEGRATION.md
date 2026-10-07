# Sprint 4: PayPal Orders v2 Sandbox Integration

> **Focus:** Server-Authoritative PayPal Orders v2, OAuth2 Token Management, Order Creation, and Payment Capture  
> **Status:** ⚪ Pending  
> **Reference Specs:** [`docs/05_PAYPAL_INTEGRATION_AND_CHECKOUT_FLOW.md`](../05_PAYPAL_INTEGRATION_AND_CHECKOUT_FLOW.md)  

---

## 1. Sprint Objectives

1. Build `PayPalClient` managing OAuth2 Client Credentials grant with in-memory caching and auto-refresh before expiration.
2. Implement `createOrder` calling PayPal `/v2/checkout/orders` with `intent: CAPTURE`, granular line items, breakdown, and `PayPal-Request-Id` idempotency header.
3. Persist `paypal_orders` record and transition transaction status to `PAYPAL_CREATED`.
4. Implement `captureOrder` calling PayPal `/v2/checkout/orders/{id}/capture` with strict pre-capture snapshot hash assertion.
5. Provide offline/mock fallback mode for local testing without active internet or live credentials.

---

## 2. Task Checklist

- [ ] **Task 4.1: PayPal Client & OAuth2 Token Caching**
  - Path: `server/src/services/paypal/paypal-client.ts`
  - Action: Implement OAuth token retrieval and caching. Add mock mode support if credentials are set to sandbox test placeholders.
  - Acceptance Criteria: Client handles token caching and retries cleanly.

- [ ] **Task 4.2: Create Order Implementation**
  - Path: `server/src/services/paypal/paypal-order-service.ts`
  - Action: Format cart proposal into PayPal Orders v2 payload. Include `brand_name: "PayPal Guardian"`, `application_context`, and return/cancel URLs.
  - Acceptance Criteria: Returns `orderId` and `approvalUrl` (`rel: "approve"`).

- [ ] **Task 4.3: Capture Order with Snapshot Guard**
  - Path: `server/src/services/paypal/paypal-order-service.ts`
  - Action: Execute capture against PayPal Orders API. Assert `expected_snapshot_hash === current_snapshot_hash` before executing network call.
  - Acceptance Criteria: Captures successfully; blocks if hash mismatch is present.

- [ ] **Task 4.4: Payment Controller & API Endpoints**
  - Path: `server/src/modules/payments/payments.routes.ts` & `payments.controller.ts`
  - Action: Expose `POST /api/v1/payments/paypal/create-order` and `POST /api/v1/payments/paypal/capture`.
  - Acceptance Criteria: Returns standardized response envelopes with order details and capture receipt.

---

## 3. Verification Commands

```bash
# Test PayPal Service Unit / Mock Tests
cd server
npm test tests/unit/paypal-service.test.ts
```
