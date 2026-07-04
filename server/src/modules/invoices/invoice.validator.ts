import { z } from 'zod';

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  total: z.number().positive(),
});

export const createInvoiceSchema = z.object({
  projectId: z.string().min(1),
  clientId: z.string().min(1),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  discount: z.coerce.number().min(0).default(0),
  dueDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
  terms: z.string().optional(),
});

export const updateInvoiceSchema = z.object({
  items: z.array(invoiceItemSchema).min(1).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  discount: z.coerce.number().min(0).optional(),
  dueDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'SENT', 'VIEWED', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
});

export const listInvoicesSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(['DRAFT', 'SENT', 'VIEWED', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  clientId: z.string().optional(),
  projectId: z.string().optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesSchema>;
