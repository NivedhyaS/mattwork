import { z } from 'zod';

export const createProjectSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().optional(),
  clientId: z.string().min(1, 'Client ID is required'),
  editorId: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDate: z.coerce.date().optional().nullable(),
  budget: z.coerce.number().positive().optional().nullable(),
  clientPrice: z.coerce.number().positive().optional().nullable(),
  editorPrice: z.coerce.number().positive().optional().nullable(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  driveFolder: z.string().optional(),
  formLink: z.string().url().optional(),
});

export const updateProjectSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().optional().nullable(),
  editorId: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.coerce.date().optional().nullable(),
  budget: z.coerce.number().positive().optional().nullable(),
  clientPrice: z.coerce.number().positive().optional().nullable(),
  editorPrice: z.coerce.number().positive().optional().nullable(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional().nullable(),
  driveFolder: z.string().optional().nullable(),
  formLink: z.string().url().optional().nullable(),
});

export const updateProjectStatusSchema = z.object({
  status: z.enum([
    'NEW_VIDEO',
    'EDITING',
    'EDITING_REVIEW',
    'REVISION_1',
    'REVISION_1_REVIEW',
    'REVISION_2',
    'REVISION_2_REVIEW',
    'FINAL_DRAFT',
    'UPLOADED',
    'CANCELLED',
    'ON_HOLD',
  ]),
});

export const listProjectsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: z
    .enum([
      'NEW_VIDEO',
      'EDITING',
      'EDITING_REVIEW',
      'REVISION_1',
      'REVISION_1_REVIEW',
      'REVISION_2',
      'REVISION_2_REVIEW',
      'FINAL_DRAFT',
      'UPLOADED',
      'CANCELLED',
      'ON_HOLD',
    ])
    .optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  clientId: z.string().optional(),
  editorId: z.string().optional(),
  search: z.string().optional(),
  client: z.string().optional(),
  editor: z.string().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Must be in YYYY-MM format').optional(),
  deadlineBefore: z.coerce.date().optional(),
  deadlineAfter: z.coerce.date().optional(),
  minValue: z.coerce.number().min(0).optional(),
  maxValue: z.coerce.number().min(0).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type UpdateProjectStatusInput = z.infer<typeof updateProjectStatusSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsSchema>;
