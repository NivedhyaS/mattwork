import { Prisma, InvoiceStatus } from '@prisma/client';
import { BaseRepository } from '../../repositories/base.repository';
import { PaginationParams } from '../../types';

const invoiceSelect = {
  id: true,
  number: true,
  status: true,
  items: true,
  subtotal: true,
  taxRate: true,
  taxAmount: true,
  discount: true,
  total: true,
  amountPaid: true,
  dueDate: true,
  sentAt: true,
  paidAt: true,
  notes: true,
  terms: true,
  createdAt: true,
  updatedAt: true,
  project: {
    select: { id: true, title: true, status: true },
  },
  client: {
    select: {
      id: true,
      company: true,
      address: true,
      city: true,
      country: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  },
  _count: { select: { payments: true } },
} as const;

export class InvoiceRepository extends BaseRepository<any, any, any> {
  readonly modelName = 'Invoice';

  async findAll(
    params: PaginationParams & {
      status?: InvoiceStatus;
      clientId?: string;
      projectId?: string;
    }
  ) {
    const { status, clientId, projectId, ...pagination } = params;

    const where: Prisma.InvoiceWhereInput = {
      ...(status && { status }),
      ...(clientId && { clientId }),
      ...(projectId && { projectId }),
    };

    return this.paginate(
      ({ skip, take, orderBy }) =>
        this.db.invoice.findMany({ where, skip, take, orderBy, select: invoiceSelect }),
      () => this.db.invoice.count({ where }),
      pagination
    );
  }

  async findById(id: string) {
    return this.db.invoice.findUnique({
      where: { id },
      select: {
        ...invoiceSelect,
        payments: {
          select: {
            id: true,
            amount: true,
            method: true,
            status: true,
            transactionId: true,
            paidAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async findByNumber(number: string) {
    return this.db.invoice.findUnique({ where: { number } });
  }

  async getNextInvoiceNumber(): Promise<string> {
    const count = await this.db.invoice.count();
    const year = new Date().getFullYear();
    return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  async create(data: Prisma.InvoiceCreateInput) {
    return this.db.invoice.create({ data, select: invoiceSelect });
  }

  async update(id: string, data: Prisma.InvoiceUpdateInput) {
    return this.db.invoice.update({ where: { id }, data, select: invoiceSelect });
  }

  async delete(id: string) {
    return this.db.invoice.delete({ where: { id } });
  }
}

export const invoiceRepository = new InvoiceRepository();
