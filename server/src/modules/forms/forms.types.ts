import { MattworkFormField } from '@prisma/client';

export interface ConnectFormInput {
  formUrl: string;
}

export interface FormMappingItemInput {
  mattworkField: MattworkFormField;
  googleQuestionId: string;
  googleQuestionType: string;
}

export interface SaveFormMappingInput {
  googleFormId: string;
  formTitle: string;
  mappings: FormMappingItemInput[];
  pubsubTopic?: string;
}
