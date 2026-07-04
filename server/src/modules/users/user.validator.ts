import { z } from 'zod';

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().optional().nullable(),
  avatar: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
  role: z.enum(['ADMIN', 'EDITOR', 'CLIENT']).optional(),
});

export const listUsersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  role: z.enum(['ADMIN', 'EDITOR', 'CLIENT']).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain uppercase, lowercase, and a number'
    ),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
