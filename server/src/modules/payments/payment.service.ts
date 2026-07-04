import { InvoiceStatus, PaymentStatus } from '@prisma/client';
import { paymentRepository } from './payment.repository';
import { invoiceRepository } from '../invoices/invoice.repository';
import { ApiError } from '../../utils/ApiError';
import prisma from '../../config/database';
import {
  CreatePaymentInput,
  UpdatePaymentInput,
  ListPaymentsQuery,
} from './payment.validator';

export class PaymentService {
  async listPayments(query: ListPaymentsQuery) {
    return paymentRepository.findAll(query);
  }

  async getPaymentById(id: string) {
    const payment = await paymentRepository.findById(id);
    if (!payment) throw ApiError.notFound('Payment not found');
    return payment;
  }

  async createPayment(input: CreatePaymentInput) {
    const invoice = await invoiceRepository.findById(input.invoiceId);
    if (!invoice) throw ApiError.notFound('Invoice not found');

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw ApiError.badRequest('Cannot record payment for a cancelled invoice');
    }
    if (invoice.status === InvoiceStatus.PAID) {
      throw ApiError.badRequest('Invoice is already fully paid');
    }

    const remaining =
      Number(invoice.total) - Number(invoice.amountPaid);

    if (input.amount > remaining) {
      throw ApiError.badRequest(
        `Payment amount (${input.amount}) exceeds remaining balance (${remaining.toFixed(2)})`
      );
    }

    // Create payment and update invoice in a transaction
    const [payment] = await prisma.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          amount: input.amount,
          method: input.method,
          status: PaymentStatus.COMPLETED,
          transactionId: input.transactionId,
          reference: input.reference,
          notes: input.notes,
          paidAt: input.paidAt ?? new Date(),
          invoice: { connect: { id: input.invoiceId } },
        },
      });

      const newAmountPaid = Number(invoice.amountPaid) + input.amount;
      const isFullyPaid = newAmountPaid >= Number(invoice.total);

      await tx.invoice.update({
        where: { id: input.invoiceId },
        data: {
          amountPaid: newAmountPaid,
          status: isFullyPaid ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL,
          ...(isFullyPaid && { paidAt: new Date() }),
        },
      });

      return [newPayment];
    });

    return paymentRepository.findById(payment.id);
  }

  async updatePayment(id: string, input: UpdatePaymentInput) {
    const payment = await paymentRepository.findById(id);
    if (!payment) throw ApiError.notFound('Payment not found');
    return paymentRepository.update(id, input);
  }

  async deletePayment(id: string) {
    const payment = await paymentRepository.findById(id);
    if (!payment) throw ApiError.notFound('Payment not found');
    return paymentRepository.delete(id);
  }
}

export const paymentService = new PaymentService();
