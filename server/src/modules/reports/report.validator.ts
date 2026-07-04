import { z } from 'zod';

export const getReportSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Must be in YYYY-MM format'),
  format: z.enum(['json', 'excel', 'pdf']).default('json'),
});

export type GetReportQuery = z.infer<typeof getReportSchema>;
