import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const defaultOptions = {
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
  skip: () => process.env.NODE_ENV === 'development',
};

/** General API rate limiter: 100 requests per 15 minutes */
export const apiLimiter = rateLimit({
  ...defaultOptions,
  max: env.RATE_LIMIT_MAX,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

/** Strict auth rate limiter: 10 requests per 15 minutes */
export const authLimiter = rateLimit({
  ...defaultOptions,
  max: env.AUTH_RATE_LIMIT_MAX,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes',
  },
});

/** Lenient limiter for public endpoints */
export const publicLimiter = rateLimit({
  ...defaultOptions,
  max: 200,
});

/**
 * Strict rate limiter for forgot-password endpoint.
 * Production: max 5 per 15 min. Development: max 50 per 15 min (so local testing isn't blocked).
 * Limits by IP address.
 */
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 50 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
  message: {
    success: false,
    message: 'Too many password reset requests from this IP. Please wait 15 minutes before trying again.',
  },
  skipSuccessfulRequests: false,
});

/**
 * Rate limiter for reset-password endpoint.
 * Production: max 10 per 15 min. Development: max 50 per 15 min.
 * Prevents token brute-force guessing.
 */
export const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 50 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
  message: {
    success: false,
    message: 'Too many password reset attempts. Please wait 15 minutes before trying again.',
  },
});

