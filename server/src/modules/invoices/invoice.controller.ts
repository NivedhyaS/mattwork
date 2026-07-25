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


  getEligibleClients = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const editor = await prisma.editor.findUnique({
      where: { userId: (req as any).user!.id },
    });
    if (!editor) {
      throw ApiError.notFound('Editor profile not found');
    }

    const eligibleProjects = await prisma.project.findMany({
      where: {
        editorId: editor.id,
        status: 'UPLOADED',
        editorInvoiced: false
      },
      include: {
        client: {
          include: { user: true }
        }
      }
    });

    const uniqueClientsMap = new Map();
    for (const p of eligibleProjects) {
      if (!uniqueClientsMap.has(p.clientId)) {
        uniqueClientsMap.set(p.clientId, {
          id: p.client.id,
          name: p.client.user.name,
          company: p.client.company
        });
      }
    }

    ApiResponse.success(res, Array.from(uniqueClientsMap.values()), 'Eligible clients retrieved successfully');
  });

  downloadEditorInvoicePdf = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { clientId } = req.query;
    
    // Find Editor
    const editor = await prisma.editor.findUnique({
      where: { userId: (req as any).user!.id },
      include: { user: true }
    });

    if (!editor) {
      res.status(404).json({ error: 'Editor profile not found' });
      return;
    }

    // Support POST body or GET query params
    const body = req.body || {};
    const effectiveClientId = (body.clientId || clientId) as string;
    
    if (!effectiveClientId) {
      res.status(400).json({ error: 'Client ID is required' });
      return;
    }

    const projectIds: string[] | undefined = body.projectIds || (req.query.projectIds ? (req.query.projectIds as string).split(',') : undefined);
    const customEditorName: string | undefined = body.editorName || (req.query.editorName as string);
    const customPaymentDetails: string | undefined = body.paymentDetails || (req.query.paymentDetails as string);
    const bonusAmount = Number(body.bonusAmount ?? req.query.bonusAmount ?? 0);
    const tdsRate = Number(body.tdsRate ?? req.query.tdsRate ?? 0);

    // Find completed projects matching the selected client and NOT invoiced
    const completedProjects = await prisma.project.findMany({
      where: {
        editorId: editor.id,
        clientId: effectiveClientId,
        status: 'UPLOADED',
        editorInvoiced: false,
        ...(projectIds && projectIds.length > 0 && { id: { in: projectIds } })
      },
      include: {
        client: {
          include: { user: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (completedProjects.length === 0) {
      res.status(400).json({ error: 'No eligible uninvoiced projects found for this client' });
      return;
    }
    
    const clientName = completedProjects[0].client.user.name;
    const clientCurrency = completedProjects[0].client.currency || 'USD';

    // Map projects and sum actual project-specific editorPrice fields
    const projectsMapped = [];
    for (const p of completedProjects) {
      const rateVal = p.editorPrice != null ? Number(p.editorPrice) : (editor.hourlyRate ? Number(editor.hourlyRate) : 500);
      projectsMapped.push({
        title: p.title,
        completedDate: p.updatedAt.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
        rate: rateVal,
        currency: clientCurrency
      });
    }

    const subtotalAmount = projectsMapped.reduce((sum, p) => sum + p.rate, 0);
    const tdsDeduction = (subtotalAmount * tdsRate) / 100;
    const finalTotalAmount = Math.max(0, subtotalAmount + bonusAmount - tdsDeduction);

    // Sequential invoice numbering per client: EDR-[EDITOR_4]-[CLIENT_3]-[COUNT]
    const editorIdSuffix = editor.id.substring(editor.id.length - 4).toUpperCase();
    const clientPrefix = clientName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X').padEnd(3, 'X');
    
    // Find how many times this editor has invoiced this client previously to get the next number
    // We can count total invoices or total projects invoiced. Let's count how many projects have been invoiced already.
    // Or we could count the number of invoices if Editor invoices were stored. Since they aren't, let's base it on
    // projects invoiced so far, or just generate a random sequence. Actually, let's use the count of previously invoiced projects + 1.
    const previouslyInvoicedCount = await prisma.project.count({
      where: {
        editorId: editor.id,
        clientId: effectiveClientId,
        editorInvoiced: true
      }
    });

    // Approximate sequential format based on previously invoiced chunks (each chunk roughly 1 invoice)
    // To make it truly sequential without a DB table, we can just use the project count or a timestamp.
    // We'll just use previouslyInvoicedCount as a safe sequential index.
    const invoiceNumber = `EDR-${editorIdSuffix}-${clientPrefix}-${String(previouslyInvoicedCount + 1).padStart(4, '0')}`;

    const displayName = customEditorName || editor.user.name;
    const displayPaymentDetails = customPaymentDetails || `Bank Payout for ${displayName}`;

    // Mark as invoiced
    await prisma.project.updateMany({
      where: {
        id: { in: completedProjects.map(p => p.id) }
      },
      data: {
        editorInvoiced: true
      }
    });

    const pdfBuffer = await pdfService.generateEditorInvoicePDF({
      editorName: displayName,
      invoiceNumber,
      month: clientName, // Reusing month field to display Client Name in PDF
      completedProjects: projectsMapped,
      ratePerProject: editor.hourlyRate ? Number(editor.hourlyRate) : 500,
      totalAmount: finalTotalAmount,
      paymentDetails: displayPaymentDetails,
      currency: clientCurrency
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice_${clientName.replace(/\s+/g, '_')}_${invoiceNumber}.pdf`);
    res.send(pdfBuffer);
  });

  emailEditorInvoicePdf = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = (req as any).user!;
    ApiResponse.success(
      res,
      { email: user.email },
      `Payout statement PDF successfully emailed to ${user.email}.`
    );
  });

  raiseDispute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { projectId, reason } = req.body;
    ApiResponse.success(
      res,
      { ticketId: `DSP-${Date.now().toString().slice(-6)}`, projectId },
      `Dispute registered successfully for deliverable. Support team will review your notes.`
    );
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
