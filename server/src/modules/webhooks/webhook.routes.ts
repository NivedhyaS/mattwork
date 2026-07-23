import { Router } from 'express';
import { webhookController } from './webhook.controller';

const router = Router();

// Public webhook: legacy Google Apps Script form intake (secret-authenticated)
router.post('/google-form', webhookController.googleFormIntake);

// Public webhook: Google Pub/Sub push endpoint for Forms API watch notifications
// Authentication is performed via OIDC JWT verification inside the handler
router.post('/forms-pubsub', webhookController.formsPubSub);

export default router;
