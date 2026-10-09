import { z } from 'zod';

export const parsePolicySchema = z.object({
  text: z.string().min(3, 'Instruction text must be at least 3 characters long')
});

export const policyRulesSchema = z.object({
  max_amount: z.number().positive('max_amount must be greater than zero'),
  min_amount: z.number().positive().optional(),
  currency: z.string().min(3).max(3).default('INR'),
  max_quantity: z.number().int().positive().optional(),
  allowed_categories: z.array(z.string()).default([]),
  blocked_categories: z.array(z.string()).default([]),
  allowed_merchants: z.array(z.string()).default([]),
  blocked_merchants: z.array(z.string()).default([]),
  recurring_allowed: z.boolean().default(false),
  approval_required: z.boolean().default(true),
  recheck_on_change: z.boolean().default(true)
});

export const createPolicySchema = z.object({
  user_id: z.string().optional(),
  name: z.string().min(2, 'Policy name is required'),
  description: z.string().optional(),
  rules: policyRulesSchema
});

export type ParsePolicyInput = z.infer<typeof parsePolicySchema>;
export type CreatePolicyInput = z.infer<typeof createPolicySchema>;
