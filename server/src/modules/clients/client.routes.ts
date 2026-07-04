import { Router } from 'express';
import { clientController } from './client.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { Role } from '@prisma/client';
import {
  createClientSchema,
  updateClientSchema,
  listClientsSchema,
} from './client.validator';

const router = Router();

router.use(authenticate);

// GET /api/v1/clients/me — Client's own profile
router.get('/me', authorize(Role.CLIENT), clientController.getMyProfile);

// GET /api/v1/clients — Admin, Editor
router.get(
  '/',
  authorize(Role.ADMIN, Role.EDITOR),
  validate(listClientsSchema, 'query'),
  clientController.listClients
);

// POST /api/v1/clients — Admin only
router.post(
  '/',
  authorize(Role.ADMIN),
  validate(createClientSchema),
  clientController.createClient
);

// GET /api/v1/clients/:id — Admin, Editor
router.get('/:id', authorize(Role.ADMIN, Role.EDITOR), clientController.getClientById);

// GET /api/v1/clients/:id/balance — Admin (any), Client (own only); service enforces 403 for editor
router.get('/:id/balance', authenticate, clientController.getBalance);

// PATCH /api/v1/clients/:id — Admin
router.patch(
  '/:id',
  authorize(Role.ADMIN),
  validate(updateClientSchema),
  clientController.updateClient
);

// DELETE /api/v1/clients/:id — Admin only
router.delete('/:id', authorize(Role.ADMIN), clientController.deleteClient);

export default router;
