import { z } from 'zod';

export const createProjectSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().optional(),
  clientId: z.string().min(1, 'Client ID is required'),
  editorId: z.string().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  submissionDate: z.coerce.date().optional().nullable(),
  budget: z.coerce.number().positive().optional().nullable(),
  clientPrice: z.coerce.number().positive().optional().nullable(),
  editorPrice: z.coerce.number().positive().optional().nullable(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  driveFolder: z.string().optional(),
  formLink: z.string().optional(),
  rawMaterialsFolder: z.string().optional().nullable(),
});

export const updateProjectSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().optional().nullable(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  clientId: z.string().optional(),
  editorId: z.string().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  submissionDate: z.coerce.date().optional().nullable(),
  budget: z.coerce.number().positive().optional().nullable(),
  clientPrice: z.coerce.number().positive().optional().nullable(),
  editorPrice: z.coerce.number().positive().optional().nullable(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional().nullable(),
  driveFolder: z.string().optional().nullable(),
  formLink: z.string().optional().nullable(),
  rawMaterialsFolder: z.string().optional().nullable(),
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

export const updateProjectPrioritySchema = z.object({
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
});

export const listProjectsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(1000).default(10),
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
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
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
  excludeInvoiced: z.coerce.boolean().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type UpdateProjectStatusInput = z.infer<typeof updateProjectStatusSchema>;
export type UpdateProjectPriorityInput = z.infer<typeof updateProjectPrioritySchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsSchema>;

export const reassignEditorSchema = z.object({
  editorId: z.string().nullable(),
});
export type ReassignEditorInput = z.infer<typeof reassignEditorSchema>;

export const addCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(5000),
});
export type AddCommentInput = z.infer<typeof addCommentSchema>;

export const updateCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(5000),
});
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
