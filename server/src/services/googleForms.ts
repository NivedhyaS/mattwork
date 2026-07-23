import { google, forms_v1 } from 'googleapis';
import { env } from '../config/env';
import { logger } from '../config/logger';

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface FormQuestionItem {
  googleQuestionId: string;
  googleQuestionType: string;
  title: string;
  required: boolean;
}

export interface FormDetails {
  googleFormId: string;
  formTitle: string;
  description?: string;
  questions: FormQuestionItem[];
}

export interface FormWatchResult {
  watchId: string;
  expireTime: string;
  pubsubTopic: string;
}

export interface FormResponseAnswer {
  /** Google question ID (key in the answers map) */
  questionId: string;
  /** First/only text value (null for unanswered questions) */
  textValue: string | null;
  /** All text values for multi-select answers */
  textValues: string[];
}

export interface FormResponse {
  responseId: string;
  createTime: string;
  lastSubmittedTime: string;
  answers: FormResponseAnswer[];
}

// ─── ID extraction helper ─────────────────────────────────────────────────────

/**
 * Extracts a Google Form ID from various URL formats or a raw ID string.
 */
export function extractGoogleFormId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // Pattern 1: /forms/d/e/<ID>/ or /forms/d/<ID>/
  const match = trimmed.match(/\/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]{10,})/);
  if (match && match[1]) return match[1];

  // Pattern 2: Generic /d/<ID>
  const dMatch = trimmed.match(/\/d\/(?:e\/)?([a-zA-Z0-9_-]{10,})/);
  if (dMatch && dMatch[1]) return dMatch[1];

  // Pattern 3: Direct raw form ID
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;

  return null;
}

// ─── Service class ────────────────────────────────────────────────────────────

export class GoogleFormsService {
  /**
   * Initialises an authenticated Google Forms v1 API client using the shared
   * OAuth2 credentials from environment variables.
   */
  private getClient(): forms_v1.Forms | null {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = env;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
      logger.warn(
        '[GoogleFormsService] Missing OAuth2 credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN)'
      );
      return null;
    }

    try {
      const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
      oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
      return google.forms({ version: 'v1', auth: oauth2Client });
    } catch (err: any) {
      logger.error(`[GoogleFormsService] Failed to initialize Google Forms client: ${err?.message}`);
      return null;
    }
  }

  // ── forms.get ──────────────────────────────────────────────────────────────

  /**
   * Fetches form metadata and the list of questions for a given Form ID.
   */
  async getForm(formId: string): Promise<FormDetails> {
    const formsClient = this.getClient();
    if (!formsClient) {
      throw new Error('Google Forms service is not initialized — missing OAuth credentials');
    }

    try {
      const response = await formsClient.forms.get({ formId });
      const form = response.data;

      const questions: FormQuestionItem[] = [];

      if (Array.isArray(form.items)) {
        for (const item of form.items) {
          if (item.questionItem && item.questionItem.question) {
            const q = item.questionItem.question;
            const googleQuestionId = q.questionId || item.itemId || '';
            const title = item.title || 'Untitled Question';
            const required = Boolean(q.required);

            let googleQuestionType = 'TEXT';
            if (q.choiceQuestion)      googleQuestionType = q.choiceQuestion.type || 'CHOICE';
            else if (q.dateQuestion)   googleQuestionType = 'DATE';
            else if (q.timeQuestion)   googleQuestionType = 'TIME';
            else if (q.fileUploadQuestion) googleQuestionType = 'FILE_UPLOAD';
            else if (q.scaleQuestion)  googleQuestionType = 'SCALE';
            else if (q.textQuestion)   googleQuestionType = q.textQuestion.paragraph ? 'PARAGRAPH' : 'TEXT';

            questions.push({ googleQuestionId, googleQuestionType, title, required });
          }
        }
      }

      return {
        googleFormId: form.formId || formId,
        formTitle: form.info?.title || form.info?.documentTitle || 'Untitled Form',
        description: form.info?.description || undefined,
        questions,
      };
    } catch (err: any) {
      logger.error(`[GoogleFormsService] Error calling forms.get for formId ${formId}: ${err?.message || err}`);
      throw err;
    }
  }

  // ── forms.watches.create ───────────────────────────────────────────────────

  /**
   * Creates a Google Forms responses watch pointing to a GCP Pub/Sub topic.
   */
  async createWatch(formId: string, customPubsubTopic?: string): Promise<FormWatchResult> {
    const formsClient = this.getClient();
    if (!formsClient) {
      throw new Error('Google Forms service is not initialized — missing OAuth credentials');
    }

    const pubsubTopic = customPubsubTopic || env.GOOGLE_PUBSUB_TOPIC;

    try {
      const response = await formsClient.forms.watches.create({
        formId,
        requestBody: {
          watch: {
            target: { topic: { topicName: pubsubTopic } },
            eventType: 'RESPONSES',
          },
        },
      });

      const watchData = response.data;
      return {
        watchId: watchData.id || `watch_${Date.now()}`,
        expireTime: watchData.expireTime || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        pubsubTopic,
      };
    } catch (err: any) {
      logger.error(`[GoogleFormsService] Error creating watch for formId ${formId}: ${err?.message || err}`);
      throw err;
    }
  }

  // ── forms.watches.renew ───────────────────────────────────────────────────

  /**
   * Renews an existing Google Forms watch via forms.watches.renew.
   */
  async renewWatch(formId: string, watchId: string): Promise<FormWatchResult> {
    const formsClient = this.getClient();
    if (!formsClient) {
      throw new Error('Google Forms service is not initialized — missing OAuth credentials');
    }

    try {
      const response = await formsClient.forms.watches.renew({
        formId,
        watchId,
        requestBody: {},
      });

      const watchData = response.data;
      return {
        watchId: watchData.id || watchId,
        expireTime: watchData.expireTime || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        pubsubTopic: env.GOOGLE_PUBSUB_TOPIC,
      };
    } catch (err: any) {
      logger.error(`[GoogleFormsService] Error renewing watch ${watchId} for formId ${formId}: ${err?.message || err}`);
      throw err;
    }
  }

  // ── forms.responses.list ───────────────────────────────────────────────────

  /**
   * Lists form responses, optionally filtered to those submitted after
   * `afterTimestamp` (ISO 8601 string).
   *
   * Note: The Google Forms API filter syntax uses RFC3339 timestamps:
   *   filter = "timestamp > 2024-01-01T00:00:00Z"
   */
  async listResponses(formId: string, afterTimestamp?: string): Promise<FormResponse[]> {
    const formsClient = this.getClient();
    if (!formsClient) {
      throw new Error('Google Forms service is not initialized — missing OAuth credentials');
    }

    try {
      const params: forms_v1.Params$Resource$Forms$Responses$List = { formId };
      if (afterTimestamp) {
        params.filter = `timestamp > ${afterTimestamp}`;
      }

      const response = await formsClient.forms.responses.list(params);
      const rawResponses = response.data.responses || [];

      return rawResponses.map((r) => {
        const answers: FormResponseAnswer[] = [];

        if (r.answers) {
          for (const [questionId, answer] of Object.entries(r.answers)) {
            const textAnswers = answer.textAnswers?.answers || [];
            const textValues = textAnswers.map((a) => a.value || '').filter(Boolean);
            answers.push({
              questionId,
              textValue: textValues[0] ?? null,
              textValues,
            });
          }
        }

        return {
          responseId: r.responseId || `resp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          createTime: r.createTime || new Date().toISOString(),
          lastSubmittedTime: r.lastSubmittedTime || r.createTime || new Date().toISOString(),
          answers,
        };
      });
    } catch (err: any) {
      logger.error(`[GoogleFormsService] Error listing responses for formId ${formId}: ${err?.message || err}`);
      throw err;
    }
  }
}

export const googleFormsService = new GoogleFormsService();
