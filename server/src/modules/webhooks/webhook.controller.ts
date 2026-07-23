import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { z } from 'zod';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { formIntakeService } from '../../services/formIntake.service';
import { formsService } from '../forms/forms.service';
import { verifyPubSubJwt, extractBearerToken } from '../../utils/pubsubAuth';

// ─── Legacy Apps Script intake schema ─────────────────────────────────────────

const googleFormIntakeSchema = z.object({
  submissionId: z.string().min(1, 'Submission ID is required'),
  clientName: z.string().min(1, 'Client name is required'),
  videoTitle: z.string().min(2, 'Video title must be at least 2 characters'),
  driveFolderLink: z.string().url('Drive folder link must be a valid URL'),
  deadline: z.string().optional().nullable(),
});

// ─── Pub/Sub push envelope schema ─────────────────────────────────────────────

const pubSubMessageSchema = z.object({
  message: z.object({
    data: z.string(),        // base64-encoded JSON payload
    messageId: z.string().optional(),
    publishTime: z.string().optional(),
  }),
  subscription: z.string(),
});

// ─── Controller ───────────────────────────────────────────────────────────────

export class WebhookController {
  // ── Legacy Apps Script intake ──────────────────────────────────────────────

  googleFormIntake = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    logger.info('[WebhookController] Received legacy Google Forms intake request');

    // Secret verification
    const secret = req.query.secret || req.headers['x-mattwork-webhook-secret'];
    if (!secret || secret !== env.GOOGLE_FORMS_WEBHOOK_SECRET) {
      logger.warn('[WebhookController] Unauthorized webhook access attempt');
      res.status(401).json({ error: 'Unauthorized: Invalid webhook secret' });
      return;
    }

    // Payload validation
    const validationResult = googleFormIntakeSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.flatten().fieldErrors;
      logger.warn(`[WebhookController] Payload validation failed: ${JSON.stringify(errors)}`);
      res.status(400).json({ error: 'Validation failed', details: errors });
      return;
    }

    const { submissionId, clientName, videoTitle, driveFolderLink, deadline } = validationResult.data;

    try {
      const result = await formIntakeService.createProjectFromFormResponse({
        idempotencyKey: submissionId,
        clientName,
        videoTitle,
        driveFolderLink,
        deadline: deadline ? new Date(deadline) : null,
      });

      if (result.duplicate) {
        res.status(409).json({
          error: 'Duplicate submission: A project for this form submission already exists',
          projectId: result.projectId,
        });
        return;
      }

      ApiResponse.created(res, {
        projectId: result.projectId,
        driveFolder: {
          url: result.driveFolder,
          isSimulated: result.isSimulated,
        },
      }, 'Project card created and Drive files organized successfully');
    } catch (err: any) {
      logger.error(`[WebhookController] Legacy intake error: ${err?.message}`);
      res.status(400).json({ error: err?.message || 'Internal error processing form intake' });
    }
  });

  // ── Google Pub/Sub Push Endpoint ───────────────────────────────────────────

  formsPubSub = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    logger.info('[WebhookController] Received Pub/Sub push notification');

    // ── OIDC JWT Authentication ──────────────────────────────────────────────

    const bearerToken = extractBearerToken(req.headers.authorization);
    if (!bearerToken) {
      logger.warn('[WebhookController] Pub/Sub: Missing Authorization header');
      res.status(401).json({ error: 'Unauthorized: Missing bearer token' });
      return;
    }

    // Build the expected audience: the full URL of THIS push endpoint
    const expectedAudience =
      env.PUBSUB_PUSH_ENDPOINT_URL ||
      `${req.protocol}://${req.get('host')}/api/v1/webhooks/forms-pubsub`;

    try {
      await verifyPubSubJwt(bearerToken, expectedAudience);
    } catch (err: any) {
      logger.warn(`[WebhookController] Pub/Sub JWT rejected: ${err?.message}`);
      res.status(401).json({ error: 'Unauthorized: Invalid or expired OIDC token' });
      return;
    }

    logger.info('[WebhookController] Pub/Sub: JWT verified — proceeding with message processing');

    // ── Decode Pub/Sub envelope ───────────────────────────────────────────────

    const envelopeParse = pubSubMessageSchema.safeParse(req.body);
    if (!envelopeParse.success) {
      logger.warn(`[WebhookController] Pub/Sub: Invalid envelope: ${JSON.stringify(envelopeParse.error.flatten())}`);
      // Return 200 so Pub/Sub doesn't retry a malformed message
      res.status(200).json({ ok: true, note: 'Invalid envelope format — discarded' });
      return;
    }

    const { message, subscription } = envelopeParse.data;
    logger.info(`[WebhookController] Pub/Sub: subscription=${subscription} messageId=${message.messageId}`);

    // Decode base64 → JSON payload
    let payload: Record<string, unknown>;
    try {
      const decoded = Buffer.from(message.data, 'base64').toString('utf-8');
      payload = JSON.parse(decoded);
    } catch (err: any) {
      logger.warn(`[WebhookController] Pub/Sub: Failed to decode message data: ${err?.message}`);
      res.status(200).json({ ok: true, note: 'Malformed message data — discarded' });
      return;
    }

    // Extract form ID from the notification payload
    const googleFormId = (payload.formId as string) || (payload.form_id as string);
    if (!googleFormId) {
      logger.warn('[WebhookController] Pub/Sub: No formId in notification payload — discarding');
      res.status(200).json({ ok: true, note: 'No formId in payload — discarded' });
      return;
    }

    // Delegate to shared form response processing engine in formsService
    try {
      const summary = await formsService.processFormResponses(googleFormId);
      res.status(200).json({
        ok: true,
        ...summary,
      });
    } catch (err: any) {
      logger.error(`[WebhookController] Pub/Sub: Response processing error for ${googleFormId}: ${err?.message || err}`);
      res.status(200).json({ ok: true, error: err?.message || 'Processing failed' });
    }
  });
}

export const webhookController = new WebhookController();
