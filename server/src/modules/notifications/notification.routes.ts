import { Router } from 'express';
import { notificationController } from './notification.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// All notification routes are protected and scoped to the logged-in user
router.use(authenticate);

router.get('/', notificationController.getUserNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.post('/mark-all-read', notificationController.markAllAsRead);
router.post('/clear-read', notificationController.clearAllRead);

router.patch('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);

export default router;
