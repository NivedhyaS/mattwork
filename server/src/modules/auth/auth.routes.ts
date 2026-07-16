import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { authLimiter, forgotPasswordLimiter, resetPasswordLimiter } from '../../middleware/rateLimiter';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
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

// POST /api/v1/auth/forgot-password  (public, strict rate-limited)
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

// POST /api/v1/auth/reset-password  (public, rate-limited)
router.post(
  '/reset-password',
  resetPasswordLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword
);

export default router;
