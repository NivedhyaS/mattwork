import { Prisma, ProjectStatus, Priority } from '@prisma/client';
import { BaseRepository } from '../../repositories/base.repository';
import { PaginationParams } from '../../types';

const projectSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  submissionDate: true,
  budget: true,
  tags: true,
  notes: true,
  driveFolder: true,
  formLink: true,
  rawMaterialsFolder: true,
  clientPrice: true,
  editorPrice: true,
  clientId: true,
  editorId: true,
  createdAt: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      company: true,
      currency: true,
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
  },
  editor: {
    select: {
      id: true,
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
  },
  _count: { select: { files: true, invoices: true } },
} as const;

const commentSelect = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  authorId: true,
  author: {
    select: { id: true, name: true, role: true },
  },
} as const;

export class ProjectRepository extends BaseRepository<any, any, any> {
  readonly modelName = 'Project';

  async findAll(
    params: PaginationParams & {
      status?: ProjectStatus;
      priority?: Priority;
      clientId?: string;
      editorId?: string;
      search?: string;
      client?: string;
      editor?: string;
      month?: string;
      deadlineBefore?: Date;
      deadlineAfter?: Date;
      minValue?: number;
      maxValue?: number;
      excludeInvoiced?: boolean;
    }
  ) {
    const {
      status,
      priority,
      clientId,
      editorId,
      search,
      client,
      editor,
      month,
      deadlineBefore,
      deadlineAfter,
      minValue,
      maxValue,
      excludeInvoiced,
      ...pagination
    } = params;

    const andConditions: Prisma.ProjectWhereInput[] = [];

    if (status) andConditions.push({ status });
    if (priority) andConditions.push({ priority });
    if (clientId) andConditions.push({ clientId });
    if (editorId) andConditions.push({ editorId });
    if (search) {
      andConditions.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { tags: { has: search } },
        ],
      });
    }

    if (client) {
      andConditions.push({
        OR: [
          { clientId: client },
          { client: { user: { name: { contains: client, mode: 'insensitive' } } } },
          { client: { company: { contains: client, mode: 'insensitive' } } },
        ],
      });
    }

    if (editor) {
      andConditions.push({
        OR: [
          { editorId: editor },
          { editor: { user: { name: { contains: editor, mode: 'insensitive' } } } },
        ],
      });
    }

    if (month) {
      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10) - 1;
      const startDate = new Date(year, monthNum, 1);
      const endDate = new Date(year, monthNum + 1, 1);
      andConditions.push({
        dueDate: {
          gte: startDate,
          lt: endDate,
        },
      });
    }

    if (deadlineBefore || deadlineAfter) {
      const dateFilter: Prisma.DateTimeNullableFilter = {};
      if (deadlineBefore) dateFilter.lte = deadlineBefore;
      if (deadlineAfter) dateFilter.gte = deadlineAfter;
      andConditions.push({ dueDate: dateFilter });
    }

    if (minValue !== undefined || maxValue !== undefined) {
      const priceFilter: Prisma.DecimalNullableFilter = {};
      if (minValue !== undefined) priceFilter.gte = minValue;
      if (maxValue !== undefined) priceFilter.lte = maxValue;
      andConditions.push({ clientPrice: priceFilter });
    }

    // Exclude projects already covered by a live (non-cancelled) invoice
    if (excludeInvoiced) {
      andConditions.push({
        invoices: { none: { status: { not: 'CANCELLED' } } },
        invoicedProjects: { none: { status: { not: 'CANCELLED' } } },
      });
    }

    const where: Prisma.ProjectWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    return this.paginate(
      ({ skip, take, orderBy }) =>
        this.db.project.findMany({ where, skip, take, orderBy, select: projectSelect }),
      () => this.db.project.count({ where }),
      pagination
    );
  }

  async findById(id: string) {
    return this.db.project.findUnique({
      where: { id },
      select: {
        ...projectSelect,
        files: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            url: true,
            fileType: true,
            size: true,
            version: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        invoices: {
          select: {
            id: true,
            number: true,
            status: true,
            total: true,
            dueDate: true,
            createdAt: true,
          },
        },
        comments: {
          select: commentSelect,
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async findByClientId(clientId: string, params: PaginationParams) {
    return this.paginate(
      ({ skip, take, orderBy }) =>
        this.db.project.findMany({
          where: { clientId },
          skip,
          take,
          orderBy,
          select: projectSelect,
        }),
      () => this.db.project.count({ where: { clientId } }),
      params
    );
  }

  async findByEditorId(editorId: string, params: PaginationParams) {
    return this.paginate(
      ({ skip, take, orderBy }) =>
        this.db.project.findMany({
          where: { editorId },
          skip,
          take,
          orderBy,
          select: projectSelect,
        }),
      () => this.db.project.count({ where: { editorId } }),
      params
    );
  }

  async create(data: Prisma.ProjectCreateInput) {
    return this.db.project.create({ data, select: projectSelect });
  }

  async update(id: string, data: Prisma.ProjectUpdateInput) {
    return this.db.project.update({ where: { id }, data, select: projectSelect });
  }

  async delete(id: string) {
    return this.db.project.delete({ where: { id } });
  }

  // ── Comments ──────────────────────────────────────────────────────────────

  async getComments(projectId: string) {
    return this.db.projectComment.findMany({
      where: { projectId },
      select: commentSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async addComment(projectId: string, authorId: string, content: string) {
    return this.db.projectComment.create({
      data: { projectId, authorId, content },
      select: commentSelect,
    });
  }

  async updateComment(commentId: string, content: string) {
    return this.db.projectComment.update({
      where: { id: commentId },
      data: { content },
      select: commentSelect,
    });
  }

  async deleteComment(commentId: string) {
    return this.db.projectComment.delete({ where: { id: commentId } });
  }

  async findCommentById(commentId: string) {
    return this.db.projectComment.findUnique({
      where: { id: commentId },
      select: { id: true, authorId: true, projectId: true },
    });
  }
}

export const projectRepository = new ProjectRepository();
