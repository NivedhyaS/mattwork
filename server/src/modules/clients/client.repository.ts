import { Prisma } from '@prisma/client';
import { BaseRepository } from '../../repositories/base.repository';
import { PaginationParams } from '../../types';

const clientSelect = {
  id: true,
  userId: true,
  company: true,
  phone: true,
  address: true,
  city: true,
  country: true,
  notes: true,
  advancePaid: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: { id: true, name: true, email: true, avatar: true, isActive: true },
  },
  _count: {
    select: { projects: true, invoices: true },
  },
} as const;

export class ClientRepository extends BaseRepository<any, any, any> {
  readonly modelName = 'Client';

  async findAll(params: PaginationParams & { search?: string }) {
    const { search, ...pagination } = params;

    const where: Prisma.ClientWhereInput = search
      ? {
          OR: [
            { company: { contains: search, mode: 'insensitive' } },
            { user: { name: { contains: search, mode: 'insensitive' } } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {};

    return this.paginate(
      ({ skip, take, orderBy }) =>
        this.db.client.findMany({ where, skip, take, orderBy, select: clientSelect }),
      () => this.db.client.count({ where }),
      pagination
    );
  }

  async findById(id: string) {
    return this.db.client.findUnique({
      where: { id },
      select: {
        ...clientSelect,
        projects: {
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async findByUserId(userId: string) {
    return this.db.client.findUnique({ where: { userId }, select: clientSelect });
  }

  async update(id: string, data: Prisma.ClientUpdateInput & { name?: string; avatar?: string | null }) {
    const { name, avatar, ...clientData } = data;
    const updateData: Prisma.ClientUpdateInput = { ...clientData };

    if (name !== undefined || avatar !== undefined) {
      updateData.user = {
        update: {
          ...(name !== undefined && { name: name as string }),
          ...(avatar !== undefined && { avatar: avatar as string | null }),
        },
      };
    }

    return this.db.client.update({
      where: { id },
      data: updateData,
      select: clientSelect,
    });
  }

  async delete(id: string) {
    return this.db.client.delete({ where: { id } });
  }
}

export const clientRepository = new ClientRepository();
