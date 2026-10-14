import { describe, it, expect } from 'vitest';
import { PayPalClient } from '../../src/services/paypal/paypal-client.js';
import { PayPalOrderService } from '../../src/services/paypal/paypal-order-service.js';
import { CartProposal } from '../../src/core/policy-engine/types.js';

describe('PayPal Service Unit Tests', () => {
  const proposal: CartProposal = {
    merchant: 'Nike Store',
    currency: 'INR',
    items: [
      {
        sku: 'NK-PEG-40',
        name: 'Nike Pegasus 40',
        category: 'running_shoes',
        quantity: 1,
        unit_price: 7499
      }
    ],
    subtotal: 7499,
    shipping: 0,
    tax: 0,
    fees: 0,
    total: 7499,
    recurring: false
  };

  it('PayPalClient detects mock mode with placeholder sandbox credentials', async () => {
    const client = new PayPalClient();
    expect(client.isMock()).toBe(true);

    const token1 = await client.getAccessToken();
    expect(token1).toContain('mock_paypal_token');

    // Subsequent call should reuse token cache
    const token2 = await client.getAccessToken();
    expect(token1).toBe(token2);
  });

  it('PayPalOrderService.createOrder generates valid mock order ID and approval link', async () => {
    const service = new PayPalOrderService();
    const result = await service.createOrder(proposal, 'tx_test_123456');

    expect(result.orderId).toContain('MOCK-PAYPAL-ORD-TX_TEST_');
    expect(result.approvalUrl).toContain('https://www.sandbox.paypal.com/checkoutnow?token=');
    expect(result.rawResponse.status).toBe('CREATED');
  });

  it('PayPalOrderService.captureOrder completes order with receipt', async () => {
    const service = new PayPalOrderService();
    const result = await service.captureOrder('MOCK-ORD-999', 'tx_test_123456', {
      currency: 'INR',
      value: 7499
    });

    expect(result.status).toBe('COMPLETED');
    expect(result.captureId).toContain('MOCK-CAPTURE-');
    expect(result.amount.value).toBe('7499.00');
    expect(result.amount.currency).toBe('INR');
  });
});
