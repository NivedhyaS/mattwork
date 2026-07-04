import { Router } from 'express';
import { reportController } from './report.controller';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { Role } from '@prisma/client';
import { getReportSchema } from './report.validator';

const router = Router();

router.use(authenticate);
router.use(authorize(Role.ADMIN));

router.get('/revenue', validate(getReportSchema, 'query'), reportController.getRevenue);
router.get('/editor-payments', validate(getReportSchema, 'query'), reportController.getEditorPayments);
router.get('/client-utilization', validate(getReportSchema, 'query'), reportController.getClientUtilization);
router.get('/profit', validate(getReportSchema, 'query'), reportController.getProfitability);

export default router;
