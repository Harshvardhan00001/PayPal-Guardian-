# 05. PayPal Integration & Checkout Flow

## 1. PayPal Orders v2 Architecture Overview

PayPal Guardian uses the **PayPal Orders v2 REST API** with a strictly server-authoritative pattern. No client credentials, access tokens, or direct capture capabilities exist on the frontend or within AI agent memory.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Frontend as Next.js 14 Client
    participant Backend as Guardian Server
    participant DB as PostgreSQL
    participant PayPal as PayPal Sandbox API

    Note over User, PayPal: 1. User has approved snapshot hash on Guardian
    User->>Frontend: Clicks "Approve & Pay with PayPal"
    Frontend->>Backend: POST /api/payments/paypal/create-order { tx_id, snapshot_hash }
    Backend->>Backend: Re-verify snapshot_hash matches proposal
    Backend->>PayPal: POST /v2/checkout/orders (Intent: CAPTURE, Header: PayPal-Request-Id)
    PayPal-->>Backend: 201 Created { id: "ORD_789", links: [{ rel: "approve", href: "..." }] }
    Backend->>DB: Store paypal_orders record, set status = PAYPAL_CREATED
    Backend-->>Frontend: { paypal_order_id: "ORD_789", approval_url: "..." }

    Frontend->>PayPal: Opens PayPal Checkout (Redirect / SDK Modal)
    User->>PayPal: Logs in to Sandbox & Approves Transaction
    PayPal-->>Frontend: Redirects back to return_url?token=ORD_789&PayerID=XYZ

    Frontend->>Backend: POST /api/payments/paypal/capture { tx_id, paypal_order_id, expected_snapshot_hash }
    Backend->>Backend: 2. FINAL INTEGRITY CHECK (Current Hash === Expected Hash)
    Backend->>PayPal: POST /v2/checkout/orders/ORD_789/capture (Header: PayPal-Request-Id)
    PayPal-->>Backend: 201 Created { status: "COMPLETED", id: "CAP_456" }
    Backend->>DB: Update tx status = COMPLETED, record capture_id
    Backend->>DB: Log Audit Event (PAYMENT_COMPLETED)
    Backend-->>Frontend: { status: "COMPLETED", amount: "7499.00" }

    Note over PayPal, Backend: Asynchronous Webhook Confirmation
    PayPal->>Backend: POST /api/webhooks/paypal { event_type: "PAYMENT.CAPTURE.COMPLETED" }
    Backend->>Backend: Verify Webhook Signature via PayPal API
    Backend->>DB: Record webhook_events idempotently
```

---

## 2. Server-Side Service Implementation

### 2.1 OAuth2 Token Management
PayPal OAuth2 access tokens have a lifespan of 9 hours (32,400 seconds). Guardian caches tokens in-memory and refreshes them 5 minutes prior to expiry.

```typescript
// src/services/paypal/paypal-client.ts

interface TokenCache {
  token: string;
  expiresAt: number;
}

export class PayPalClient {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private tokenCache: TokenCache | null = null;

  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID || '';
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
    this.baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
  }

  public async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 300000) {
      return this.tokenCache.token;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      throw new Error(`Failed to obtain PayPal OAuth token: ${response.statusText}`);
    }

    const data = await response.json();
    this.tokenCache = {
      token: data.access_token,
      expiresAt: now + (data.expires_in * 1000)
    };
    return this.tokenCache.token;
  }
}
```

### 2.2 Create Order Implementation
Orders are created with granular line items and breakdown matching the evaluated cart proposal.

```typescript
// src/services/paypal/paypal-order-service.ts

import { PayPalClient } from './paypal-client';
import { CartProposal } from '../../core/policy-engine/types';

export class PayPalOrderService {
  private client: PayPalClient;

  constructor() {
    this.client = new PayPalClient();
  }

  public async createOrder(proposal: CartProposal, transactionId: string): Promise<{ orderId: string; approvalUrl: string }> {
    const token = await this.client.getAccessToken();
    const idempotencyKey = `create_order_${transactionId}`;

    const payload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: transactionId,
          description: `Guardian Controlled Order - ${proposal.merchant}`,
          amount: {
            currency_code: proposal.currency === 'INR' ? 'INR' : 'USD',
            value: proposal.total.toFixed(2),
            breakdown: {
              item_total: {
                currency_code: proposal.currency === 'INR' ? 'INR' : 'USD',
                value: proposal.subtotal.toFixed(2)
              },
              shipping: {
                currency_code: proposal.currency === 'INR' ? 'INR' : 'USD',
                value: proposal.shipping.toFixed(2)
              },
              tax_total: {
                currency_code: proposal.currency === 'INR' ? 'INR' : 'USD',
                value: proposal.tax.toFixed(2)
              }
            }
          },
          items: proposal.items.map(item => ({
            name: item.name.substring(0, 127),
            sku: item.sku || 'N/A',
            unit_amount: {
              currency_code: proposal.currency === 'INR' ? 'INR' : 'USD',
              value: item.unit_price.toFixed(2)
            },
            quantity: item.quantity.toString(),
            category: 'PHYSICAL_GOODS'
          }))
        }
      ],
      application_context: {
        brand_name: 'PayPal Guardian Safe Checkout',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `${process.env.APP_BASE_URL}/checkout/success?tx_id=${transactionId}`,
        cancel_url: `${process.env.APP_BASE_URL}/checkout/cancelled?tx_id=${transactionId}`
      }
    };

    const response = await fetch(`${process.env.PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': idempotencyKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`PayPal Create Order Failed: ${err}`);
    }

    const orderData = await response.json();
    const approveLink = orderData.links.find((l: any) => l.rel === 'approve')?.href;

    if (!approveLink) {
      throw new Error('PayPal did not return an approval URL');
    }

    return {
      orderId: orderData.id,
      approvalUrl: approveLink
    };
  }

  public async captureOrder(paypalOrderId: string, transactionId: string): Promise<any> {
    const token = await this.client.getAccessToken();
    const idempotencyKey = `capture_order_${transactionId}`;

    const response = await fetch(`${process.env.PAYPAL_BASE_URL}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': idempotencyKey
      }
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`PayPal Capture Order Failed: ${err}`);
    }

    return await response.json();
  }
}
```

---

## 3. Webhook Ingestion & Signature Verification

To guard against malicious spoofing of payment events, webhooks are verified via PayPal's signature verification endpoint:

```typescript
// src/services/paypal/webhook-verifier.ts

import { PayPalClient } from './paypal-client';

export class PayPalWebhookVerifier {
  private client: PayPalClient;

  constructor() {
    this.client = new PayPalClient();
  }

  public async verifySignature(headers: Record<string, string>, body: any): Promise<boolean> {
    const token = await this.client.getAccessToken();

    const verificationPayload = {
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: body
    };

    const response = await fetch(`${process.env.PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(verificationPayload)
    });

    if (!response.ok) return false;
    const resJson = await response.json();
    return resJson.verification_status === 'SUCCESS';
  }
}
```

---

## 4. Environment Variables Configuration

Create a `.env` file in the project root with the following configuration:

```env
# Server Configuration
PORT=4000
NODE_ENV=development
APP_BASE_URL=http://localhost:3000

# Database Connection (PostgreSQL)
DATABASE_URL="postgresql://guardian_user:guardian_pass@localhost:5432/guardian_db?schema=public"

# AI Provider Configuration (Google Gemini / OpenAI)
AI_PROVIDER=gemini # or "openai"
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# PayPal Sandbox Credentials
# Obtain from https://developer.paypal.com/dashboard/applications/sandbox
PAYPAL_CLIENT_ID=your_sandbox_client_id_here
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret_here
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_WEBHOOK_ID=your_registered_webhook_id_here

# Security & Tokens
JWT_SECRET=super_secret_guardian_session_key_32chars
AGENT_SHARED_SECRET=guardian_ai_agent_dev_token_456
```
