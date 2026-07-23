import { Role } from '@prisma/client';
import { projectRepository } from './project.repository';
import { ApiError } from '../../utils/ApiError';
import { AuthUser } from '../../types/express';
import { resolveProjectId } from '../../utils/project';

export class CommentService {
  /**
   * Get all comments for a project.
   * CLIENT role is blocked at route level, but double-check here for safety.
   */
  async getComments(projectIdOrSlug: string, requester: AuthUser) {
    if (requester.role === Role.CLIENT) {
      throw ApiError.forbidden('Clients cannot access internal comments');
    }

    const projectId = await resolveProjectId(projectIdOrSlug);

    // Verify project exists
    const project = await projectRepository.findById(projectId);
    if (!project) throw ApiError.notFound('Project not found');

    // Editors can only see comments on their assigned projects
    if (requester.role === Role.EDITOR && project.editorId !== null) {
      const editor = await (projectRepository as any).db.editor.findUnique({
        where: { userId: requester.id },
        select: { id: true },
      });
      if (!editor || project.editorId !== editor.id) {
        throw ApiError.forbidden('Access denied');
      }
    }

    return projectRepository.getComments(projectId);
  }

  /**
   * Add a comment to a project.
   * ADMIN and EDITOR only.
   */
  async addComment(projectIdOrSlug: string, content: string, requester: AuthUser) {
    if (requester.role === Role.CLIENT) {
      throw ApiError.forbidden('Clients cannot post comments');
    }

    const projectId = await resolveProjectId(projectIdOrSlug);

    const project = await projectRepository.findById(projectId);
    if (!project) throw ApiError.notFound('Project not found');

    return projectRepository.addComment(projectId, requester.id, content);
  }

  /**
   * Update a comment — ADMIN only.
   */
  async updateComment(commentId: string, content: string, requester: AuthUser) {
    if (requester.role !== Role.ADMIN) {
      throw ApiError.forbidden('Only administrators can edit comments');
    }

    const comment = await projectRepository.findCommentById(commentId);
    if (!comment) throw ApiError.notFound('Comment not found');

    return projectRepository.updateComment(commentId, content);
  }

  /**
   * Delete a comment — ADMIN only.
   */
  async deleteComment(commentId: string, requester: AuthUser) {
    if (requester.role !== Role.ADMIN) {
      throw ApiError.forbidden('Only administrators can delete comments');
    }

    const comment = await projectRepository.findCommentById(commentId);
    if (!comment) throw ApiError.notFound('Comment not found');

    return projectRepository.deleteComment(commentId);
  }
}

export const commentService = new CommentService();
