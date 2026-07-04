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
      priority: input.priority,
      dueDate: input.dueDate,
      budget: input.budget,
      clientPrice: input.clientPrice,
      editorPrice: input.editorPrice,
      tags: input.tags,
      notes: input.notes,
      driveFolder: input.driveFolder,
      formLink: input.formLink,
      client: { connect: { id: input.clientId } },
      ...(input.editorId && { editor: { connect: { id: input.editorId } } }),
    }) as RawProject;

    this.syncToSheets(project);

    return serializeProject(project, { id: '', email: '', name: '', role: Role.ADMIN });
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async updateProject(id: string, input: UpdateProjectInput) {
    const project = await projectRepository.findById(id);
    if (!project) throw ApiError.notFound('Project not found');

    if (input.editorId !== undefined && input.editorId) {
      const editor = await prisma.editor.findUnique({ where: { id: input.editorId } });
      if (!editor) throw ApiError.notFound('Editor not found');
    }

    const { editorId, ...updateData } = input;

    const updated = await projectRepository.update(id, {
      ...updateData,
      ...(editorId !== undefined && {
        editor: editorId ? { connect: { id: editorId } } : { disconnect: true },
      }),
    }) as RawProject;

    // Automate: Share project's Google Drive folder with the assigned editor
    if (editorId !== undefined && editorId && updated.editor?.user?.email && updated.driveFolder) {
      const folderIdMatch = updated.driveFolder.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      const driveFolderId = folderIdMatch ? folderIdMatch[1] : updated.driveFolder;

      googleDriveService.shareFolder(driveFolderId, updated.editor.user.email).catch((err) => {
        logger.error(`[ProjectService] Failed to share Drive folder for project ${updated.id} with editor: ${err.message}`);
      });
    }

    // Automate: Notify assigned editor
    if (editorId !== undefined && editorId && updated.editor?.user?.id) {
      notificationService.notifyUser(
        updated.editor.user.id,
        'Project Assigned',
        `You have been assigned to the project: "${updated.title}"`,
        'PROJECT_ASSIGNED',
        updated.id
      ).catch((err) => {
        logger.error(`[ProjectService] Editor assignment notification failed: ${err.message}`);
      });
    }

    this.syncToSheets(updated);

    // updateProject is admin+editor; always return admin view for simplicity
    return serializeProject(updated, { id: '', email: '', name: '', role: Role.ADMIN });
  }

  // ── Status ────────────────────────────────────────────────────────────────

  async updateProjectStatus(id: string, input: UpdateProjectStatusInput) {
    const project = await projectRepository.findById(id);
    if (!project) throw ApiError.notFound('Project not found');

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

  // ── Delete ────────────────────────────────────────────────────────────────

  async deleteProject(id: string) {
    const project = await projectRepository.findById(id);
    if (!project) throw ApiError.notFound('Project not found');
    return projectRepository.delete(id);
  }
}

export const projectService = new ProjectService();
