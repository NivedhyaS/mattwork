import { Router } from 'express';
import { projectController } from './project.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { Role } from '@prisma/client';
import {
  createProjectSchema,
  updateProjectSchema,
  updateProjectStatusSchema,
  listProjectsSchema,
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

export default router;
