interface TokenCache {
  token: string;
  expiresAt: number;
}

export class PayPalClient {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private tokenCache: TokenCache | null = null;
  private isMockMode: boolean;

  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID || 'sandbox_client_id_placeholder';
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET || 'sandbox_client_secret_placeholder';
    this.baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

    // Enable mock mode if explicitly configured or using placeholder credentials
    this.isMockMode =
      process.env.PAYPAL_MODE === 'mock' ||
      this.clientId.includes('placeholder') ||
      this.clientId.includes('mock');
  }

  public isMock(): boolean {
    return this.isMockMode;
  }

  /**
   * Retrieves or refreshes OAuth2 Bearer Access Token with automatic caching.
   */
  public async getAccessToken(): Promise<string> {
    const now = Date.now();

    // Return cached token if valid for at least 5 more minutes
    if (this.tokenCache && this.tokenCache.expiresAt > now + 300000) {
      return this.tokenCache.token;
    }

    if (this.isMockMode) {
      this.tokenCache = {
        token: `mock_paypal_token_${Date.now()}`,
        expiresAt: now + 32400000 // 9 hours
      };
      return this.tokenCache.token;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to obtain PayPal OAuth token: ${response.status} ${errText}`);
    }

    const data = (await response.json()) as any;
    this.tokenCache = {
      token: data.access_token,
      expiresAt: now + data.expires_in * 1000
    };

    return this.tokenCache.token;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }
}
