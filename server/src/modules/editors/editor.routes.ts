import { Router } from 'express';
import { editorController } from './editor.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { Role } from '@prisma/client';
import {
  createEditorSchema,
  updateEditorSchema,
  listEditorsSchema,
} from './editor.validator';

const router = Router();

router.use(authenticate);

// GET /api/v1/editors/me — Editor's own profile
router.get('/me', authorize(Role.EDITOR), editorController.getMyProfile);

// GET /api/v1/editors — Admin
router.get(
  '/',
  authorize(Role.ADMIN),
  validate(listEditorsSchema, 'query'),
  editorController.listEditors
);

// POST /api/v1/editors — Admin only
router.post(
  '/',
  authorize(Role.ADMIN),
  validate(createEditorSchema),
  editorController.createEditor
);

// GET /api/v1/editors/:id — Admin
router.get('/:id', authorize(Role.ADMIN), editorController.getEditorById);

// GET /api/v1/editors/:id/earnings — Admin (any), Editor (own only); service enforces 403 for client
router.get('/:id/earnings', editorController.getEarnings);

// PATCH /api/v1/editors/:id — Admin
router.patch(
  '/:id',
  authorize(Role.ADMIN),
  validate(updateEditorSchema),
  editorController.updateEditor
);

// DELETE /api/v1/editors/:id — Admin only
router.delete('/:id', authorize(Role.ADMIN), editorController.deleteEditor);

export default router;
