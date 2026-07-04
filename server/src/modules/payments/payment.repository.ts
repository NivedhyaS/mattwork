import { Prisma, PaymentStatus } from '@prisma/client';
import { BaseRepository } from '../../repositories/base.repository';
import { PaginationParams } from '../../types';

const paymentSelect = {
  id: true,
  invoiceId: true,
  amount: true,
  method: true,
  status: true,
  transactionId: true,
  reference: true,
  notes: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
  invoice: {
    select: {
      id: true,
      number: true,
      total: true,
      amountPaid: true,
      status: true,
      client: {
        select: { user: { select: { name: true, email: true } } },
      },
    },
  },
} as const;

export class PaymentRepository extends BaseRepository<any, any, any> {
  readonly modelName = 'Payment';

  async findAll(
    params: PaginationParams & {
      invoiceId?: string;
      status?: PaymentStatus;
    }
  ) {
    const { invoiceId, status, ...pagination } = params;

    const where: Prisma.PaymentWhereInput = {
      ...(invoiceId && { invoiceId }),
      ...(status && { status }),
    };

    return this.paginate(
      ({ skip, take, orderBy }) =>
        this.db.payment.findMany({ where, skip, take, orderBy, select: paymentSelect }),
      () => this.db.payment.count({ where }),
      pagination
    );
  }

  async findById(id: string) {
    return this.db.payment.findUnique({ where: { id }, select: paymentSelect });
  }

  async create(data: Prisma.PaymentCreateInput) {
    return this.db.payment.create({ data, select: paymentSelect });
  }

  async update(id: string, data: Prisma.PaymentUpdateInput) {
    return this.db.payment.update({ where: { id }, data, select: paymentSelect });
  }

  async delete(id: string) {
    return this.db.payment.delete({ where: { id } });
  }
}

export const paymentRepository = new PaymentRepository();
