import { Request, Response } from 'express';
import { invoiceService } from './invoice.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { pdfService } from '../../services/pdf.service';
import prisma from '../../config/database';
import fs from 'fs';
import path from 'path';
import { Role } from '@prisma/client';
import { ApiError } from '../../utils/ApiError';
import { COMPLETED_STATUSES } from '../clients/client.service';

export class InvoiceController {
  listInvoices = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await invoiceService.listInvoices(req.query as any, (req as any).user);
    ApiResponse.paginated(res, result.data, result.meta, 'Invoices retrieved successfully');
  });

  getInvoiceById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const invoice = await invoiceService.getInvoiceById(req.params.id as string);
    ApiResponse.success(res, invoice, 'Invoice retrieved successfully');
  });

  createInvoice = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const invoice = await invoiceService.createInvoice(req.body);
    ApiResponse.created(res, invoice, 'Invoice created successfully');
  });

  updateInvoice = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const invoice = await invoiceService.updateInvoice(req.params.id as string, req.body);
    ApiResponse.success(res, invoice, 'Invoice updated successfully');
  });

  markAsSent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const invoice = await invoiceService.markAsSent(req.params.id as string);
    ApiResponse.success(res, invoice, 'Invoice marked as sent');
  });

  deleteInvoice = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await invoiceService.deleteInvoice(req.params.id as string);
    ApiResponse.noContent(res);
  });

  downloadInvoicePdf = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const invoice = await invoiceService.getInvoiceById(req.params.id as string);
    
    const items = (invoice.items as any[]).map(item => ({
      description: item.description || 'Video Editing Services',
      quantity: item.quantity || 1,
      amount: Number(item.unitPrice || item.price || item.amount || invoice.subtotal),
      total: Number(item.total || invoice.subtotal)
    }));

    const pdfBuffer = await pdfService.generateClientInvoicePDF({
      invoiceNumber: invoice.number,
      clientName: invoice.client.user.name,
      clientCompany: invoice.client.company || undefined,
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Upon Receipt',
      items,
      subtotal: Number(invoice.subtotal),
      taxAmount: Number(invoice.taxAmount),
      discount: Number(invoice.discount || 0),
      total: Number(invoice.total),
      currency: invoice.client.currency,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${invoice.number}.pdf`);
    res.send(pdfBuffer);
  });

  downloadEditorInvoicePdf = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { month } = req.query;
    
    // Find Editor
    const editor = await prisma.editor.findUnique({
      where: { userId: (req as any).user!.id },
      include: { user: true }
    });

    if (!editor) {
      res.status(404).json({ error: 'Editor profile not found' });
      return;
    }

    // Parse month (e.g. "July 2026") into a date range filter
    let dateFilter: any = undefined;
    if (month) {
      const monthStr = month as string;
      const parts = monthStr.split(' ');
      if (parts.length === 2) {
        const monthName = parts[0];
        const year = parseInt(parts[1], 10);
        const date = new Date(`${monthName} 1, ${year}`);
        if (!isNaN(date.getTime())) {
          const start = new Date(date.getFullYear(), date.getMonth(), 1);
          const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
          dateFilter = {
            gte: start,
            lt: end
          };
        }
      }
    }

    // Find completed projects matching the selected month range (if provided)
    const completedProjects = await prisma.project.findMany({
      where: {
        editorId: editor.id,
        status: 'UPLOADED',
        ...(dateFilter && { updatedAt: dateFilter })
      },
      include: {
        client: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Map projects and sum actual project-specific editorPrice fields
    const projectsMapped = [];
    for (const p of completedProjects) {
      if (p.editorPrice == null) {
        throw ApiError.badRequest(
          `Unable to compile invoice payout statement: Completed project "${p.title}" does not have an editor payout price (editorPrice) configured by the administrator. Please ask your administrator to set the project price.`
        );
      }
      projectsMapped.push({
        title: p.title,
        completedDate: p.updatedAt.toLocaleDateString(),
        rate: Number(p.editorPrice),
        currency: p.client?.currency || 'USD'
      });
    }

    const totalAmount = projectsMapped.reduce((sum, p) => sum + p.rate, 0);

    // Compute sequential/auto-incrementing invoice number up to the end of the month
    const endOfRange = dateFilter ? dateFilter.lt : new Date();
    const completedCount = await prisma.project.count({
      where: {
        editorId: editor.id,
        status: 'UPLOADED',
        updatedAt: {
          lt: endOfRange
        }
      }
    });

    const editorIdSuffix = editor.id.substring(editor.id.length - 4).toUpperCase();
    const invoiceNumber = `EDR-${editorIdSuffix}-${String(completedCount).padStart(4, '0')}`;

    const pdfBuffer = await pdfService.generateEditorInvoicePDF({
      editorName: editor.user.name,
      invoiceNumber,
      month: (month as string) || new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
      completedProjects: projectsMapped,
      ratePerProject: editor.hourlyRate ? Number(editor.hourlyRate) : 500,
      totalAmount,
      paymentDetails: `Bank Payout for ${editor.user.name}`
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=editor_invoice_${(month as string || 'current').replace(/\s+/g, '_')}.pdf`);
    res.send(pdfBuffer);
  });

  generatePdf = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const requester = (req as any).user!;
    const typeQuery = req.query.type as string;

    // Load invoice with relations
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            editor: {
              include: { user: true }
            }
          }
        },
        client: {
          include: {
            user: true
          }
        }
      }
    });

    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }

    // Determine type & enforce access controls
    let type: 'client' | 'editor' = 'client';

    if (requester.role === Role.CLIENT) {
      if (typeQuery && typeQuery !== 'client') {
        throw ApiError.forbidden('Clients cannot request editor invoice PDFs');
      }
      type = 'client';
      const clientProfile = await prisma.client.findUnique({
        where: { userId: requester.id },
        select: { id: true }
      });
      if (!clientProfile || invoice.clientId !== clientProfile.id) {
        throw ApiError.forbidden('You can only generate PDFs for your own invoices');
      }
    } else if (requester.role === Role.EDITOR) {
      if (typeQuery && typeQuery !== 'editor') {
        throw ApiError.forbidden('Editors cannot request client invoice PDFs');
      }
      type = 'editor';
      const editorProfile = await prisma.editor.findUnique({
        where: { userId: requester.id },
        select: { id: true }
      });
      if (!editorProfile || invoice.project?.editorId !== editorProfile.id) {
        throw ApiError.forbidden('You can only generate PDFs for invoices of your assigned projects');
      }
    } else if (requester.role === Role.ADMIN) {
      if (typeQuery === 'editor') {
        type = 'editor';
      } else {
        type = 'client';
      }
    }

    // Check project completion status (project may be null for multi-project invoices)
    const isProjectCompleted = invoice.project
      ? COMPLETED_STATUSES.includes(invoice.project.status)
      : true; // for multi-project invoices, trust items are complete

    let pdfBuffer: Buffer;

    if (type === 'client') {
      const items = isProjectCompleted 
        ? (invoice.items as any[]).map(item => ({
            description: item.description || 'Video Editing Services',
            quantity: item.quantity || 1,
            amount: Number(item.unitPrice || item.price || item.amount || invoice.subtotal),
            total: Number(item.total || invoice.subtotal)
          }))
        : [];

      pdfBuffer = await pdfService.generateClientInvoicePDF({
        invoiceNumber: invoice.number,
        clientName: invoice.client.user.name,
        clientCompany: invoice.client.company || undefined,
        dueDate: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Upon Receipt',
        items,
        subtotal: Number(invoice.subtotal),
        taxAmount: Number(invoice.taxAmount),
        discount: Number(invoice.discount || 0),
        total: Number(invoice.total),
      });
    } else {
      const editorName = invoice.project?.editor?.user?.name || 'Unassigned Editor';
      
      const completedProjects = (isProjectCompleted && invoice.project?.editorId)
        ? [{
            title: invoice.project.title,
            completedDate: invoice.project.updatedAt.toLocaleDateString()
          }]
        : [];

      const editorPrice = Number(invoice.project?.editorPrice ?? 0);
      const totalAmount = completedProjects.length > 0 ? editorPrice : 0;
      const ratePerProject = completedProjects.length > 0 ? editorPrice : 0;

      pdfBuffer = await pdfService.generateEditorInvoicePDF({
        editorName,
        invoiceNumber: invoice.number,
        month: new Date(invoice.createdAt).toLocaleString('default', { month: 'long', year: 'numeric' }),
        completedProjects,
        ratePerProject,
        totalAmount,
        paymentDetails: `Bank Payout for ${editorName}`
      });
    }

    // Stores the generated PDF file locally under a git-ignored directory
    const dirPath = path.join(__dirname, '../../../uploads/invoices');
    fs.mkdirSync(dirPath, { recursive: true });
    const filePath = path.join(dirPath, `${invoice.id}_${type}.pdf`);
    fs.writeFileSync(filePath, pdfBuffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${invoice.number}_${type}.pdf`);
    res.send(pdfBuffer);
  });
}

export const invoiceController = new InvoiceController();
