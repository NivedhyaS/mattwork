import { z } from 'zod';
import { MattworkFormField } from '@prisma/client';

export const connectFormSchema = z.object({
  formUrl: z.string().min(1, 'Form URL or ID is required'),
});

export const formMappingItemSchema = z.object({
  mattworkField: z.nativeEnum(MattworkFormField, {
    errorMap: () => ({ message: 'Invalid Mattwork form field' }),
  }),
  googleQuestionId: z.string().min(1, 'Google Question ID is required'),
  googleQuestionType: z.string().min(1, 'Google Question Type is required'),
});

export const saveFormMappingSchema = z.object({
  googleFormId: z.string().min(1, 'Google Form ID is required'),
  formTitle: z.string().min(1, 'Form Title is required'),
  mappings: z.array(formMappingItemSchema).min(1, 'At least one field mapping is required'),
  pubsubTopic: z.string().optional(),
});
