import { z } from 'zod';

export const createPaymentSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  method: z
    .enum(['BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'PAYPAL', 'STRIPE', 'CASH', 'OTHER'])
    .default('BANK_TRANSFER'),
  transactionId: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  paidAt: z.coerce.date().optional(),
});

export const updatePaymentSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED']).optional(),
  transactionId: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  paidAt: z.coerce.date().optional().nullable(),
});

export const listPaymentsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  invoiceId: z.string().optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED']).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsSchema>;
