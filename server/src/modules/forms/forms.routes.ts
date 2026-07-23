import { Router } from 'express';
import { formsController } from './forms.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { Role } from '@prisma/client';
import { connectFormSchema, saveFormMappingSchema } from './forms.validator';

const router = Router();

router.use(authenticate);
router.use(authorize(Role.ADMIN));

// GET /api/v1/forms — List connected forms (Admin only)
router.get('/', formsController.listForms);

// POST /api/v1/forms/connect — Preview Google Form structure (Admin only)
router.post('/connect', validate(connectFormSchema), formsController.connectForm);

// POST /api/v1/forms/mapping — Save form mapping and create Google Forms watch (Admin only)
router.post('/mapping', validate(saveFormMappingSchema), formsController.saveMapping);

// POST /api/v1/forms/:connectedFormId/mapping — Alias route for mapping an existing connectedForm
router.post('/:connectedFormId/mapping', validate(saveFormMappingSchema), formsController.saveMapping);

// POST /api/v1/forms/:id/renew-watch — Renew Google Forms watch manually (Admin only)
router.post('/:id/renew-watch', formsController.renewWatch);

// POST /api/v1/forms/:id/sync — Manually synchronize form responses (Admin only)
router.post('/:id/sync', formsController.syncForm);

export default router;
