import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { getExchangeRate } from './exchangeRate.controller';

const router = Router();

// ADMIN-only: live USD->INR exchange rate with 1h cache
router.get('/', authenticate, authorize('ADMIN'), getExchangeRate);

export default router;
