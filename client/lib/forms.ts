import { api } from '@/lib/api';

export type FormSyncStatus = 'ACTIVE' | 'WATCH_EXPIRING' | 'WATCH_EXPIRED' | 'ERROR';

export type MattworkFormField =
  | 'CLIENT_NAME'
  | 'VIDEO_TITLE'
  | 'PROJECT_TYPE'
  | 'ASSIGNED_DATE'
  | 'DEADLINE_DATE'
  | 'MATERIALS_LINK';

export interface FormQuestion {
  googleQuestionId: string;
  googleQuestionType: string;
  title: string;
  required: boolean;
}

export interface FormDetails {
  googleFormId: string;
  formTitle: string;
  description?: string;
  questions: FormQuestion[];
}

export interface FieldMapping {
  mattworkField: MattworkFormField;
  googleQuestionId: string;
  googleQuestionType: string;
}

export interface FormWatch {
  id: string;
  watchId: string;
  expireTime: string;
  pubsubTopic: string;
  createdAt: string;
}

export interface ConnectedForm {
  id: string;
  googleFormId: string;
  formTitle: string;
  syncStatus: FormSyncStatus;
  lastSyncedAt: string | null;
  createdAt: string;
  connectedByAdmin: { id: string; name: string; email: string };
  mappings: Array<{
    id: string;
    mattworkField: MattworkFormField;
    googleQuestionId: string;
    googleQuestionType: string;
  }>;
  watches: FormWatch[];
  _count: { processedResponses: number };
}

export interface SaveMappingPayload {
  googleFormId: string;
  formTitle: string;
  mappings: FieldMapping[];
  pubsubTopic?: string;
}

// ─── API methods ───────────────────────────────────────────────────────────────

export async function fetchConnectedForms(): Promise<ConnectedForm[]> {
  const res = await api.get('/forms');
  return res.data.data as ConnectedForm[];
}

export async function previewForm(formUrl: string): Promise<FormDetails> {
  const res = await api.post('/forms/connect', { formUrl });
  return res.data.data as FormDetails;
}

export interface SyncSummaryResult {
  processed: number;
  created: number;
  duplicates: number;
  failed: number;
  lastProcessedTimestamp: string | null;
  durationMs: number;
}

export async function saveFormMapping(payload: SaveMappingPayload): Promise<ConnectedForm> {
  const res = await api.post('/forms/mapping', payload);
  return res.data.data as ConnectedForm;
}

export async function renewFormWatch(id: string): Promise<any> {
  const res = await api.post(`/forms/${id}/renew-watch`);
  return res.data.data;
}

export async function syncFormResponses(id: string): Promise<SyncSummaryResult> {
  const res = await api.post(`/forms/${id}/sync`);
  return res.data.data as SyncSummaryResult;
}
