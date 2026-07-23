import { Router } from 'express';
import { invoiceController } from './invoice.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { Role } from '@prisma/client';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  listInvoicesSchema,
} from './invoice.validator';

const router = Router();

router.use(authenticate);

// GET /api/v1/invoices — Admin, Editor, Client
router.get(
  '/',
  authorize(Role.ADMIN, Role.EDITOR, Role.CLIENT),
  validate(listInvoicesSchema, 'query'),
  invoiceController.listInvoices
);

// POST /api/v1/invoices — Admin, Editor
router.post(
  '/',
  authorize(Role.ADMIN, Role.EDITOR),
  validate(createInvoiceSchema),
  invoiceController.createInvoice
);

// GET & POST /api/v1/invoices/editor/pdf — Editor only
router.get(
  '/editor/pdf',
  authorize(Role.EDITOR),
  invoiceController.downloadEditorInvoicePdf
);

router.post(
  '/editor/pdf',
  authorize(Role.EDITOR),
  invoiceController.downloadEditorInvoicePdf
);

router.post(
  '/editor/email',
  authorize(Role.EDITOR),
  invoiceController.emailEditorInvoicePdf
);

router.post(
  '/editor/dispute',
  authorize(Role.EDITOR),
  invoiceController.raiseDispute
);

// GET /api/v1/invoices/:id — Admin, Editor
router.get('/:id', authorize(Role.ADMIN, Role.EDITOR), invoiceController.getInvoiceById);

// GET /api/v1/invoices/:id/pdf — Admin, Client
router.get(
  '/:id/pdf',
  authorize(Role.ADMIN, Role.CLIENT),
  invoiceController.downloadInvoicePdf
);

// POST /api/v1/invoices/:id/generate-pdf — Admin, Editor, Client; controller enforces role-based rules
router.post('/:id/generate-pdf', invoiceController.generatePdf);

// PATCH /api/v1/invoices/:id — Admin, Editor
router.patch(
  '/:id',
  authorize(Role.ADMIN, Role.EDITOR),
  validate(updateInvoiceSchema),
  invoiceController.updateInvoice
);

// POST /api/v1/invoices/:id/send — Admin, Editor
router.post('/:id/send', authorize(Role.ADMIN, Role.EDITOR), invoiceController.markAsSent);

// DELETE /api/v1/invoices/:id — Admin only
router.delete('/:id', authorize(Role.ADMIN), invoiceController.deleteInvoice);

export default router;
