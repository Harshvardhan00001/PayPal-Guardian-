import { PayPalClient } from './paypal-client.js';

export class WebhookSignatureError extends Error {
  constructor(message = 'Invalid PayPal webhook signature') {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}

export class PayPalWebhookVerifier {
  private client: PayPalClient;

  constructor() {
    this.client = new PayPalClient();
  }

  /**
   * Cryptographically verifies PayPal webhook signature via PayPal REST API.
   */
  public async verifySignature(headers: Record<string, string | string[] | undefined>, body: any): Promise<boolean> {
    const authAlgo = this.getHeader(headers, 'paypal-auth-algo');
    const certUrl = this.getHeader(headers, 'paypal-cert-url');
    const transmissionId = this.getHeader(headers, 'paypal-transmission-id');
    const transmissionSig = this.getHeader(headers, 'paypal-transmission-sig');
    const transmissionTime = this.getHeader(headers, 'paypal-transmission-time');

    if (this.client.isMock()) {
      // In mock mode, reject if explicitly simulated as invalid
      if (transmissionSig === 'INVALID_MOCK_SIGNATURE') {
        return false;
      }
      return true;
    }

    if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
      return false;
    }

    try {
      const token = await this.client.getAccessToken();
      const webhookId = process.env.PAYPAL_WEBHOOK_ID || '';

      const verificationPayload = {
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: body
      };

      const response = await fetch(`${this.client.getBaseUrl()}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(verificationPayload)
      });

      if (!response.ok) {
        return false;
      }

      const resJson = (await response.json()) as any;
      return resJson.verification_status === 'SUCCESS';
    } catch (err) {
      console.error('PayPal webhook verification failed:', err);
      return false;
    }
  }

  private getHeader(headers: Record<string, string | string[] | undefined>, key: string): string | undefined {
    const val = headers[key] || headers[key.toLowerCase()];
    if (Array.isArray(val)) return val[0];
    return val;
  }
}
