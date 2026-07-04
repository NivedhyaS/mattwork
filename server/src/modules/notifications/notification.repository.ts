import { Prisma, NotificationType } from '@prisma/client';
import { BaseRepository } from '../../repositories/base.repository';
import { PaginationParams } from '../../types';

const notificationSelect = {
  id: true,
  title: true,
  message: true,
  type: true,
  isRead: true,
  projectId: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  project: {
    select: { id: true, title: true },
  },
} as const;

export class NotificationRepository extends BaseRepository<any, any, any> {
  readonly modelName = 'Notification';

  async findAllByUser(
    userId: string,
    params: PaginationParams & { isRead?: boolean; type?: NotificationType }
  ) {
    const { isRead, type, ...pagination } = params;

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(isRead !== undefined && { isRead }),
      ...(type && { type }),
    };

    return this.paginate(
      ({ skip, take, orderBy }) =>
        this.db.notification.findMany({ where, skip, take, orderBy, select: notificationSelect }),
      () => this.db.notification.count({ where }),
      pagination
    );
  }

  async findById(id: string) {
    return this.db.notification.findUnique({ where: { id }, select: notificationSelect });
  }

  async markAsRead(id: string, userId: string) {
    return this.db.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.db.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.db.notification.count({ where: { userId, isRead: false } });
  }

  async create(data: Prisma.NotificationCreateInput) {
    return this.db.notification.create({ data, select: notificationSelect });
  }

  async createMany(notifications: Prisma.NotificationCreateManyInput[]) {
    return this.db.notification.createMany({ data: notifications });
  }

  async delete(id: string, userId: string) {
    return this.db.notification.deleteMany({ where: { id, userId } });
  }

  async deleteAllRead(userId: string) {
    return this.db.notification.deleteMany({ where: { userId, isRead: true } });
  }
}

export const notificationRepository = new NotificationRepository();
