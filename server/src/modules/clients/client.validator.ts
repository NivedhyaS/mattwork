import { z } from 'zod';

export const createClientSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: z
    .string()
    .min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Needs uppercase, lowercase, and number'),
  company: z.string().max(200).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
  currency: z.string().length(3).regex(/^[A-Z]{3}$/, 'Must be a 3-letter currency code').optional().default('USD'),
});

export const updateClientSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  company: z.string().max(200).optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  advancePaid: z.coerce.number().min(0).optional().nullable(),
  currency: z.string().length(3).regex(/^[A-Z]{3}$/, 'Must be a 3-letter currency code').optional(),
});

export const listClientsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(1000).default(10),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ListClientsQuery = z.infer<typeof listClientsSchema>;
