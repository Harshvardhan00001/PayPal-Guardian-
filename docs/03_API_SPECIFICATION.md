# 03. REST API Specification

## 1. Protocol & Standard Conventions

- **Base URL:** `/api/v1`
- **Content-Type:** `application/json`
- **Security & Headers:**
  - `Authorization: Bearer <jwt_user_token>`: User dashboard requests.
  - `X-Guardian-Agent-Key: <api_key>`: Shopping Agent proposal requests.
  - `Idempotency-Key: <uuidv4>`: Recommended on all mutation POST/PATCH requests.
- **Envelope Standard:** All responses follow a standardized JSON envelope.

```json
{
  "success": true,
  "data": {},
  "error": null,
  "timestamp": "2026-10-06T15:30:00.000Z"
}
```

---

## 2. Decision & Reason Code Catalog

Every evaluation or block returns machine-readable reason codes accompanied by human-friendly explanations:

| Reason Code | Category | HTTP Status | Description |
| :--- | :--- | :--- | :--- |
| `BUDGET_EXCEEDED` | Budget | 200 / 422 | Proposed order total exceeds the policy's `max_amount`. |
| `BUDGET_BELOW_MINIMUM` | Budget | 200 / 422 | Proposed order total is lower than configured `min_amount`. |
| `CURRENCY_MISMATCH` | Currency | 200 / 422 | Order currency does not match the policy allowed currency. |
| `QUANTITY_EXCEEDED` | Quantity | 200 / 422 | Cumulative cart quantity exceeds `max_quantity`. |
| `CATEGORY_NOT_ALLOWED` | Category | 200 / 422 | Cart contains items outside the `allowed_categories` whitelist. |
| `CATEGORY_BLOCKED` | Category | 200 / 422 | Cart contains items matching a `blocked_categories` rule. |
| `MERCHANT_NOT_ALLOWED` | Merchant | 200 / 422 | Merchant is not present in `allowed_merchants` whitelist. |
| `MERCHANT_BLOCKED` | Merchant | 200 / 422 | Merchant is listed in `blocked_merchants` blacklist. |
| `RECURRING_NOT_ALLOWED`| Subscription | 200 / 422 | Cart contains recurring billing or subscription fees when disabled. |
| `APPROVAL_REQUIRED` | Authorization | 200 | Order passes all limits but policy explicitly mandates human approval. |
| `ORDER_CHANGED` | Integrity | 409 Conflict| Cart snapshot hash differs from approved hash before payment capture. |
| `APPROVAL_EXPIRED` | Integrity | 410 Gone | The user approval window has lapsed (default: 15 minutes). |
| `SUSPICIOUS_INSTRUCTION`| Security | 200 / 422 | AI detected prompt injection / instruction override attempt in item data. |
| `PAYMENT_FAILED` | Gateway | 502 / 400 | PayPal declined authorization or capture failed. |

---

## 3. Endpoints

### 3.1 Policy Management

#### 3.1.1 Parse Natural Language Instruction
`POST /api/v1/policies/parse`

Translates unstructured human text into candidate structured rules. **Does not save or activate.**

- **Request Body:**
```json
{
  "text": "Buy running shoes under ₹8,000. Only one pair. No subscriptions. Ask me before paying."
}
```

- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "interpreted_policy": {
      "name": "Running Shoes Policy",
      "description": "Rules for purchasing running shoes under ₹8,000",
      "rules": {
        "max_amount": 8000,
        "currency": "INR",
        "max_quantity": 1,
        "allowed_categories": ["running_shoes"],
        "blocked_categories": ["subscription", "accessories"],
        "allowed_merchants": [],
        "blocked_merchants": [],
        "recurring_allowed": false,
        "approval_required": true,
        "recheck_on_change": true
      }
    },
    "ambiguities": [],
    "confidence_score": 0.98,
    "summary_bullets": [
      "Maximum budget: ₹8,000 (INR)",
      "Maximum quantity: 1 pair",
      "Category limited to Running Shoes",
      "Subscriptions strictly blocked",
      "User approval required before payment"
    ]
  }
}
```

#### 3.1.2 Create & Activate Policy
`POST /api/v1/policies`

Stores the policy and sets version to 1.

- **Request Body:**
```json
{
  "user_id": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "name": "Running Shoes Safety Net",
  "description": "Auto-shopping rule for workout sneakers",
  "rules": {
    "max_amount": 8000,
    "currency": "INR",
    "max_quantity": 1,
    "allowed_categories": ["running_shoes"],
    "blocked_categories": [],
    "allowed_merchants": [],
    "blocked_merchants": [],
    "recurring_allowed": false,
    "approval_required": true,
    "recheck_on_change": true
  }
}
```

- **Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "policy_id": "pol_7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "version": 1,
    "status": "ACTIVE",
    "created_at": "2026-10-06T15:35:00.000Z"
  }
}
```

#### 3.1.3 List Policies
`GET /api/v1/policies?user_id=usr_9b1deb4d...&status=ACTIVE`

- **Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "pol_7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "name": "Running Shoes Safety Net",
      "status": "ACTIVE",
      "active_version": 1,
      "rules": {
        "max_amount": 8000,
        "currency": "INR",
        "max_quantity": 1,
        "recurring_allowed": false,
        "approval_required": true
      },
      "created_at": "2026-10-06T15:35:00.000Z"
    }
  ]
}
```

---

### 3.2 Transaction Proposals & Evaluation

#### 3.2.1 Create Order Proposal (Invoked by AI Agent)
`POST /api/v1/transactions/proposals`

Autonomous agents call this endpoint when an item or cart is ready for purchase consideration.

- **Request Body:**
```json
{
  "user_id": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "policy_id": "pol_7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "merchant": "Nike Official Store",
  "currency": "INR",
  "items": [
    {
      "sku": "NK-PEG-40",
      "name": "Nike Air Zoom Pegasus 40",
      "category": "running_shoes",
      "quantity": 1,
      "unit_price": 7499.00
    }
  ],
  "shipping": 0.00,
  "tax": 0.00,
  "fees": 0.00,
  "recurring": false
}
```

- **Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "transaction_id": "tx_28fbc017-d5e0-47b2-a402-9a3b680c102a",
    "status": "ASK",
    "decision": "ASK",
    "snapshot_hash": "a4d3f5e08b1a2e9b047a075e840a25997237a6bcae8d2495bb38ec08107ef4c8",
    "summary": {
      "subtotal": 7499.00,
      "shipping": 0.00,
      "tax": 0.00,
      "fees": 0.00,
      "total": 7499.00,
      "currency": "INR"
    },
    "reasons": [
      {
        "code": "APPROVAL_REQUIRED",
        "message": "Transaction satisfies financial rules, but policy explicitly requires human confirmation before payment."
      }
    ],
    "expires_at": "2026-10-06T15:50:00.000Z"
  }
}
```

#### 3.2.2 Propose Order with Violation (e.g. Budget Exceeded)
- **Request Body:**
```json
{
  "user_id": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "policy_id": "pol_7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "merchant": "SneakerHeaven",
  "currency": "INR",
  "items": [
    {
      "sku": "NK-INV-03",
      "name": "Nike Invincible 3",
      "category": "running_shoes",
      "quantity": 1,
      "unit_price": 8500.00
    }
  ],
  "shipping": 300.00,
  "tax": 400.00,
  "fees": 0.00,
  "recurring": false
}
```

- **Response (200 OK — Deterministic Block):**
```json
{
  "success": true,
  "data": {
    "transaction_id": "tx_587a32cb-5047-495c-9c60-a2927b233a01",
    "status": "BLOCKED",
    "decision": "BLOCK",
    "snapshot_hash": "f685934421b8fba6406db996b99ce4fbdf0e599988b449103e6701d6706e902b",
    "summary": {
      "subtotal": 8500.00,
      "shipping": 300.00,
      "tax": 400.00,
      "fees": 0.00,
      "total": 9200.00,
      "currency": "INR"
    },
    "reasons": [
      {
        "code": "BUDGET_EXCEEDED",
        "message": "Order total ₹9,200.00 exceeds your policy maximum budget of ₹8,000.00 by ₹1,200.00."
      }
    ]
  }
}
```

---

### 3.3 Authorization & PayPal Checkout

#### 3.3.1 User Approval of Transaction
`POST /api/v1/transactions/:id/approve`

User commits their cryptographic agreement to the exact proposed snapshot.

- **Request Body:**
```json
{
  "user_id": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "snapshot_hash": "a4d3f5e08b1a2e9b047a075e840a25997237a6bcae8d2495bb38ec08107ef4c8"
}
```

- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "transaction_id": "tx_28fbc017-d5e0-47b2-a402-9a3b680c102a",
    "status": "PAYPAL_CREATED",
    "paypal_order_id": "8XY1234567890123",
    "approval_url": "https://www.sandbox.paypal.com/checkoutnow?token=8XY1234567890123",
    "snapshot_hash": "a4d3f5e08b1a2e9b047a075e840a25997237a6bcae8d2495bb38ec08107ef4c8",
    "approved_at": "2026-10-06T15:37:12.000Z"
  }
}
```

#### 3.3.2 Capture PayPal Payment
`POST /api/v1/payments/paypal/capture`

Executes the server-side payment capture after user completes PayPal modal/redirect approval.

- **Request Body:**
```json
{
  "transaction_id": "tx_28fbc017-d5e0-47b2-a402-9a3b680c102a",
  "paypal_order_id": "8XY1234567890123",
  "expected_snapshot_hash": "a4d3f5e08b1a2e9b047a075e840a25997237a6bcae8d2495bb38ec08107ef4c8"
}
```

- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "transaction_id": "tx_28fbc017-d5e0-47b2-a402-9a3b680c102a",
    "paypal_order_id": "8XY1234567890123",
    "capture_id": "CAP-9988776655",
    "status": "COMPLETED",
    "captured_amount": {
      "currency": "INR",
      "value": "7499.00"
    },
    "completed_at": "2026-10-06T15:38:04.000Z"
  }
}
```

- **Response on Tampering (409 Conflict):**
```json
{
  "success": false,
  "error": {
    "code": "ORDER_CHANGED",
    "message": "Cart snapshot hash changed after authorization. Payment capture aborted.",
    "details": {
      "approved_hash": "a4d3f5e08b1a2e9b047a075e840a25997237a6bcae8d2495bb38ec08107ef4c8",
      "current_hash": "c71e0689b27568f54b6d925e01931658b456d95392b45e998184c8a24564bf17"
    }
  }
}
```

---

### 3.4 Audit Trail & Observability

#### 3.4.1 Retrieve Transaction Audit Timeline
`GET /api/v1/transactions/:id/audit`

- **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "transaction_id": "tx_28fbc017-d5e0-47b2-a402-9a3b680c102a",
    "timeline": [
      {
        "timestamp": "2026-10-06T15:35:00.000Z",
        "event_type": "POLICY_CREATED",
        "actor": "USER",
        "description": "Policy 'Running Shoes Safety Net' (v1) created with ₹8,000 max limit."
      },
      {
        "timestamp": "2026-10-06T15:36:10.000Z",
        "event_type": "ORDER_PROPOSED",
        "actor": "AI_AGENT",
        "description": "Shopping agent proposed Nike Pegasus 40 for ₹7,499.00."
      },
      {
        "timestamp": "2026-10-06T15:36:11.000Z",
        "event_type": "POLICY_EVALUATED",
        "actor": "POLICY_ENGINE",
        "description": "Deterministic evaluation returned decision: ASK (APPROVAL_REQUIRED)."
      },
      {
        "timestamp": "2026-10-06T15:37:12.000Z",
        "event_type": "USER_APPROVED",
        "actor": "USER",
        "description": "User confirmed order snapshot hash 'a4d3f5e0...'."
      },
      {
        "timestamp": "2026-10-06T15:37:15.000Z",
        "event_type": "PAYPAL_ORDER_CREATED",
        "actor": "PAYPAL_SERVICE",
        "description": "PayPal Orders v2 instance '8XY1234567890123' instantiated."
      },
      {
        "timestamp": "2026-10-06T15:38:04.000Z",
        "event_type": "PAYMENT_CAPTURED",
        "actor": "PAYPAL_SERVICE",
        "description": "Payment successfully captured for ₹7,499.00 INR."
      }
    ]
  }
}
```
