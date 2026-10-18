import { z } from 'zod';

export const createPaymentOrderSchema = z.object({
  transaction_id: z.string().min(1, 'Transaction ID is required')
});

export const capturePaymentSchema = z.object({
  transaction_id: z.string().min(1, 'Transaction ID is required'),
  paypal_order_id: z.string().optional(),
  expected_snapshot_hash: z.string().optional()
});

export type CreatePaymentOrderInput = z.infer<typeof createPaymentOrderSchema>;
export type CapturePaymentInput = z.infer<typeof capturePaymentSchema>;
