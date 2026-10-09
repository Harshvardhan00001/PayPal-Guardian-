import { describe, it, expect } from 'vitest';
import { DeterministicPolicyEngine } from '../../src/core/policy-engine/evaluator.js';
import { PolicyRules, CartProposal } from '../../src/core/policy-engine/types.js';

describe('DeterministicPolicyEngine Tests', () => {
  const basePolicy: PolicyRules = {
    max_amount: 8000,
    currency: 'INR',
    max_quantity: 1,
    allowed_categories: ['running_shoes'],
    blocked_categories: ['subscription', 'gambling'],
    allowed_merchants: [],
    blocked_merchants: ['scamstore.com'],
    recurring_allowed: false,
    approval_required: true,
    recheck_on_change: true
  };

  const baseProposal: CartProposal = {
    merchant: 'Nike Store',
    currency: 'INR',
    items: [
      {
        sku: 'NK-RUN-01',
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

  it('TC-DET-01: Allows transaction when all checks pass and approval is NOT required', () => {
    const autoApprovePolicy = { ...basePolicy, approval_required: false };
    const result = DeterministicPolicyEngine.evaluate(autoApprovePolicy, baseProposal);

    expect(result.decision).toBe('ALLOW');
    expect(result.reasons[0].code).toBe('ALL_CHECKS_PASSED');
    expect(result.passed_checks).toContain('MAX_BUDGET_CHECK');
    expect(result.passed_checks).toContain('QUANTITY_CHECK');
  });

  it('TC-DET-02: Returns ASK when transaction satisfies policy but approval is required', () => {
    const result = DeterministicPolicyEngine.evaluate(basePolicy, baseProposal);

    expect(result.decision).toBe('ASK');
    expect(result.reasons[0].code).toBe('APPROVAL_REQUIRED');
    expect(result.passed_checks).toContain('CURRENCY_CHECK');
    expect(result.passed_checks).toContain('MAX_BUDGET_CHECK');
  });

  it('TC-DET-03: Blocks transaction when budget is exceeded', () => {
    const overBudgetProposal: CartProposal = {
      ...baseProposal,
      subtotal: 8500,
      shipping: 300,
      tax: 400,
      total: 9200
    };

    const result = DeterministicPolicyEngine.evaluate(basePolicy, overBudgetProposal);

    expect(result.decision).toBe('BLOCK');
    const budgetReason = result.reasons.find((r) => r.code === 'BUDGET_EXCEEDED');
    expect(budgetReason).toBeDefined();
    expect(budgetReason?.metadata?.overage).toBe(1200);
  });

  it('TC-DET-04: Blocks transaction when recurring fee is included but prohibited', () => {
    const subscriptionProposal: CartProposal = {
      ...baseProposal,
      recurring: true
    };

    const result = DeterministicPolicyEngine.evaluate(basePolicy, subscriptionProposal);

    expect(result.decision).toBe('BLOCK');
    expect(result.reasons.some((r) => r.code === 'RECURRING_NOT_ALLOWED')).toBe(true);
  });

  it('TC-DET-05: Blocks transaction when cumulative item quantity exceeds max_quantity', () => {
    const multiItemProposal: CartProposal = {
      ...baseProposal,
      items: [
        {
          sku: 'NK-RUN-01',
          name: 'Nike Pegasus 40',
          category: 'running_shoes',
          quantity: 2,
          unit_price: 3500
        }
      ],
      total: 7000
    };

    const result = DeterministicPolicyEngine.evaluate(basePolicy, multiItemProposal);

    expect(result.decision).toBe('BLOCK');
    expect(result.reasons.some((r) => r.code === 'QUANTITY_EXCEEDED')).toBe(true);
  });

  it('TC-DET-06: Blocks transaction when merchant is in blocked_merchants list', () => {
    const blacklistedMerchantProposal: CartProposal = {
      ...baseProposal,
      merchant: 'scamstore.com'
    };

    const result = DeterministicPolicyEngine.evaluate(basePolicy, blacklistedMerchantProposal);

    expect(result.decision).toBe('BLOCK');
    expect(result.reasons.some((r) => r.code === 'MERCHANT_BLOCKED')).toBe(true);
  });

  it('TC-DET-07: Blocks transaction on currency mismatch', () => {
    const usdProposal: CartProposal = {
      ...baseProposal,
      currency: 'USD'
    };

    const result = DeterministicPolicyEngine.evaluate(basePolicy, usdProposal);

    expect(result.decision).toBe('BLOCK');
    expect(result.reasons.some((r) => r.code === 'CURRENCY_MISMATCH')).toBe(true);
  });

  it('TC-DET-08: Blocks item from blacklisted category', () => {
    const blockedCategoryProposal: CartProposal = {
      ...baseProposal,
      items: [
        {
          sku: 'GAMBLE-01',
          name: 'Lottery Token',
          category: 'gambling',
          quantity: 1,
          unit_price: 500
        }
      ],
      total: 500
    };

    const result = DeterministicPolicyEngine.evaluate(basePolicy, blockedCategoryProposal);

    expect(result.decision).toBe('BLOCK');
    expect(result.reasons.some((r) => r.code === 'CATEGORY_BLOCKED')).toBe(true);
  });

  it('TC-DET-09: Blocks item not in allowed category whitelist', () => {
    const unallowedCategoryProposal: CartProposal = {
      ...baseProposal,
      items: [
        {
          sku: 'ACC-01',
          name: 'Running Socks',
          category: 'accessories',
          quantity: 1,
          unit_price: 499
        }
      ],
      total: 499
    };

    const result = DeterministicPolicyEngine.evaluate(basePolicy, unallowedCategoryProposal);

    expect(result.decision).toBe('BLOCK');
    expect(result.reasons.some((r) => r.code === 'CATEGORY_NOT_ALLOWED')).toBe(true);
  });
});
