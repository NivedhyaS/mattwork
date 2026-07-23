/**
 * formIntake.service.ts
 *
 * Shared "new project from form response" pipeline.
 *
 * Used by:
 *  - The legacy Google Apps Script webhook   (POST /api/v1/webhooks/google-form)
 *  - The new Google Forms Pub/Sub processor  (POST /api/v1/webhooks/forms-pubsub)
 *
 * Both callers supply a normalised DTO; this service handles:
 *  1. Client lookup (by name / company)
 *  2. Duplicate-project idempotency guard (via formLink)
 *  3. Google Drive folder setup
 *  4. Project creation
 *  5. Google Sheets sync (fire-and-forget, already inside projectService)
 *  6. Admin notifications
 */

import { prisma } from '../config/database';
import { googleDriveService } from './googleDrive';
import { projectService } from '../modules/projects/project.service';
import { notificationService } from '../modules/notifications/notification.service';
import { logger } from '../config/logger';
import { Role } from '@prisma/client';

export interface FormIntakeDTO {
  /** Unique ID used to guard against duplicate project creation */
  idempotencyKey: string;
  clientName: string;
  videoTitle: string;
  /** Optional URL to source drive folder; falls back to a placeholder if absent */
  driveFolderLink?: string;
  deadline?: Date | null;
  submissionDate?: Date;
  projectType?: string;
  rawMaterialsLink?: string;
  tags?: string[];
}

export interface FormIntakeResult {
  projectId: string;
  driveFolder: string;
  isSimulated: boolean;
  duplicate: boolean;
}

export class FormIntakeService {
  /**
   * Creates a Mattwork project from a normalised form submission DTO.
   *
   * Returns early (with `duplicate: true`) if a project already exists for
   * `idempotencyKey` (stored in `Project.formLink`).
   */
  async createProjectFromFormResponse(dto: FormIntakeDTO): Promise<FormIntakeResult> {
    const {
      idempotencyKey,
      clientName,
      videoTitle,
      driveFolderLink,
      deadline,
      submissionDate,
      projectType,
      rawMaterialsLink,
      tags = [],
    } = dto;

    // ── 1. Duplicate guard ─────────────────────────────────────────────────────

    const existing = await prisma.project.findFirst({
      where: { formLink: idempotencyKey },
      select: { id: true, driveFolder: true },
    });

    if (existing) {
      logger.info(
        `[FormIntakeService] Duplicate detected — project already exists for idempotencyKey=${idempotencyKey} projectId=${existing.id}`
      );
      return {
        projectId: existing.id,
        driveFolder: existing.driveFolder || '',
        isSimulated: false,
        duplicate: true,
      };
    }

    // ── 2. Client lookup ───────────────────────────────────────────────────────

    const client = await prisma.client.findFirst({
      where: {
        OR: [
          { user: { name: { equals: clientName, mode: 'insensitive' } } },
          { company: { equals: clientName, mode: 'insensitive' } },
        ],
      },
      include: { user: true },
    });

    if (!client) {
      throw new Error(
        `Client not found for name "${clientName}". Create the client in the Admin panel first.`
      );
    }

    const resolvedDate = submissionDate ?? new Date();
    const resolvedDeadline = deadline ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const effectiveDriveLink = driveFolderLink || 'https://drive.google.com';

    // ── 3. Google Drive folder setup ───────────────────────────────────────────

    const driveResult = await googleDriveService.setupProjectFolder({
      clientName: client.user.name || client.company || 'Client',
      videoTitle,
      driveFolderLink: effectiveDriveLink,
      submissionDate: resolvedDate,
    });

    logger.info(
      `[FormIntakeService] Drive folder ${driveResult.isSimulated ? '[SIMULATED]' : '[REAL]'}: ${driveResult.projectFolderUrl}`
    );

    // ── 4. Project creation ────────────────────────────────────────────────────

    const projectTags = ['Google Form', ...tags];
    if (projectType) projectTags.push(projectType);

    const project = await projectService.createProject({
      title: videoTitle,
      description: `Automated intake from Google Form submission.`,
      clientId: client.id,
      dueDate: resolvedDeadline,
      submissionDate: resolvedDate,
      driveFolder: driveResult.projectFolderUrl,
      formLink: idempotencyKey,
      rawMaterialsFolder: rawMaterialsLink || null,
      tags: projectTags,
    });

    logger.info(`[FormIntakeService] Project created: ${project.id} title="${videoTitle}" client="${clientName}"`);

    // ── 5. Admin notifications (fire-and-forget) ───────────────────────────────

    const admins = await prisma.user.findMany({
      where: { role: Role.ADMIN, isActive: true },
      select: { id: true },
    });

    for (const admin of admins) {
      notificationService
        .notifyUser(
          admin.id,
          'New Project Created via Google Form',
          `A new project "${videoTitle}" was created automatically for client "${clientName}".`,
          'GENERAL',
          project.id
        )
        .catch((err: any) => {
          logger.error(`[FormIntakeService] Admin notification failed: ${err?.message}`);
        });
    }

    return {
      projectId: project.id,
      driveFolder: driveResult.projectFolderUrl,
      isSimulated: driveResult.isSimulated,
      duplicate: false,
    };
  }
}

export const formIntakeService = new FormIntakeService();
