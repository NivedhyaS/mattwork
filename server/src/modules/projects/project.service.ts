import { Role } from '@prisma/client';
import { projectRepository } from './project.repository';
import { serializeProject, serializeProjects, RawProject } from './project.serializer';
import { ApiError } from '../../utils/ApiError';
import prisma from '../../config/database';
import { AuthUser } from '../../../src/types/express';
import {
  CreateProjectInput,
  UpdateProjectInput,
  UpdateProjectStatusInput,
  ListProjectsQuery,
  ReassignEditorInput,
} from './project.validator';
import { googleSheetsService, ProjectSheetSnapshot } from '../../services/googleSheets';
import { googleDriveService } from '../../services/googleDrive';
import { notificationService } from '../notifications/notification.service';
import { logger } from '../../config/logger';

export class ProjectService {
  // ── Sheets sync helper (fire-and-forget) ─────────────────────────────────

  private syncToSheets(raw: RawProject): void {
    const snapshot: ProjectSheetSnapshot = {
      id:          raw.id,
      formLink:    raw.formLink,
      clientName:  raw.client?.user?.name || raw.client?.company || 'Unknown',
      title:       raw.title,
      createdAt:   raw.createdAt,
      dueDate:     raw.dueDate,
      status:      raw.status,
      editorName:  raw.editor?.user?.name || null,
      driveFolder: raw.driveFolder,
      clientPrice: raw.clientPrice != null ? Number(raw.clientPrice) : null,
      editorPrice: raw.editorPrice != null ? Number(raw.editorPrice) : null,
    };

    // Fire-and-forget — never block the response
    googleSheetsService.syncProject(snapshot).catch((err) => {
      logger.error(`[ProjectService] Sheets sync failed for ${raw.id}: ${err?.message}`);
    });
  }

  // ── Editor Assignment Side-Effects (Drive + Notifications) ────────────────

  private handleEditorAssignmentEffects(
    projectId: string,
    previousEditor: any,
    newEditor: any,
    driveFolder: string | null,
    projectTitle: string
  ): void {
    const previousEditorId = previousEditor?.id || null;
    const newEditorId = newEditor?.id || null;

    if (previousEditorId === newEditorId) return;

    let driveFolderId: string | null = null;
    if (driveFolder) {
      const folderIdMatch = driveFolder.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      driveFolderId = folderIdMatch ? folderIdMatch[1] : driveFolder;
    }

    // 1. Revoke access from previous editor
    if (previousEditor?.user?.email && driveFolderId) {
      const email = previousEditor.user.email;
      googleDriveService.unshareFolder(driveFolderId, email).catch(async (err) => {
        logger.error(`[ProjectService] Drive revocation failed for project ${projectId} from editor ${email}: ${err.message}`);
        // Notify all admins about the revocation failure (security risk)
        try {
          const admins = await prisma.user.findMany({
            where: { role: Role.ADMIN },
            select: { id: true }
          });
          for (const admin of admins) {
            await notificationService.notifyUser(
              admin.id,
              'ACTION REQUIRED: Drive Revocation Failed',
              `Failed to automatically revoke Google Drive access for project "${projectTitle}" from editor ${email}. Please check and remove permissions manually. Error: ${err.message}`,
              'GENERAL',
              projectId
            );
          }
        } catch (adminNotifyErr: any) {
          logger.error(`[ProjectService] Failed to notify admins about Drive revocation failure: ${adminNotifyErr.message}`);
        }
      });
    }

    // 2. Grant access to new editor
    if (newEditor?.user?.email && driveFolderId) {
      googleDriveService.shareFolder(driveFolderId, newEditor.user.email).catch((err) => {
        logger.error(`[ProjectService] Failed to share Drive folder for project ${projectId} with editor ${newEditor.user.email}: ${err.message}`);
      });
    }

    // 3. Notify previous editor of unassignment
    if (previousEditor?.user?.id) {
      notificationService.notifyUser(
        previousEditor.user.id,
        'Project Unassigned',
        `You have been unassigned from the project: "${projectTitle}"`,
        'PROJECT_UNASSIGNED',
        projectId
      ).catch((err) => {
        logger.error(`[ProjectService] Editor unassignment notification failed for user ${previousEditor.user.id}: ${err.message}`);
      });
    }

    // 4. Notify new editor of assignment
    if (newEditor?.user?.id) {
      notificationService.notifyUser(
        newEditor.user.id,
        'Project Assigned',
        `You have been assigned to the project: "${projectTitle}"`,
        'PROJECT_ASSIGNED',
        projectId
      ).catch((err) => {
        logger.error(`[ProjectService] Editor assignment notification failed for user ${newEditor.user.id}: ${err.message}`);
      });
    }
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async listProjects(query: ListProjectsQuery, requester: AuthUser) {
    if (requester.role !== Role.ADMIN) {
      if (query.minValue !== undefined || query.maxValue !== undefined) {
        throw ApiError.forbidden('Only administrators can filter by budget range');
      }
    }

    const repositoryParams: any = { 
      ...query,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 10,
      ...(query.minValue !== undefined && { minValue: Number(query.minValue) }),
      ...(query.maxValue !== undefined && { maxValue: Number(query.maxValue) }),
      ...(query.deadlineBefore !== undefined && { deadlineBefore: new Date(query.deadlineBefore) }),
      ...(query.deadlineAfter !== undefined && { deadlineAfter: new Date(query.deadlineAfter) }),
    };

    if (requester.role === Role.CLIENT) {
      const client = await prisma.client.findUnique({
        where: { userId: requester.id },
        select: { id: true },
      });
      if (!client) throw ApiError.notFound('Client profile not found');
      repositoryParams.clientId = client.id;
    } else if (requester.role === Role.EDITOR) {
      const editor = await prisma.editor.findUnique({
        where: { userId: requester.id },
        select: { id: true },
      });
      if (!editor) throw ApiError.notFound('Editor profile not found');
      repositoryParams.editorId = editor.id;
    }

    const result = await projectRepository.findAll(repositoryParams);

    // Apply role-scoped serialization to every item in the list
    return {
      data: serializeProjects(result.data, requester),
      meta: result.meta,
    };
  }

  // ── Detail ────────────────────────────────────────────────────────────────

  async getProjectById(id: string, requester: AuthUser) {
    const project = await projectRepository.findById(id) as RawProject | null;
    if (!project) throw ApiError.notFound('Project not found');

    // Access control — done before serialization so error messages are consistent
    if (requester.role === Role.CLIENT && project.client.user.id !== requester.id) {
      throw ApiError.forbidden('Access denied');
    }
    if (
      requester.role === Role.EDITOR &&
      project.editor?.user?.id !== requester.id
    ) {
      throw ApiError.forbidden('Access denied');
    }

    // Strip forbidden fields per role — happens in the service, not the controller
    return serializeProject(project, requester);
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async createProject(input: CreateProjectInput) {
    const client = await prisma.client.findUnique({ where: { id: input.clientId } });
    if (!client) throw ApiError.notFound('Client not found');

    if (input.editorId) {
      const editor = await prisma.editor.findUnique({ where: { id: input.editorId } });
      if (!editor) throw ApiError.notFound('Editor not found');
    }

    // createProject is admin-only (enforced in router); always return admin view
    const project = await projectRepository.create({
      title: input.title,
      description: input.description,
      dueDate: input.dueDate,
      submissionDate: input.submissionDate,
      budget: input.budget,
      clientPrice: input.clientPrice,
      editorPrice: input.editorPrice,
      tags: input.tags,
      notes: input.notes,
      driveFolder: input.driveFolder,
      formLink: input.formLink,
      rawMaterialsFolder: input.rawMaterialsFolder,
      client: { connect: { id: input.clientId } },
      ...(input.editorId && { editor: { connect: { id: input.editorId } } }),
    }) as RawProject;

    this.syncToSheets(project);

    return serializeProject(project, { id: '', email: '', name: '', role: Role.ADMIN });
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async updateProject(id: string, input: UpdateProjectInput, requester: AuthUser) {
    const project = await projectRepository.findById(id);
    if (!project) throw ApiError.notFound('Project not found');

    // Access control for Editors
    if (requester.role === Role.EDITOR) {
      if (project.editor?.user?.id !== requester.id) {
        throw ApiError.forbidden('Access denied');
      }
      if (input.editorId !== undefined) {
        throw ApiError.forbidden('Only administrators can assign or reassign editors');
      }
      if (input.clientId !== undefined) {
        throw ApiError.forbidden('Only administrators can reassign clients');
      }
    }

    // Validate new clientId if provided (admin only)
    if (input.clientId !== undefined) {
      const client = await prisma.client.findUnique({ where: { id: input.clientId } });
      if (!client) throw ApiError.notFound('Client not found');
    }

    if (input.editorId !== undefined && input.editorId) {
      const editor = await prisma.editor.findUnique({ where: { id: input.editorId } });
      if (!editor) throw ApiError.notFound('Editor not found');
    }

    const { editorId, clientId, ...updateData } = input;

    const updated = await projectRepository.update(id, {
      ...updateData,
      ...(editorId !== undefined && {
        editor: editorId ? { connect: { id: editorId } } : { disconnect: true },
      }),
      ...(clientId !== undefined && {
        client: { connect: { id: clientId } },
      }),
    }) as RawProject;

    // Trigger assignment side-effects if editorId was provided (modified)
    if (editorId !== undefined) {
      this.handleEditorAssignmentEffects(
        updated.id,
        project.editor,
        updated.editor,
        updated.driveFolder,
        updated.title
      );
    }

    this.syncToSheets(updated);

    // Return serialized project using the requester's actual role to avoid leaking restricted fields
    return serializeProject(updated, requester);
  }

  // ── Status ────────────────────────────────────────────────────────────────

  async updateProjectStatus(id: string, input: UpdateProjectStatusInput, requester: AuthUser) {
    const project = await projectRepository.findById(id);
    if (!project) throw ApiError.notFound('Project not found');

    if (requester.role === Role.EDITOR && project.editor?.user?.id !== requester.id) {
      throw ApiError.forbidden('Editors can only update their own assigned projects');
    }

    const updated = await projectRepository.update(id, { status: input.status }) as RawProject;

    // Automate: Notify client of status change
    if (updated.client?.user?.id) {
      notificationService.notifyUser(
        updated.client.user.id,
        'Project Status Updated',
        `The status of your project "${updated.title}" has been updated to "${updated.status}"`,
        'PROJECT_STATUS_CHANGED',
        updated.id
      ).catch((err) => {
        logger.error(`[ProjectService] Client status update notification failed: ${err.message}`);
      });
    }

    // Automate: Notify editor of status change
    if (updated.editor?.user?.id) {
      notificationService.notifyUser(
        updated.editor.user.id,
        'Project Status Updated',
        `The status of project "${updated.title}" has been updated to "${updated.status}"`,
        'PROJECT_STATUS_CHANGED',
        updated.id
      ).catch((err) => {
        logger.error(`[ProjectService] Editor status update notification failed: ${err.message}`);
      });
    }

    this.syncToSheets(updated);

    return serializeProject(updated, { id: '', email: '', name: '', role: Role.ADMIN });
  }

  // ── Reassign Editor (Admin-only, with audit log) ──────────────────────────

  async reassignEditor(id: string, input: ReassignEditorInput, requester: AuthUser) {
    const project = await projectRepository.findById(id) as RawProject | null;
    if (!project) throw ApiError.notFound('Project not found');

    const previousEditorId = project.editorId ?? null;
    const newEditorId = input.editorId ?? null;

    // Validate the new editor exists (unless unassigning)
    if (newEditorId) {
      const editor = await prisma.editor.findUnique({ where: { id: newEditorId } });
      if (!editor) throw ApiError.notFound('Editor not found');
    }

    // Write audit log (fire-and-forget safe — use await so errors surface)
    await prisma.editorAssignmentLog.create({
      data: {
        projectId: id,
        previousEditorId,
        newEditorId,
        changedById: requester.id,
      },
    });

    const updated = await projectRepository.update(id, {
      ...(newEditorId
        ? { editor: { connect: { id: newEditorId } } }
        : { editor: { disconnect: true } }),
    }) as RawProject;

    // Trigger assignment side-effects (Drive share/unshare & notifications)
    this.handleEditorAssignmentEffects(
      updated.id,
      project.editor,
      updated.editor,
      updated.driveFolder,
      updated.title
    );

    this.syncToSheets(updated);
    return serializeProject(updated, requester);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async deleteProject(id: string) {
    const project = await projectRepository.findById(id);
    if (!project) throw ApiError.notFound('Project not found');

    // 1. Dissociate from single-project invoices by setting projectId to null
    // (Preserves the invoice financial audit history intact)
    await prisma.invoice.updateMany({
      where: { projectId: id },
      data: { projectId: null },
    });

    // 2. Delete EditorAssignmentLog records referencing this project
    await prisma.editorAssignmentLog.deleteMany({
      where: { projectId: id },
    });

    // 3. Delete Notification records referencing this project
    await prisma.notification.deleteMany({
      where: { projectId: id },
    });

    logger.info(`[ProjectService] Cleaned up and dissociated dependent records for project: ${id}`);

    // 4. Perform the hard delete of the project itself (Prisma handles cascade for project files)
    return projectRepository.delete(id);
  }
}

export const projectService = new ProjectService();
