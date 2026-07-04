import { Request, Response } from 'express';
import { notificationService } from './notification.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export class NotificationController {
  getUserNotifications = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await notificationService.getUserNotifications(
      req.user!.id,
      req.query as any
    );
    ApiResponse.paginated(res, result.data, result.meta, 'Notifications retrieved successfully');
  });

  getUnreadCount = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const count = await notificationService.getUnreadCount(req.user!.id);
    ApiResponse.success(res, { count }, 'Unread count retrieved');
  });

  markAsRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await notificationService.markAsRead(req.params.id as string, req.user!.id);
    ApiResponse.success(res, null, 'Notification marked as read');
  });

  markAllAsRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await notificationService.markAllAsRead(req.user!.id);
    ApiResponse.success(res, null, 'All notifications marked as read');
  });

  deleteNotification = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await notificationService.deleteNotification(req.params.id as string, req.user!.id);
    ApiResponse.noContent(res);
  });

  clearAllRead = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await notificationService.clearAllRead(req.user!.id);
    ApiResponse.success(res, null, 'Read notifications cleared');
  });
}

export const notificationController = new NotificationController();
