import { Router } from 'express';
import { userController } from './user.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { Role } from '@prisma/client';
import {
  updateUserSchema,
  listUsersSchema,
  changePasswordSchema,
  adminPasswordResetSchema,
} from './user.validator';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// GET /api/v1/users — Admin only
router.get(
  '/',
  authorize(Role.ADMIN),
  validate(listUsersSchema, 'query'),
  userController.listUsers
);

// GET /api/v1/users/:id — Admin only
router.get('/:id', authorize(Role.ADMIN), userController.getUserById);

// PATCH /api/v1/users/:id — Admin only
router.patch(
  '/:id',
  authorize(Role.ADMIN),
  validate(updateUserSchema),
  userController.updateUser
);

// DELETE /api/v1/users/:id — Admin only
router.delete('/:id', authorize(Role.ADMIN), userController.deleteUser);

// PATCH /api/v1/users/:id/toggle-status — Admin only
router.patch(
  '/:id/toggle-status',
  authorize(Role.ADMIN),
  userController.toggleStatus
);

// POST /api/v1/users/:id/admin-password-reset — Admin only
router.post(
  '/:id/admin-password-reset',
  authorize(Role.ADMIN),
  validate(adminPasswordResetSchema),
  userController.adminPasswordReset
);

// POST /api/v1/users/change-password — Any authenticated user
router.post(
  '/change-password',
  validate(changePasswordSchema),
  userController.changePassword
);

export default router;
