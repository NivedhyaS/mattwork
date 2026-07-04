import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import userRoutes from '../modules/users/user.routes';
import clientRoutes from '../modules/clients/client.routes';
import editorRoutes from '../modules/editors/editor.routes';
import projectRoutes from '../modules/projects/project.routes';
import invoiceRoutes from '../modules/invoices/invoice.routes';
import paymentRoutes from '../modules/payments/payment.routes';
import notificationRoutes from '../modules/notifications/notification.routes';
import webhookRoutes from '../modules/webhooks/webhook.routes';
import reportRoutes from '../modules/reports/report.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/clients', clientRoutes);
router.use('/editors', editorRoutes);
router.use('/projects', projectRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/payments', paymentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/reports', reportRoutes);

export default router;
