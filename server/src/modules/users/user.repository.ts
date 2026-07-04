import { Prisma, Role } from '@prisma/client';
import { BaseRepository } from '../../repositories/base.repository';
import { PaginationParams } from '../../types';

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  avatar: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class UserRepository extends BaseRepository<
  Prisma.UserGetPayload<{ select: typeof userSelect }>,
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput
> {
  readonly modelName = 'User';

  async findAll(
    params: PaginationParams & {
      role?: Role;
      isActive?: boolean;
      search?: string;
    }
  ) {
    const { role, isActive, search, ...pagination } = params;

    const where: Prisma.UserWhereInput = {
      ...(role && { role }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    return this.paginate(
      ({ skip, take, orderBy }) =>
        this.db.user.findMany({ where, skip, take, orderBy, select: userSelect }),
      () => this.db.user.count({ where }),
      pagination
    );
  }

  async findById(id: string) {
    return this.db.user.findUnique({
      where: { id },
      select: {
        ...userSelect,
        client: { select: { id: true, company: true, phone: true, address: true, city: true, country: true } },
        editor: { select: { id: true, bio: true, skills: true, hourlyRate: true, availability: true } },
      },
    });
  }

  async findByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    return this.db.user.update({
      where: { id },
      data,
      select: userSelect,
    });
  }

  async delete(id: string) {
    return this.db.user.delete({ where: { id } });
  }

  async updatePassword(id: string, hashedPassword: string) {
    return this.db.user.update({
      where: { id },
      data: { password: hashedPassword },
      select: { id: true },
    });
  }
}

export const userRepository = new UserRepository();
