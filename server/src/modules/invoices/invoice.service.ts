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
  async listInvoices(query: ListInvoicesQuery, requester?: any) {
    if (requester && requester.role === 'CLIENT') {
      const client = await prisma.client.findUnique({
        where: { userId: requester.id },
        select: { id: true },
      });
      if (!client) throw ApiError.notFound('Client profile not found');
      query.clientId = client.id;
    }
    return invoiceRepository.findAll(query);
  }

  async getInvoiceById(id: string) {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    return invoice;
  }

  async createInvoice(input: CreateInvoiceInput) {
    const client = await prisma.client.findUnique({ where: { id: input.clientId } });
    if (!client) throw ApiError.notFound('Client not found');

    // Collect all project IDs referenced (from explicit list or legacy single projectId)
    const projectIds: string[] = input.projectIds?.length
      ? input.projectIds
      : input.projectId
        ? [input.projectId]
        : [];

    // Validate each project exists and belongs to this client
    if (projectIds.length > 0) {
      const projects = await prisma.project.findMany({
        where: { id: { in: projectIds }, clientId: input.clientId },
        include: {
          invoices: {
            where: { status: { not: 'CANCELLED' } },
            select: { id: true, number: true },
          },
          invoicedProjects: {
            where: { status: { not: 'CANCELLED' } },
            select: { id: true, number: true },
          },
        },
      });

      if (projects.length !== projectIds.length) {
        throw ApiError.badRequest('One or more projects not found or do not belong to this client');
      }

      // Duplicate-invoicing guard: reject if any project already has a live invoice
      const alreadyInvoiced = projects.filter(
        p => p.invoices.length > 0 || p.invoicedProjects.length > 0
      );
      if (alreadyInvoiced.length > 0) {
        const titles = alreadyInvoiced.map(p => p.title).join(', ');
        throw ApiError.badRequest(
          `The following projects are already covered by a live invoice and cannot be invoiced again: ${titles}. Cancel those invoices first.`
        );
      }
    }

    // For a single-project invoice keep the FK; for multi-project leave it null
    const singleProjectId = projectIds.length === 1 ? projectIds[0] : undefined;

    const subtotal = input.items.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = (subtotal * input.taxRate) / 100;
    const total = subtotal + taxAmount - input.discount;

    let retries = 5;
    while (retries > 0) {
      try {
        const number = await invoiceRepository.getNextInvoiceNumber(input.clientId);
        return await invoiceRepository.create({
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
          ...(singleProjectId ? { project: { connect: { id: singleProjectId } } } : {}),
          projects: { connect: projectIds.map(id => ({ id })) },
          client: { connect: { id: input.clientId } },
        });
      } catch (err: any) {
        if (err.code === 'P2002' && (err.meta?.target?.includes('number') || err.message?.includes('number'))) {
          retries--;
          await new Promise(r => setTimeout(r, Math.random() * 50 + 10));
        } else {
          throw err;
        }
      }
    }
    throw ApiError.badRequest('Failed to generate a unique invoice number after multiple retries.');
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
