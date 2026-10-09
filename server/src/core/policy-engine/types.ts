export interface PolicyRules {
  max_amount: number;
  min_amount?: number;
  currency: string;
  max_quantity?: number;
  allowed_categories?: string[];
  blocked_categories?: string[];
  allowed_merchants?: string[];
  blocked_merchants?: string[];
  recurring_allowed: boolean;
  approval_required: boolean;
  recheck_on_change?: boolean;
}

export interface ProposalItem {
  sku?: string;
  name: string;
  category: string;
  quantity: number;
  unit_price: number;
  total_price?: number;
}

export interface CartProposal {
  merchant: string;
  currency: string;
  items: ProposalItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  fees: number;
  total: number;
  recurring: boolean;
}

export type DecisionType = 'ALLOW' | 'ASK' | 'BLOCK';

export interface ReasonDetail {
  code: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface EvaluationResult {
  decision: DecisionType;
  reasons: ReasonDetail[];
  passed_checks: string[];
  evaluated_at: string;
}
