import { Prisma, NotificationType } from '@prisma/client';
import { notificationRepository } from './notification.repository';
import { PaginationParams } from '../../types';

export class NotificationService {
  async getUserNotifications(
    userId: string,
    params: PaginationParams & { isRead?: boolean; type?: NotificationType }
  ) {
    return notificationRepository.findAllByUser(userId, params);
  }

  async getUnreadCount(userId: string) {
    return notificationRepository.getUnreadCount(userId);
  }

  async markAsRead(id: string, userId: string) {
    return notificationRepository.markAsRead(id, userId);
  }

  async markAllAsRead(userId: string) {
    return notificationRepository.markAllAsRead(userId);
  }

  async deleteNotification(id: string, userId: string) {
    return notificationRepository.delete(id, userId);
  }

  async clearAllRead(userId: string) {
    return notificationRepository.deleteAllRead(userId);
  }

  // Internal method to be called by other services
  async notifyUser(
    userId: string,
    title: string,
    message: string,
    type: NotificationType = 'GENERAL',
    projectId?: string,
    metadata?: Prisma.InputJsonValue
  ) {
    return notificationRepository.create({
      title,
      message,
      type,
      ...(projectId && { project: { connect: { id: projectId } } }),
      ...(metadata && { metadata }),
      user: { connect: { id: userId } },
    });
  }
}

export const notificationService = new NotificationService();
