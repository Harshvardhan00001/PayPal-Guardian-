import { CartProposal } from '../policy-engine/types.js';

export interface RiskDetectionResult {
  risk: 'CLEAN' | 'SUSPICIOUS_INSTRUCTION';
  severity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  flagged_patterns: string[];
  details: string[];
}

export class PromptInjectionDetector {
  private static readonly INJECTION_PATTERNS = [
    {
      regex: /(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+)?(?:previous\s+)?(?:instructions|rules|budget|policies|guardians?|limits?)/i,
      severity: 'HIGH' as const,
      description: 'Instruction override attempt targeting policy rules or budget limits'
    },
    {
      regex: /(?:set|change|make)\s+(?:the\s+)?(?:max_amount|budget|limit)\s+(?:to|=)\s*\d+/i,
      severity: 'HIGH' as const,
      description: 'Attempt to dynamically redefine budget limits in untrusted text'
    },
    {
      regex: /(?:system\s+directive|system\s+prompt|developer\s+mode|dan\s+mode|jailbreak)/i,
      severity: 'HIGH' as const,
      description: 'Jailbreak or system prompt usurpation pattern'
    },
    {
      regex: /(?:force|output|return|set)\s+(?:the\s+)?(?:decision|status)\s+(?:to|=)?\s*['"]?(?:allow|approved)['"]?/i,
      severity: 'HIGH' as const,
      description: 'Attempt to force ALLOW decision in untrusted input'
    },
    {
      regex: /(?:do\s+not\s+ask|without\s+asking|skip\s+approval|auto-approve\s+this)/i,
      severity: 'MEDIUM' as const,
      description: 'Attempt to evade human authorization requirement'
    },
    {
      regex: /(?:charge\s+silently|hidden\s+recurring|disguise\s+subscription)/i,
      severity: 'HIGH' as const,
      description: 'Subscription concealment or hidden fee injection pattern'
    }
  ];

  /**
   * Evaluates arbitrary text for prompt injection and untrusted instruction signals.
   */
  public static analyzeText(text: string): RiskDetectionResult {
    if (!text || typeof text !== 'string') {
      return {
        risk: 'CLEAN',
        severity: 'NONE',
        flagged_patterns: [],
        details: []
      };
    }

    const flaggedPatterns: string[] = [];
    const details: string[] = [];
    let maxSeverity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' = 'NONE';

    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.regex.test(text)) {
        flaggedPatterns.push(pattern.regex.source);
        details.push(pattern.description);

        if (pattern.severity === 'HIGH') {
          maxSeverity = 'HIGH';
        } else if (pattern.severity === 'MEDIUM' && maxSeverity !== 'HIGH') {
          maxSeverity = 'MEDIUM';
        }
      }
    }

    const hasRisk = flaggedPatterns.length > 0;
    return {
      risk: hasRisk ? 'SUSPICIOUS_INSTRUCTION' : 'CLEAN',
      severity: maxSeverity,
      flagged_patterns: flaggedPatterns,
      details
    };
  }

  /**
   * Evaluates an entire cart proposal (merchant, items, descriptions) for untrusted instructions.
   */
  public static analyzeProposal(proposal: CartProposal): RiskDetectionResult {
    const fieldsToInspect = [
      proposal.merchant,
      ...proposal.items.map((i) => `${i.name} ${i.sku || ''} ${i.category}`)
    ];

    const allFlagged: string[] = [];
    const allDetails: string[] = [];
    let highestSeverity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' = 'NONE';

    for (const field of fieldsToInspect) {
      const result = this.analyzeText(field);
      if (result.risk === 'SUSPICIOUS_INSTRUCTION') {
        allFlagged.push(...result.flagged_patterns);
        allDetails.push(...result.details);
        if (result.severity === 'HIGH') highestSeverity = 'HIGH';
        else if (result.severity === 'MEDIUM' && highestSeverity !== 'HIGH') highestSeverity = 'MEDIUM';
      }
    }

    const hasRisk = allFlagged.length > 0;
    return {
      risk: hasRisk ? 'SUSPICIOUS_INSTRUCTION' : 'CLEAN',
      severity: highestSeverity,
      flagged_patterns: Array.from(new Set(allFlagged)),
      details: Array.from(new Set(allDetails))
    };
  }
}
