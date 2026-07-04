import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { logger } from '../config/logger';
import { env } from '../config/env';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let errors: Record<string, string[]> | undefined;

  // Known operational error
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;

    if (env.NODE_ENV === 'development') {
      logger.warn(`[ApiError] ${req.method} ${req.path} → ${statusCode}: ${message}`);
    }
  }
  // Zod validation error
  else if (err instanceof ZodError) {
    statusCode = 422;
    message = 'Validation failed';
    errors = {};
    for (const issue of err.errors) {
      const field = issue.path.join('.') || 'general';
      if (!errors[field]) errors[field] = [];
      errors[field].push(issue.message);
    }
    logger.warn(`[ValidationError] ${req.method} ${req.path} → ${JSON.stringify(errors)}`);
  }
  // Prisma known request errors
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      const target = (err.meta?.target as string[])?.join(', ');
      message = `A record with this ${target} already exists`;
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'Record not found';
    } else if (err.code === 'P2003') {
      statusCode = 400;
      message = 'Related record not found';
    } else {
      logger.error(`[PrismaError] Code: ${err.code}`, err);
    }
  }
  // Unexpected errors
  else {
    logger.error(`[UnhandledError] ${req.method} ${req.path}`, {
      message: err.message,
      stack: err.stack,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
};
