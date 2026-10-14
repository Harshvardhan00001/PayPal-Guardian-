import { PayPalClient } from './paypal-client.js';
import { CartProposal } from '../../core/policy-engine/types.js';

export interface CreateOrderResult {
  orderId: string;
  approvalUrl: string;
  rawResponse: Record<string, any>;
}

export interface CaptureOrderResult {
  paypalOrderId: string;
  captureId: string;
  status: string;
  amount: {
    currency: string;
    value: string;
  };
  rawResponse: Record<string, any>;
}

export class PayPalOrderService {
  private client: PayPalClient;

  constructor() {
    this.client = new PayPalClient();
  }

  /**
   * Creates a PayPal Orders v2 instance with itemized purchase breakdown.
   */
  public async createOrder(proposal: CartProposal, transactionId: string): Promise<CreateOrderResult> {
    const idempotencyKey = `create_order_${transactionId}`;
    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

    if (this.client.isMock()) {
      const mockOrderId = `MOCK-PAYPAL-ORD-${transactionId.substring(0, 8).toUpperCase()}`;
      return {
        orderId: mockOrderId,
        approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${mockOrderId}`,
        rawResponse: {
          id: mockOrderId,
          status: 'CREATED',
          intent: 'CAPTURE',
          mock_mode: true
        }
      };
    }

    const token = await this.client.getAccessToken();
    const currencyCode = proposal.currency === 'INR' ? 'INR' : 'USD';

    const payload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: transactionId,
          description: `PayPal Guardian Protected Order - ${proposal.merchant}`,
          amount: {
            currency_code: currencyCode,
            value: proposal.total.toFixed(2),
            breakdown: {
              item_total: {
                currency_code: currencyCode,
                value: proposal.subtotal.toFixed(2)
              },
              shipping: {
                currency_code: currencyCode,
                value: proposal.shipping.toFixed(2)
              },
              tax_total: {
                currency_code: currencyCode,
                value: proposal.tax.toFixed(2)
              }
            }
          },
          items: proposal.items.map((item) => ({
            name: item.name.substring(0, 127),
            sku: (item.sku || 'N/A').substring(0, 100),
            unit_amount: {
              currency_code: currencyCode,
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
        return_url: `${appBaseUrl}/checkout/success?tx_id=${transactionId}`,
        cancel_url: `${appBaseUrl}/checkout/cancelled?tx_id=${transactionId}`
      }
    };

    const response = await fetch(`${this.client.getBaseUrl()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': idempotencyKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`PayPal Create Order Failed: ${response.status} ${errText}`);
    }

    const orderData = (await response.json()) as any;
    const approveLink = orderData.links?.find((l: any) => l.rel === 'approve')?.href;

    if (!approveLink) {
      throw new Error('PayPal did not return an approval URL');
    }

    return {
      orderId: orderData.id,
      approvalUrl: approveLink,
      rawResponse: orderData
    };
  }

  /**
   * Captures an approved PayPal order.
   */
  public async captureOrder(
    paypalOrderId: string,
    transactionId: string,
    amount: { currency: string; value: number }
  ): Promise<CaptureOrderResult> {
    const idempotencyKey = `capture_order_${transactionId}`;

    if (this.client.isMock()) {
      const mockCaptureId = `MOCK-CAPTURE-${Date.now()}`;
      return {
        paypalOrderId,
        captureId: mockCaptureId,
        status: 'COMPLETED',
        amount: {
          currency: amount.currency,
          value: amount.value.toFixed(2)
        },
        rawResponse: {
          id: paypalOrderId,
          status: 'COMPLETED',
          mock_mode: true
        }
      };
    }

    const token = await this.client.getAccessToken();

    const response = await fetch(`${this.client.getBaseUrl()}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': idempotencyKey
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`PayPal Capture Order Failed: ${response.status} ${errText}`);
    }

    const captureData = (await response.json()) as any;
    const captureUnit = captureData.purchase_units?.[0]?.payments?.captures?.[0];

    return {
      paypalOrderId,
      captureId: captureUnit?.id || captureData.id,
      status: captureData.status,
      amount: {
        currency: captureUnit?.amount?.currency_code || amount.currency,
        value: captureUnit?.amount?.value || amount.value.toFixed(2)
      },
      rawResponse: captureData
    };
  }
}
