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
    const result = await invoiceService.listInvoices(req.query as any);
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
      amount: Number(item.price || item.amount || invoice.subtotal),
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
      total: Number(invoice.total),
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

    // Find all completed projects
    const completedProjects = await prisma.project.findMany({
      where: {
        editorId: editor.id,
        status: 'UPLOADED'
      },
      orderBy: { updatedAt: 'desc' }
    });

    const rate = editor.hourlyRate ? Number(editor.hourlyRate) : 500; // Flat rate fallback
    const totalAmount = completedProjects.length * rate;
    const invoiceNumber = `EDR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const pdfBuffer = await pdfService.generateEditorInvoicePDF({
      editorName: editor.user.name,
      invoiceNumber,
      month: (month as string) || new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
      completedProjects: completedProjects.map(p => ({
        title: p.title,
        completedDate: p.updatedAt.toLocaleDateString()
      })),
      ratePerProject: rate,
      totalAmount,
      paymentDetails: `Bank Payout for ${editor.user.name}`
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=editor_invoice_${month || 'current'}.pdf`);
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
      if (!editorProfile || invoice.project.editorId !== editorProfile.id) {
        throw ApiError.forbidden('You can only generate PDFs for invoices of your assigned projects');
      }
    } else if (requester.role === Role.ADMIN) {
      if (typeQuery === 'editor') {
        type = 'editor';
      } else {
        type = 'client';
      }
    }

    // Check project completion status
    const isProjectCompleted = COMPLETED_STATUSES.includes(invoice.project.status);

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
        total: Number(invoice.total),
      });
    } else {
      const editorName = invoice.project.editor?.user?.name || 'Unassigned Editor';
      
      const completedProjects = (isProjectCompleted && invoice.project.editorId)
        ? [{
            title: invoice.project.title,
            completedDate: invoice.project.updatedAt.toLocaleDateString()
          }]
        : [];

      const editorPrice = Number(invoice.project.editorPrice ?? 0);
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
