import { PolicyRules } from '../../core/policy-engine/types.js';

export interface ParsedPolicyResponse {
  interpreted_policy: {
    name: string;
    description: string;
    rules: PolicyRules;
  };
  ambiguities: string[];
  confidence_score: number;
  summary_bullets: string[];
  provider: 'gemini' | 'openai' | 'heuristic_engine';
}

export class AIService {
  private geminiKey?: string;
  private openAiKey?: string;

  constructor() {
    this.geminiKey = process.env.GEMINI_API_KEY;
    this.openAiKey = process.env.OPENAI_API_KEY;
  }

  /**
   * Translates natural language into a structured PolicyRules JSON schema.
   */
  public async parsePolicy(text: string): Promise<ParsedPolicyResponse> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('Instruction text cannot be empty');
    }

    // Attempt Gemini if real key is configured
    if (this.geminiKey && !this.geminiKey.includes('mock') && !this.geminiKey.includes('placeholder')) {
      try {
        return await this.parseWithGemini(trimmed);
      } catch (err) {
        console.warn('Gemini API call failed, falling back to heuristic engine:', err);
      }
    }

    // Attempt OpenAI if real key is configured
    if (this.openAiKey && !this.openAiKey.includes('mock') && !this.openAiKey.includes('placeholder')) {
      try {
        return await this.parseWithOpenAI(trimmed);
      } catch (err) {
        console.warn('OpenAI API call failed, falling back to heuristic engine:', err);
      }
    }

    // Resilient, zero-dependency heuristic parser
    return this.parseWithHeuristics(trimmed);
  }

  /**
   * Google Gemini 1.5 Structured Output Parser
   */
  private async parseWithGemini(text: string): Promise<ParsedPolicyResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiKey}`;
    
    const systemPrompt = `You are the PayPal Guardian Policy Translation Engine.
Convert human shopping safety instructions into a structured JSON policy.
Schema definition:
{
  "name": string,
  "description": string,
  "max_amount": number,
  "currency": "INR" | "USD" | "EUR" | "GBP",
  "max_quantity": number,
  "allowed_categories": string[],
  "blocked_categories": string[],
  "allowed_merchants": string[],
  "blocked_merchants": string[],
  "recurring_allowed": boolean,
  "approval_required": boolean,
  "recheck_on_change": boolean,
  "summary_bullets": string[],
  "ambiguities": string[]
}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\nHuman instruction:\n"${text}"` }
            ]
          }
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.1
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(rawJson);

    return {
      interpreted_policy: {
        name: parsed.name || 'Custom Guardian Policy',
        description: parsed.description || text,
        rules: {
          max_amount: Number(parsed.max_amount) || 5000,
          currency: parsed.currency || 'INR',
          max_quantity: parsed.max_quantity || 1,
          allowed_categories: parsed.allowed_categories || [],
          blocked_categories: parsed.blocked_categories || [],
          allowed_merchants: parsed.allowed_merchants || [],
          blocked_merchants: parsed.blocked_merchants || [],
          recurring_allowed: Boolean(parsed.recurring_allowed),
          approval_required: parsed.approval_required !== false,
          recheck_on_change: true
        }
      },
      ambiguities: parsed.ambiguities || [],
      confidence_score: 0.96,
      summary_bullets: parsed.summary_bullets || [
        `Maximum budget: ₹${parsed.max_amount || 5000}`,
        `Approval required: ${parsed.approval_required !== false ? 'Yes' : 'No'}`
      ],
      provider: 'gemini'
    };
  }

  /**
   * OpenAI Structured Output Parser
   */
  private async parseWithOpenAI(text: string): Promise<ParsedPolicyResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openAiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Convert shopping instructions into structured JSON: max_amount, currency (INR/USD), max_quantity, allowed_categories, blocked_categories, recurring_allowed, approval_required, summary_bullets.'
          },
          { role: 'user', content: text }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    const parsed = JSON.parse(data.choices[0].message.content);

    return {
      interpreted_policy: {
        name: parsed.name || 'Custom Guardian Policy',
        description: parsed.description || text,
        rules: {
          max_amount: Number(parsed.max_amount) || 5000,
          currency: parsed.currency || 'INR',
          max_quantity: parsed.max_quantity || 1,
          allowed_categories: parsed.allowed_categories || [],
          blocked_categories: parsed.blocked_categories || [],
          allowed_merchants: parsed.allowed_merchants || [],
          blocked_merchants: parsed.blocked_merchants || [],
          recurring_allowed: Boolean(parsed.recurring_allowed),
          approval_required: parsed.approval_required !== false,
          recheck_on_change: true
        }
      },
      ambiguities: parsed.ambiguities || [],
      confidence_score: 0.95,
      summary_bullets: parsed.summary_bullets || [],
      provider: 'openai'
    };
  }

  /**
   * Resilient Heuristic Pattern Extractor for offline and local testing
   */
  public parseWithHeuristics(text: string): ParsedPolicyResponse {
    const lower = text.toLowerCase();
    const summaryBullets: string[] = [];
    const ambiguities: string[] = [];

    // 1. Currency Extraction
    let currency = 'INR';
    if (lower.includes('$') || lower.includes('usd') || lower.includes('dollar')) {
      currency = 'USD';
    } else if (lower.includes('€') || lower.includes('eur')) {
      currency = 'EUR';
    } else if (lower.includes('£') || lower.includes('gbp')) {
      currency = 'GBP';
    }

    // 2. Budget Extraction
    let maxAmount = 8000;
    const kMatch = lower.match(/(?:under|below|max|up to|spend(?:ing)?|within)?\s*₹?\s*(\d+(?:\.\d+)?)\s*k\b/i);
    const amountMatch = lower.match(/(?:under|below|max|up to|spend(?:ing)?|within)?\s*[₹$€£]?\s*(\d[\d,]+(?:\.\d+)?)/i);

    if (kMatch) {
      maxAmount = parseFloat(kMatch[1]) * 1000;
    } else if (amountMatch) {
      const cleaned = amountMatch[1].replace(/,/g, '');
      maxAmount = parseFloat(cleaned);
    } else {
      ambiguities.push('Maximum budget not explicitly specified; defaulted to ₹8,000.');
    }

    const symbol = currency === 'INR' ? '₹' : '$';
    summaryBullets.push(`Budget Limit: Maximum ${symbol}${maxAmount.toLocaleString()} per order`);

    // 3. Quantity Extraction
    let maxQuantity = 1;
    if (lower.includes('one pair') || lower.includes('1 pair') || lower.includes('single') || lower.includes('only 1')) {
      maxQuantity = 1;
    } else {
      const qtyMatch = lower.match(/(?:quantity|items?|max|count)\s*(?:of|is|:)?\s*(\d+)/i);
      if (qtyMatch) {
        maxQuantity = parseInt(qtyMatch[1], 10);
      }
    }
    summaryBullets.push(`Quantity Limit: Maximum ${maxQuantity} item(s)`);

    // 4. Subscriptions / Recurring
    let recurringAllowed = false;
    if (lower.includes('no subscription') || lower.includes('no recurring') || lower.includes('no add-on') || lower.includes('without subscription')) {
      recurringAllowed = false;
      summaryBullets.push('Subscriptions & Recurring Charges: Strictly Prohibited');
    } else if (lower.includes('allow subscription') || lower.includes('subscriptions ok')) {
      recurringAllowed = true;
      summaryBullets.push('Subscriptions & Recurring Charges: Permitted');
    } else {
      recurringAllowed = false;
      summaryBullets.push('Subscriptions: Disabled by default for safety');
    }

    // 5. Human Approval Requirement
    let approvalRequired = true;
    if (lower.includes('ask me') || lower.includes('ask before') || lower.includes('approval required') || lower.includes('confirm before')) {
      approvalRequired = true;
      summaryBullets.push('Authorization: Human confirmation required before payment');
    } else if (lower.includes('without asking') || lower.includes('auto-approve') || lower.includes('automatically pay')) {
      approvalRequired = false;
      summaryBullets.push('Authorization: Auto-approve permitted within limits');
    } else {
      approvalRequired = true;
      summaryBullets.push('Authorization: Human approval required (Guardian default)');
    }

    // 6. Category Extraction
    const allowedCategories: string[] = [];
    const blockedCategories: string[] = [];

    if (lower.includes('running shoe') || lower.includes('shoes') || lower.includes('sneaker')) {
      allowedCategories.push('running_shoes');
      summaryBullets.push('Allowed Category: Running Shoes / Sneakers');
    }
    if (lower.includes('grocer')) {
      allowedCategories.push('groceries');
      summaryBullets.push('Allowed Category: Groceries');
    }
    if (lower.includes('office supply') || lower.includes('supplies')) {
      allowedCategories.push('office_supplies');
      summaryBullets.push('Allowed Category: Office Supplies');
    }

    if (!recurringAllowed) {
      blockedCategories.push('subscription');
    }

    const rules: PolicyRules = {
      max_amount: maxAmount,
      currency,
      max_quantity: maxQuantity,
      allowed_categories: allowedCategories,
      blocked_categories: blockedCategories,
      allowed_merchants: [],
      blocked_merchants: [],
      recurring_allowed: recurringAllowed,
      approval_required: approvalRequired,
      recheck_on_change: true
    };

    return {
      interpreted_policy: {
        name: allowedCategories.length > 0
          ? `${allowedCategories[0].replace('_', ' ').toUpperCase()} Spending Policy`
          : 'Guardian Spending Policy',
        description: text,
        rules
      },
      ambiguities,
      confidence_score: 0.95,
      summary_bullets: summaryBullets,
      provider: 'heuristic_engine'
    };
  }
}
