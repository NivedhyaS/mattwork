import { Router } from 'express';
import { webhookController } from './webhook.controller';

const router = Router();

// Public webhook route for Google Form intake
router.post('/google-form', webhookController.googleFormIntake);

export default router;
