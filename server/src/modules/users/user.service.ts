import { userRepository } from './user.repository';
import { ApiError } from '../../utils/ApiError';
import { comparePassword, hashPassword } from '../../utils/password.utils';
import { UpdateUserInput, ListUsersQuery, ChangePasswordInput } from './user.validator';
import prisma from '../../config/database';

export class UserService {
  async listUsers(query: ListUsersQuery) {
    return userRepository.findAll(query);
  }

  async getUserById(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw ApiError.notFound('User not found');
    return user;
  }

  async updateUser(id: string, input: UpdateUserInput) {
    const user = await userRepository.findById(id);
    if (!user) throw ApiError.notFound('User not found');
    return userRepository.update(id, input);
  }

  async deleteUser(id: string, requesterId: string) {
    if (id === requesterId) {
      throw ApiError.badRequest('You cannot delete your own account');
    }
    const user = await userRepository.findById(id);
    if (!user) throw ApiError.notFound('User not found');

    // Manually cascade-delete all related records in dependency order
    // because the Prisma schema does not have onDelete: Cascade on all relations.
    await prisma.$transaction(async (tx) => {
      // 1. Get client/editor profile IDs for this user
      const client = await tx.client.findUnique({ where: { userId: id }, select: { id: true } });
      const editor = await tx.editor.findUnique({ where: { userId: id }, select: { id: true } });

      if (client) {
        // Delete payments → invoices → projects (for client)
        const clientInvoices = await tx.invoice.findMany({
          where: { clientId: client.id },
          select: { id: true },
        });
        const invoiceIds = clientInvoices.map((inv) => inv.id);

        if (invoiceIds.length > 0) {
          await tx.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
        }
        await tx.invoice.deleteMany({ where: { clientId: client.id } });

        const clientProjects = await tx.project.findMany({
          where: { clientId: client.id },
          select: { id: true },
        });
        const projectIds = clientProjects.map((p) => p.id);

        if (projectIds.length > 0) {
          await tx.projectFile.deleteMany({ where: { projectId: { in: projectIds } } });
          await tx.notification.deleteMany({ where: { projectId: { in: projectIds } } });
          await tx.invoice.deleteMany({ where: { projectId: { in: projectIds } } });
          await tx.project.deleteMany({ where: { clientId: client.id } });
        }

        await tx.client.delete({ where: { id: client.id } });
      }

      if (editor) {
        // Unassign editor from projects (set editorId to null) rather than deleting projects
        await tx.project.updateMany({
          where: { editorId: editor.id },
          data: { editorId: null },
        });
        await tx.editor.delete({ where: { id: editor.id } });
      }

      // Delete user notifications
      await tx.notification.deleteMany({ where: { userId: id } });

      // Finally delete the user
      await tx.user.delete({ where: { id } });
    });
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await userRepository.findByEmail(
      (await userRepository.findById(userId))?.email ?? ''
    );
    if (!user) throw ApiError.notFound('User not found');

    const isCurrentValid = await comparePassword(input.currentPassword, user.password);
    if (!isCurrentValid) {
      throw ApiError.badRequest('Current password is incorrect');
    }

    const hashed = await hashPassword(input.newPassword);
    await userRepository.updatePassword(userId, hashed);
  }

  async toggleUserStatus(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw ApiError.notFound('User not found');
    return userRepository.update(id, { isActive: !user.isActive });
  }

  async adminPasswordReset(userId: string, input: { newPassword: string }) {
    const user = await userRepository.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    const hashed = await hashPassword(input.newPassword);
    await userRepository.updatePassword(userId, hashed);
  }
}

export const userService = new UserService();
