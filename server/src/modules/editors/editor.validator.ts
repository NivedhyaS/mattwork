import { z } from 'zod';

export const createEditorSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: z
    .string()
    .min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Needs uppercase, lowercase, and number'),
  bio: z.string().max(1000).optional(),
  skills: z.array(z.string()).optional().default([]),
  hourlyRate: z.coerce.number().positive().optional(),
  availability: z.boolean().optional().default(true),
});

export const updateEditorSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(1000).optional().nullable(),
  skills: z.array(z.string()).optional(),
  hourlyRate: z.coerce.number().positive().optional().nullable(),
  availability: z.boolean().optional(),
});

export const listEditorsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(1000).default(10),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  availability: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export type CreateEditorInput = z.infer<typeof createEditorSchema>;
export type UpdateEditorInput = z.infer<typeof updateEditorSchema>;
export type ListEditorsQuery = z.infer<typeof listEditorsSchema>;
