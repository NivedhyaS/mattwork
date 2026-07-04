import { Prisma } from '@prisma/client';
import { BaseRepository } from '../../repositories/base.repository';
import { PaginationParams } from '../../types';

const editorSelect = {
  id: true,
  userId: true,
  bio: true,
  skills: true,
  hourlyRate: true,
  availability: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: { id: true, name: true, email: true, avatar: true, isActive: true },
  },
  _count: {
    select: { projects: true },
  },
} as const;

export class EditorRepository extends BaseRepository<any, any, any> {
  readonly modelName = 'Editor';

  async findAll(params: PaginationParams & { availability?: boolean; search?: string }) {
    const { availability, search, ...pagination } = params;

    const where: Prisma.EditorWhereInput = {
      ...(availability !== undefined && { availability }),
      ...(search && {
        OR: [
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { skills: { has: search } },
        ],
      }),
    };

    return this.paginate(
      ({ skip, take, orderBy }) =>
        this.db.editor.findMany({ where, skip, take, orderBy, select: editorSelect }),
      () => this.db.editor.count({ where }),
      pagination
    );
  }

  async findById(id: string) {
    return this.db.editor.findUnique({
      where: { id },
      select: {
        ...editorSelect,
        projects: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            client: { select: { id: true, company: true, user: { select: { name: true } } } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async findByUserId(userId: string) {
    return this.db.editor.findUnique({ where: { userId }, select: editorSelect });
  }

  async update(id: string, data: Prisma.EditorUpdateInput & { name?: string }) {
    const { name, ...editorData } = data;
    const updateData: Prisma.EditorUpdateInput = { ...editorData };

    if (name !== undefined) {
      updateData.user = { update: { name: name as string } };
    }

    return this.db.editor.update({
      where: { id },
      data: updateData,
      select: editorSelect,
    });
  }

  async delete(id: string) {
    return this.db.editor.delete({ where: { id } });
  }
}

export const editorRepository = new EditorRepository();
