import { Router } from 'express';
import { projectController } from './project.controller';
import { commentController } from './comment.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { Role } from '@prisma/client';
import {
  createProjectSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
  listProjectsSchema,
  reassignEditorSchema,
  addCommentSchema,
  updateCommentSchema,
} from './project.validator';

const router = Router();

router.use(authenticate);

// GET /api/v1/projects — All roles (scoped by role in service)
router.get(
  '/',
  validate(listProjectsSchema, 'query'),
  projectController.listProjects
);

// POST /api/v1/projects — Admin only
router.post(
  '/',
  authorize(Role.ADMIN),
  validate(createProjectSchema),
  projectController.createProject
);

// GET /api/v1/projects/:id — All roles (access control in service)
router.get('/:id', projectController.getProjectById);

// PATCH /api/v1/projects/:id/editor — Admin only (must be before /:id PATCH)
router.patch(
  '/:id/editor',
  authorize(Role.ADMIN),
  validate(reassignEditorSchema),
  projectController.reassignEditor
);

// PATCH /api/v1/projects/:id — Admin, Editor
router.patch(
  '/:id',
  authorize(Role.ADMIN, Role.EDITOR),
  validate(updateProjectSchema),
  projectController.updateProject
);

// PATCH /api/v1/projects/:id/status — Admin, Editor
router.patch(
  '/:id/status',
  authorize(Role.ADMIN, Role.EDITOR),
  validate(updateProjectStatusSchema),
  projectController.updateStatus
);

// DELETE /api/v1/projects/:id — Admin only
router.delete('/:id', authorize(Role.ADMIN), projectController.deleteProject);

// ── Internal Comments — ADMIN and EDITOR only (CLIENT blocked at route level) ──

// GET /api/v1/projects/:id/comments
router.get(
  '/:id/comments',
  authorize(Role.ADMIN, Role.EDITOR),
  commentController.getComments
);

// POST /api/v1/projects/:id/comments
router.post(
  '/:id/comments',
  authorize(Role.ADMIN, Role.EDITOR),
  validate(addCommentSchema),
  commentController.addComment
);

// PATCH /api/v1/projects/:id/comments/:commentId — Admin only
router.patch(
  '/:id/comments/:commentId',
  authorize(Role.ADMIN),
  validate(updateCommentSchema),
  commentController.updateComment
);

// DELETE /api/v1/projects/:id/comments/:commentId — Admin only
router.delete(
  '/:id/comments/:commentId',
  authorize(Role.ADMIN),
  commentController.deleteComment
);

export default router;
