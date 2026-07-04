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
