import { PolicyRules, CartProposal, EvaluationResult, ReasonDetail } from './types.js';

export class DeterministicPolicyEngine {
  /**
   * Deterministically evaluates a proposed cart against an active policy.
   * Pure function: Zero external I/O, zero LLM, strictly reproducible.
   */
  public static evaluate(policy: PolicyRules, proposal: CartProposal): EvaluationResult {
    const reasons: ReasonDetail[] = [];
    const passed_checks: string[] = [];
    let isBlocked = false;

    // 1. Currency Validation
    const policyCurrency = policy.currency.trim().toUpperCase();
    const proposalCurrency = proposal.currency.trim().toUpperCase();

    if (proposalCurrency !== policyCurrency) {
      isBlocked = true;
      reasons.push({
        code: 'CURRENCY_MISMATCH',
        message: `Order currency ${proposal.currency} does not match allowed policy currency ${policy.currency}.`,
        metadata: { expected: policy.currency, received: proposal.currency }
      });
    } else {
      passed_checks.push('CURRENCY_CHECK');
    }

    // 2. Budget Threshold Evaluation
    const totalAmount = Number(proposal.total.toFixed(2));
    if (totalAmount > policy.max_amount) {
      isBlocked = true;
      const overage = Number((totalAmount - policy.max_amount).toFixed(2));
      const symbol = policyCurrency === 'INR' ? '₹' : '$';
      reasons.push({
        code: 'BUDGET_EXCEEDED',
        message: `Total amount ${symbol}${totalAmount.toLocaleString()} exceeds policy maximum of ${symbol}${policy.max_amount.toLocaleString()} by ${symbol}${overage.toLocaleString()}.`,
        metadata: { limit: policy.max_amount, actual: totalAmount, overage }
      });
    } else {
      passed_checks.push('MAX_BUDGET_CHECK');
    }

    if (policy.min_amount !== undefined && totalAmount < policy.min_amount) {
      isBlocked = true;
      const symbol = policyCurrency === 'INR' ? '₹' : '$';
      reasons.push({
        code: 'BUDGET_BELOW_MINIMUM',
        message: `Total amount ${symbol}${totalAmount.toLocaleString()} is below required minimum of ${symbol}${policy.min_amount.toLocaleString()}.`,
        metadata: { min_limit: policy.min_amount, actual: totalAmount }
      });
    }

    // 3. Recurring / Subscription Charge Check
    if (proposal.recurring && !policy.recurring_allowed) {
      isBlocked = true;
      reasons.push({
        code: 'RECURRING_NOT_ALLOWED',
        message: 'Order includes recurring subscription charges, which are prohibited by your policy.',
        metadata: { recurring: proposal.recurring }
      });
    } else {
      passed_checks.push('RECURRING_CHECK');
    }

    // 4. Quantity Protection Check
    const totalQuantity = proposal.items.reduce((sum, item) => sum + item.quantity, 0);
    if (policy.max_quantity !== undefined && totalQuantity > policy.max_quantity) {
      isBlocked = true;
      reasons.push({
        code: 'QUANTITY_EXCEEDED',
        message: `Total item quantity (${totalQuantity}) exceeds maximum permitted quantity (${policy.max_quantity}).`,
        metadata: { max_allowed: policy.max_quantity, actual_quantity: totalQuantity }
      });
    } else {
      passed_checks.push('QUANTITY_CHECK');
    }

    // 5. Category Rules Evaluation
    const blockedCats = (policy.blocked_categories || []).map((c) => c.trim().toLowerCase());
    const allowedCats = (policy.allowed_categories || []).map((c) => c.trim().toLowerCase());

    for (const item of proposal.items) {
      const itemCat = item.category.trim().toLowerCase();

      // Check Category Blacklist
      if (blockedCats.includes(itemCat)) {
        isBlocked = true;
        reasons.push({
          code: 'CATEGORY_BLOCKED',
          message: `Item '${item.name}' belongs to blocked category '${item.category}'.`,
          metadata: { item_name: item.name, category: item.category }
        });
      }

      // Check Category Whitelist
      if (allowedCats.length > 0 && !allowedCats.includes(itemCat)) {
        isBlocked = true;
        reasons.push({
          code: 'CATEGORY_NOT_ALLOWED',
          message: `Item '${item.name}' category '${item.category}' is not in allowed categories whitelist.`,
          metadata: { item_name: item.name, category: item.category, allowed: allowedCats }
        });
      }
    }

    if (!isBlocked && (allowedCats.length > 0 || blockedCats.length > 0)) {
      passed_checks.push('CATEGORY_CHECK');
    }

    // 6. Merchant Rules Evaluation
    const merchantNorm = proposal.merchant.trim().toLowerCase();
    const blockedMerchants = (policy.blocked_merchants || []).map((m) => m.trim().toLowerCase());
    const allowedMerchants = (policy.allowed_merchants || []).map((m) => m.trim().toLowerCase());

    if (blockedMerchants.includes(merchantNorm)) {
      isBlocked = true;
      reasons.push({
        code: 'MERCHANT_BLOCKED',
        message: `Merchant '${proposal.merchant}' is on your blocked merchants list.`,
        metadata: { merchant: proposal.merchant }
      });
    }

    if (allowedMerchants.length > 0 && !allowedMerchants.includes(merchantNorm)) {
      isBlocked = true;
      reasons.push({
        code: 'MERCHANT_NOT_ALLOWED',
        message: `Merchant '${proposal.merchant}' is not on your approved merchant whitelist.`,
        metadata: { merchant: proposal.merchant, allowed: allowedMerchants }
      });
    }

    if (!isBlocked && (allowedMerchants.length > 0 || blockedMerchants.length > 0)) {
      passed_checks.push('MERCHANT_CHECK');
    }

    // Return Decision
    if (isBlocked) {
      return {
        decision: 'BLOCK',
        reasons,
        passed_checks,
        evaluated_at: new Date().toISOString()
      };
    }

    // 7. Human Authorization Gate
    if (policy.approval_required) {
      reasons.push({
        code: 'APPROVAL_REQUIRED',
        message: 'Order satisfies all financial rules. Explicit human approval is required before payment execution.'
      });
      return {
        decision: 'ASK',
        reasons,
        passed_checks,
        evaluated_at: new Date().toISOString()
      };
    }

    return {
      decision: 'ALLOW',
      reasons: [{ code: 'ALL_CHECKS_PASSED', message: 'Order passes all policy constraints.' }],
      passed_checks,
      evaluated_at: new Date().toISOString()
    };
  }
}
