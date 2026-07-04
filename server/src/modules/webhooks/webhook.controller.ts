import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { googleDriveService } from '../../services/googleDrive';
import { projectService } from '../projects/project.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

// Schema for validating incoming Google Form submission payloads
const googleFormIntakeSchema = z.object({
  submissionId: z.string().min(1, 'Submission ID is required'),
  clientEmail: z.string().email('Invalid email address').toLowerCase().optional().or(z.literal('')),
  clientName: z.string().min(1, 'Client name is required'),
  companyName: z.string().optional().nullable(),
  videoTitle: z.string().min(2, 'Video title must be at least 2 characters'),
  rawFootageLink: z.string().url('Raw footage link must be a valid URL'),
  scriptLink: z.string().url('Script link must be a valid URL').optional().or(z.literal('')),
  deadline: z.string().optional().nullable(),
});

export class WebhookController {
  googleFormIntake = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    logger.info('[WebhookController] Received Google Forms intake request');

    // 1. Webhook Signature/Secret Verification
    const secret = req.query.secret || req.headers['x-mattwork-webhook-secret'];
    const expectedSecret = env.GOOGLE_FORMS_WEBHOOK_SECRET;

    if (!secret || secret !== expectedSecret) {
      logger.warn('[WebhookController] Unauthorized webhook access attempt');
      res.status(401).json({ error: 'Unauthorized: Invalid webhook secret' });
      return;
    }

    // 2. Validate Incoming Request Body
    const validationResult = googleFormIntakeSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errorDetails = validationResult.error.flatten().fieldErrors;
      logger.warn(`[WebhookController] Payload validation failed: ${JSON.stringify(errorDetails)}`);
      res.status(400).json({ error: 'Validation failed', details: errorDetails });
      return;
    }

    const {
      submissionId,
      clientEmail,
      clientName,
      companyName,
      videoTitle,
      rawFootageLink,
      scriptLink,
      deadline
    } = validationResult.data;

    // 3. Prevent Duplicate Submissions (Idempotency Check)
    const existingProject = await prisma.project.findFirst({
      where: {
        formLink: submissionId
      }
    });

    if (existingProject) {
      logger.warn(`[WebhookController] Duplicate submission detected for submissionId: ${submissionId}`);
      res.status(409).json({
        error: 'Duplicate submission: A project for this form submission already exists',
        projectId: existingProject.id
      });
      return;
    }

    // 4. Find or Create Client
    let client = null;

    // Try finding by email first
    if (clientEmail) {
      client = await prisma.client.findFirst({
        where: { user: { email: clientEmail } },
        include: { user: true }
      });
    }

    // Try finding by name/company if not found by email
    if (!client && clientName) {
      client = await prisma.client.findFirst({
        where: {
          OR: [
            { user: { name: { equals: clientName, mode: 'insensitive' } } },
            { company: { equals: clientName, mode: 'insensitive' } }
          ]
        },
        include: { user: true }
      });
    }

    // Create client if not found
    let newlyCreated = false;
    if (!client) {
      if (!clientEmail) {
        logger.warn(`[WebhookController] Client lookup failed and no email was supplied to create a new profile for: ${clientName}`);
        res.status(400).json({ error: 'Client profile not found. An email address must be supplied to create a new client account.' });
        return;
      }

      logger.info(`[WebhookController] Client not found. Creating new user and client profile for: ${clientEmail}`);
      const randomPassword = Math.random().toString(36).substring(2, 12);
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      const user = await prisma.user.create({
        data: {
          name: clientName,
          email: clientEmail,
          password: passwordHash,
          role: Role.CLIENT,
        }
      });

      client = await prisma.client.create({
        data: {
          userId: user.id,
          company: companyName || clientName || 'New Client LLC',
        },
        include: { user: true }
      });
      newlyCreated = true;
    }

    const submissionDate = new Date();
    const parsedDeadline = deadline ? new Date(deadline) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days from now

    // 5. Google Drive Folder Setup (real API or graceful simulation)
    const driveResult = await googleDriveService.setupProjectFolder({
      clientName: client.user.name || client.company || 'Client',
      videoTitle,
      rawFootageLink,
      scriptLink: scriptLink || '',
      submissionDate,
    });

    logger.info(
      `[WebhookController] Drive folder ${driveResult.isSimulated ? '[SIMULATED]' : '[REAL]'}: ${driveResult.projectFolderUrl}`
    );

    // 6. Create Project in NEW_VIDEO status
    const project = await projectService.createProject({
      title: videoTitle,
      description: `Automated intake from Google Form.\nRaw Footage Link: ${rawFootageLink}\nScript Link: ${scriptLink || 'N/A'}`,
      clientId: client.id,
      priority: 'MEDIUM',
      dueDate: parsedDeadline,
      driveFolder: driveResult.projectFolderUrl,
      formLink: submissionId, // stores submissionId for idempotency
      tags: ['Google Form'],
    });

    logger.info(`[WebhookController] Project successfully created via Google Forms Webhook: ${project.id}`);

    ApiResponse.created(res, {
      project,
      credentialsCreated: newlyCreated,
      driveFolder: {
        url:            driveResult.projectFolderUrl,
        folderId:       driveResult.projectFolderId,
        assetsFolderId: driveResult.assetsFolderId,
        isSimulated:    driveResult.isSimulated,
      },
    }, 'Project card created and Drive files organized successfully');
  });
}

export const webhookController = new WebhookController();

