import { z } from 'zod';

export const proposalItemInputSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(1, 'Item name is required'),
  category: z.string().min(1, 'Category is required'),
  quantity: z.number().int().positive('Quantity must be greater than zero'),
  unit_price: z.number().min(0, 'Unit price cannot be negative')
});

export const createProposalSchema = z.object({
  user_id: z.string().optional(),
  policy_id: z.string().min(1, 'Policy ID is required'),
  merchant: z.string().min(1, 'Merchant name is required'),
  currency: z.string().min(3).max(3).default('INR'),
  items: z.array(proposalItemInputSchema).min(1, 'Cart must contain at least one item'),
  shipping: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  fees: z.number().min(0).default(0),
  recurring: z.boolean().default(false)
});

export const approveTransactionSchema = z.object({
  user_id: z.string().optional(),
  snapshot_hash: z.string().length(64, 'Snapshot hash must be a 64-character SHA-256 hex string')
});

export const rejectTransactionSchema = z.object({
  user_id: z.string().optional(),
  reason: z.string().default('Rejected by user')
});

export const mutateProposalSchema = z.object({
  merchant: z.string().optional(),
  currency: z.string().optional(),
  items: z.array(proposalItemInputSchema).optional(),
  shipping: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  fees: z.number().min(0).optional(),
  recurring: z.boolean().optional()
});

export type ProposalItemInput = z.infer<typeof proposalItemInputSchema>;
export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type ApproveTransactionInput = z.infer<typeof approveTransactionSchema>;
export type RejectTransactionInput = z.infer<typeof rejectTransactionSchema>;
export type MutateProposalInput = z.infer<typeof mutateProposalSchema>;
