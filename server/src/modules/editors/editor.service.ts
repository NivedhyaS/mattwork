import { Role } from '@prisma/client';
import { editorRepository } from './editor.repository';
import { ApiError } from '../../utils/ApiError';
import { hashPassword } from '../../utils/password.utils';
import prisma from '../../config/database';
import { AuthUser } from '../../types/express';
import { COMPLETED_STATUSES } from '../clients/client.service';
import {
  CreateEditorInput,
  UpdateEditorInput,
  ListEditorsQuery,
} from './editor.validator';

export class EditorService {
  async listEditors(query: ListEditorsQuery) {
    const result = await editorRepository.findAll(query);
    return {
      ...result,
      data: result.data.map((e: any) => ({
        ...e,
        activeProjects: e._count?.projects ?? 0,
      })),
    };
  }

  async getEditorById(id: string) {
    const editor = await editorRepository.findById(id);
    if (!editor) throw ApiError.notFound('Editor not found');
    return editor;
  }

  async getEditorByUserId(userId: string) {
    const editor = await editorRepository.findByUserId(userId);
    if (!editor) throw ApiError.notFound('Editor profile not found');
    return editor;
  }

  async createEditor(input: CreateEditorInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw ApiError.conflict('An account with this email already exists');

    const hashedPassword = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: hashedPassword,
        role: Role.EDITOR,
        editor: {
          create: {
            bio: input.bio,
            skills: input.skills,
            hourlyRate: input.hourlyRate,
            availability: input.availability,
          },
        },
      },
      include: { editor: true },
    });

    const { password: _pw, refreshToken: _rt, ...safeUser } = user;
    return safeUser;
  }

  async updateEditor(id: string, input: UpdateEditorInput) {
    const editor = await editorRepository.findById(id);
    if (!editor) throw ApiError.notFound('Editor not found');
    return editorRepository.update(id, input);
  }

  async deleteEditor(id: string) {
    const editor = await editorRepository.findById(id);
    if (!editor) throw ApiError.notFound('Editor not found');
    return prisma.user.delete({ where: { id: editor.userId } });
  }

  async getEditorEarnings(editorId: string, requester: AuthUser) {
    if (requester.role === Role.CLIENT) {
      throw ApiError.forbidden('Clients do not have access to editor earnings data');
    }

    if (requester.role === Role.EDITOR) {
      const myProfile = await prisma.editor.findUnique({
        where: { userId: requester.id },
        select: { id: true },
      });
      if (!myProfile) throw ApiError.notFound('Editor profile not found');
      if (myProfile.id !== editorId) {
        throw ApiError.forbidden('You can only view your own earnings');
      }
    }

    const editor = await prisma.editor.findUnique({
      where: { id: editorId },
      select: { id: true },
    });
    if (!editor) throw ApiError.notFound('Editor not found');

    const completedAgg = await prisma.project.aggregate({
      where: {
        editorId,
        status: { in: COMPLETED_STATUSES },
        editorPrice: { not: null },
      },
      _sum: { editorPrice: true },
      _avg: { editorPrice: true },
      _count: { id: true },
    });

    const completedCount = completedAgg._count.id;
    const totalEarnings = Number(completedAgg._sum.editorPrice ?? 0);
    const ratePerProject = completedCount > 0 ? Number(completedAgg._avg.editorPrice ?? 0) : null;

    return {
      ratePerProject,
      completedCount,
      totalEarnings,
    };
  }
}

export const editorService = new EditorService();
