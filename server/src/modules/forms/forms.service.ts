import { MattworkFormField, FormSyncStatus } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../config/logger';
import { prisma } from '../../config/database';
import { googleFormsService, extractGoogleFormId } from '../../services/googleForms';
import { formIntakeService } from '../../services/formIntake.service';
import { formsRepository } from './forms.repository';
import { ConnectFormInput, SaveFormMappingInput } from './forms.types';

export interface MappedFormFields {
  clientName?: string;
  videoTitle?: string;
  projectType?: string;
  assignedDate?: Date;
  deadlineDate?: Date;
  materialsLink?: string;
}

export function applyMappings(
  answers: Array<{ questionId: string; textValue: string | null }>,
  mappings: Array<{ googleQuestionId: string; mattworkField: MattworkFormField }>
): MappedFormFields {
  const answerMap = new Map(answers.map((a) => [a.questionId, a.textValue]));
  const result: MappedFormFields = {};

  for (const mapping of mappings) {
    const rawValue = answerMap.get(mapping.googleQuestionId);
    if (!rawValue) continue;

    switch (mapping.mattworkField) {
      case 'CLIENT_NAME':
        result.clientName = rawValue;
        break;
      case 'VIDEO_TITLE':
        result.videoTitle = rawValue;
        break;
      case 'PROJECT_TYPE':
        result.projectType = rawValue;
        break;
      case 'ASSIGNED_DATE':
        result.assignedDate = new Date(rawValue);
        break;
      case 'DEADLINE_DATE':
        result.deadlineDate = new Date(rawValue);
        break;
      case 'MATERIALS_LINK':
        result.materialsLink = rawValue;
        break;
    }
  }

  return result;
}

export interface SyncSummaryResult {
  processed: number;
  created: number;
  duplicates: number;
  failed: number;
  lastProcessedTimestamp: string | null;
  durationMs: number;
}

export class FormsService {
  /**
   * Connect/Preview step: Extracts Form ID from URL and fetches form structure from Google Forms API.
   * Does NOT save anything to database yet.
   */
  async connectForm(input: ConnectFormInput) {
    const formId = extractGoogleFormId(input.formUrl);
    if (!formId) {
      throw ApiError.badRequest(
        'Invalid Google Form URL or ID format. Please provide a valid Google Form edit/view URL or Form ID.'
      );
    }

    try {
      const formDetails = await googleFormsService.getForm(formId);
      return formDetails;
    } catch (err: any) {
      logger.error(`[FormsService] Failed to get form details for formId ${formId}: ${err?.message || err}`);
      throw ApiError.badRequest(`Failed to access Google Form: ${err?.message || 'Google Forms API error'}`);
    }
  }

  /**
   * Mapping & Watch step: Validates mappings, validates type compatibility, saves ConnectedForm + FormFieldMappings,
   * creates Google Forms watch, and saves FormWatch.
   */
  async saveFormMapping(adminId: string, input: SaveFormMappingInput) {
    // 1. Validate required mappings
    const mappedFields = new Set(input.mappings.map((m) => m.mattworkField));
    if (!mappedFields.has(MattworkFormField.VIDEO_TITLE)) {
      throw ApiError.badRequest('Required field VIDEO_TITLE must be mapped.');
    }
    if (!mappedFields.has(MattworkFormField.CLIENT_NAME)) {
      throw ApiError.badRequest('Required field CLIENT_NAME must be mapped.');
    }

    // 2. Validate compatible question types for date fields
    for (const mapping of input.mappings) {
      if (
        mapping.mattworkField === MattworkFormField.ASSIGNED_DATE ||
        mapping.mattworkField === MattworkFormField.DEADLINE_DATE
      ) {
        const questionType = (mapping.googleQuestionType || '').toUpperCase();
        if (questionType !== 'DATE') {
          throw ApiError.badRequest(
            `Field ${mapping.mattworkField} must map to a DATE-type question, but received '${mapping.googleQuestionType}'.`
          );
        }
      }
    }

    // 3. Create Google Forms watch
    let watchResult;
    try {
      watchResult = await googleFormsService.createWatch(input.googleFormId, input.pubsubTopic);
    } catch (err: any) {
      logger.error(
        `[FormsService] Watch creation failed for googleFormId ${input.googleFormId}: ${err?.message || err}`
      );
    }

    // 4. Save ConnectedForm, Mappings, and FormWatch in database transaction
    const connectedForm = await formsRepository.saveConnectedFormWithMappingAndWatch(
      input,
      adminId,
      watchResult
    );

    return connectedForm;
  }

  /**
   * List all connected forms for admin visibility.
   */
  async listForms() {
    return formsRepository.listForms();
  }

  /**
   * Renews Google Forms watch for a connected form. Used by Admin API endpoint and automated scheduler.
   */
  async renewWatch(connectedFormId: string) {
    const form = await formsRepository.findById(connectedFormId);
    if (!form) {
      throw ApiError.notFound('Connected form not found');
    }

    const latestWatch = form.watches[0];
    const oldExpiry = latestWatch?.expireTime ? new Date(latestWatch.expireTime).toISOString() : 'N/A';
    const watchId = latestWatch?.watchId;

    logger.info(
      `[FormsService] Starting watch renewal | connectedFormId=${connectedFormId} googleFormId=${form.googleFormId} watchId=${watchId || 'NONE'} oldExpiry=${oldExpiry}`
    );

    let watchResult;
    try {
      if (watchId) {
        try {
          watchResult = await googleFormsService.renewWatch(form.googleFormId, watchId);
        } catch (renewErr: any) {
          logger.warn(
            `[FormsService] Direct watch renewal failed for watchId=${watchId}, attempting fresh watch creation. Error: ${renewErr?.message}`
          );
          watchResult = await googleFormsService.createWatch(form.googleFormId);
        }
      } else {
        watchResult = await googleFormsService.createWatch(form.googleFormId);
      }

      const updatedForm = await formsRepository.updateWatchAndStatus(
        form.id,
        watchResult,
        FormSyncStatus.ACTIVE
      );

      logger.info(
        `[FormsService] Watch renewed successfully | connectedFormId=${connectedFormId} googleFormId=${form.googleFormId} watchId=${watchResult.watchId} oldExpiry=${oldExpiry} newExpiry=${watchResult.expireTime}`
      );

      return {
        success: true,
        connectedFormId: form.id,
        googleFormId: form.googleFormId,
        watchId: watchResult.watchId,
        expireTime: watchResult.expireTime,
        status: FormSyncStatus.ACTIVE,
        updatedForm,
      };
    } catch (err: any) {
      logger.error(
        `[FormsService] Watch renewal failed | connectedFormId=${connectedFormId} googleFormId=${form.googleFormId} watchId=${watchId || 'NONE'} oldExpiry=${oldExpiry}: ${err?.message || err}`
      );

      await formsRepository.updateStatus(form.id, FormSyncStatus.WATCH_EXPIRED);

      return {
        success: false,
        connectedFormId: form.id,
        googleFormId: form.googleFormId,
        watchId: watchId || null,
        error: err?.message || 'Failed to renew watch',
        status: FormSyncStatus.WATCH_EXPIRED,
      };
    }
  }

  /**
   * Shared form response processing engine used by both Manual Sync and Pub/Sub Webhook.
   * Loads form mappings, fetches new Google Form responses, deduplicates, maps fields,
   * creates projects via formIntakeService, records ProcessedFormResponse, and updates ConnectedForm.
   */
  async processFormResponses(connectedFormIdOrGoogleFormId: string): Promise<SyncSummaryResult> {
    const startTime = Date.now();

    let connectedForm = await formsRepository.findById(connectedFormIdOrGoogleFormId);
    if (!connectedForm) {
      connectedForm = await formsRepository.findByGoogleFormId(connectedFormIdOrGoogleFormId);
    }
    if (!connectedForm) {
      throw ApiError.notFound('Connected form not found');
    }

    logger.info(
      `[FormsService] Starting response sync for form "${connectedForm.formTitle}" | connectedFormId=${connectedForm.id} googleFormId=${connectedForm.googleFormId}`
    );

    const sinceTimestamp =
      connectedForm.lastProcessedResponseTimestamp?.toISOString() ||
      connectedForm.lastSyncedAt?.toISOString();

    let responses: Awaited<ReturnType<typeof googleFormsService.listResponses>>;
    try {
      responses = await googleFormsService.listResponses(
        connectedForm.googleFormId,
        sinceTimestamp ?? undefined
      );
    } catch (err: any) {
      logger.error(
        `[FormsService] Failed to fetch responses from Google Forms API for formId ${connectedForm.googleFormId}: ${err?.message || err}`
      );
      throw ApiError.badRequest(`Failed to fetch responses from Google Forms API: ${err?.message || err}`);
    }

    logger.info(
      `[FormsService] Fetched ${responses.length} response(s) from Google Forms API after ${sinceTimestamp ?? 'epoch'}`
    );

    // Batch deduplication check — single database query for all fetched response IDs
    const responseIds = responses.map((r) => r.responseId);
    const existingProcessedRecords =
      responseIds.length > 0
        ? await prisma.processedFormResponse.findMany({
            where: {
              connectedFormId: connectedForm.id,
              googleResponseId: { in: responseIds },
            },
            select: { googleResponseId: true },
          })
        : [];
    const processedSet = new Set(existingProcessedRecords.map((r) => r.googleResponseId));

    let processed = 0;
    let created = 0;
    let duplicates = 0;
    let failed = 0;
    let latestTimestamp: Date | null = null;

    for (const response of responses) {
      processed++;
      try {
        // 1. Deduplication check via batch in-memory Set
        if (processedSet.has(response.responseId)) {
          logger.info(`[FormsService] Duplicate responseId=${response.responseId} — skipping (batch checked)`);
          duplicates++;
          continue;
        }

        // 2. Apply field mappings
        const fields = applyMappings(response.answers, connectedForm.mappings);

        if (!fields.videoTitle) {
          logger.warn(
            `[FormsService] responseId=${response.responseId} missing mapped VIDEO_TITLE — skipping`
          );
          failed++;
          continue;
        }

        if (!fields.clientName) {
          logger.warn(
            `[FormsService] responseId=${response.responseId} missing mapped CLIENT_NAME — skipping`
          );
          failed++;
          continue;
        }

        // 3. Create project via shared formIntakeService
        const intakeResult = await formIntakeService.createProjectFromFormResponse({
          idempotencyKey: response.responseId,
          clientName: fields.clientName,
          videoTitle: fields.videoTitle,
          driveFolderLink: fields.materialsLink,
          deadline: fields.deadlineDate ?? null,
          submissionDate: fields.assignedDate ?? new Date(response.createTime),
          projectType: fields.projectType,
          rawMaterialsLink: fields.materialsLink,
          tags: [connectedForm.formTitle],
        });

        if (intakeResult.duplicate) {
          logger.info(
            `[FormsService] responseId=${response.responseId} maps to existing project ${intakeResult.projectId}`
          );
          duplicates++;
        } else {
          logger.info(
            `[FormsService] Project created successfully | projectId=${intakeResult.projectId} for responseId=${response.responseId}`
          );
          created++;
        }

        // 4. Record ProcessedFormResponse
        await prisma.processedFormResponse.upsert({
          where: {
            connectedFormId_googleResponseId: {
              connectedFormId: connectedForm.id,
              googleResponseId: response.responseId,
            },
          },
          create: {
            connectedFormId: connectedForm.id,
            googleResponseId: response.responseId,
            processedAt: new Date(),
            projectId: intakeResult.projectId,
          },
          update: {
            processedAt: new Date(),
            projectId: intakeResult.projectId,
          },
        });

        const responseTime = new Date(response.lastSubmittedTime || response.createTime);
        if (!latestTimestamp || responseTime > latestTimestamp) {
          latestTimestamp = responseTime;
        }
      } catch (err: any) {
        logger.error(
          `[FormsService] Error processing responseId=${response.responseId}: ${err?.message || err}`
        );
        failed++;
      }
    }

    // 5. Update ConnectedForm sync metadata
    const now = new Date();
    await prisma.connectedForm.update({
      where: { id: connectedForm.id },
      data: {
        lastSyncedAt: now,
        syncStatus: FormSyncStatus.ACTIVE,
        ...(latestTimestamp && { lastProcessedResponseTimestamp: latestTimestamp }),
      },
    });

    const durationMs = Date.now() - startTime;

    logger.info(
      `[FormsService] Sync completed for form "${connectedForm.formTitle}" | duration=${durationMs}ms processed=${processed} created=${created} duplicates=${duplicates} failed=${failed}`
    );

    return {
      processed,
      created,
      duplicates,
      failed,
      lastProcessedTimestamp:
        latestTimestamp?.toISOString() ||
        connectedForm.lastProcessedResponseTimestamp?.toISOString() ||
        null,
      durationMs,
    };
  }
}

export const formsService = new FormsService();
