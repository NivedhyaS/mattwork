import { Router } from 'express';
import { paymentController } from './payment.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { Role } from '@prisma/client';
import {
  createPaymentSchema,
  updatePaymentSchema,
  listPaymentsSchema,
} from './payment.validator';

const router = Router();

router.use(authenticate);

// GET /api/v1/payments — Admin only
router.get(
  '/',
  authorize(Role.ADMIN),
  validate(listPaymentsSchema, 'query'),
  paymentController.listPayments
);

// POST /api/v1/payments — Admin only
router.post(
  '/',
  authorize(Role.ADMIN),
  validate(createPaymentSchema),
  paymentController.createPayment
);

// GET /api/v1/payments/:id — Admin only
router.get('/:id', authorize(Role.ADMIN), paymentController.getPaymentById);

// PATCH /api/v1/payments/:id — Admin only
router.patch(
  '/:id',
  authorize(Role.ADMIN),
  validate(updatePaymentSchema),
  paymentController.updatePayment
);

// DELETE /api/v1/payments/:id — Admin only
router.delete('/:id', authorize(Role.ADMIN), paymentController.deletePayment);

export default router;
