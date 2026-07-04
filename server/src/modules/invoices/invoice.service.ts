import { InvoiceStatus } from '@prisma/client';
import { invoiceRepository } from './invoice.repository';
import { ApiError } from '../../utils/ApiError';
import prisma from '../../config/database';
import { InvoiceItem } from '../../types';
import {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  ListInvoicesQuery,
} from './invoice.validator';

export class InvoiceService {
  async listInvoices(query: ListInvoicesQuery) {
    return invoiceRepository.findAll(query);
  }

  async getInvoiceById(id: string) {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    return invoice;
  }

  async createInvoice(input: CreateInvoiceInput) {
    const project = await prisma.project.findUnique({ where: { id: input.projectId } });
    if (!project) throw ApiError.notFound('Project not found');

    const client = await prisma.client.findUnique({ where: { id: input.clientId } });
    if (!client) throw ApiError.notFound('Client not found');

    const subtotal = input.items.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = (subtotal * input.taxRate) / 100;
    const total = subtotal + taxAmount - input.discount;
    const number = await invoiceRepository.getNextInvoiceNumber();

    return invoiceRepository.create({
      number,
      subtotal,
      taxRate: input.taxRate,
      taxAmount,
      discount: input.discount,
      total,
      items: input.items as any,
      dueDate: input.dueDate,
      notes: input.notes,
      terms: input.terms,
      project: { connect: { id: input.projectId } },
      client: { connect: { id: input.clientId } },
    });
  }

  async updateInvoice(id: string, input: UpdateInvoiceInput) {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) throw ApiError.notFound('Invoice not found');

    if (
      invoice.status === InvoiceStatus.PAID ||
      invoice.status === InvoiceStatus.CANCELLED
    ) {
      if (input.items || input.taxRate !== undefined || input.discount !== undefined) {
        throw ApiError.badRequest('Cannot modify items of a paid or cancelled invoice');
      }
    }

    let updates: Record<string, unknown> = { ...input };

    // Recalculate totals if items changed
    if (input.items) {
      const subtotal = input.items.reduce((sum, item) => sum + item.total, 0);
      const taxRate = input.taxRate ?? Number(invoice.taxRate);
      const discount = input.discount ?? Number(invoice.discount);
      const taxAmount = (subtotal * taxRate) / 100;
      const total = subtotal + taxAmount - discount;
      updates = { ...updates, subtotal, taxAmount, total };
    }

    // Set sentAt when marking as sent
    if (input.status === InvoiceStatus.SENT && !invoice.sentAt) {
      updates.sentAt = new Date();
    }

    return invoiceRepository.update(id, updates);
  }

  async markAsSent(id: string) {
    return this.updateInvoice(id, { status: 'SENT' });
  }

  async deleteInvoice(id: string) {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    if (invoice.status === InvoiceStatus.PAID) {
      throw ApiError.badRequest('Cannot delete a paid invoice');
    }
    return invoiceRepository.delete(id);
  }
}

export const invoiceService = new InvoiceService();
