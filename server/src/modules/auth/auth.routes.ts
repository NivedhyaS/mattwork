import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { authLimiter } from '../../middleware/rateLimiter';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from './auth.validator';

const router = Router();

// POST /api/v1/auth/register
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  authController.register
);

// POST /api/v1/auth/login
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  authController.login
);

// POST /api/v1/auth/logout  (protected)
router.post('/logout', authenticate, authController.logout);

// POST /api/v1/auth/refresh
router.post(
  '/refresh',
  authLimiter,
  validate(refreshTokenSchema),
  authController.refresh
);

// GET /api/v1/auth/me  (protected)
router.get('/me', authenticate, authController.me);

export default router;
