import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ApiError } from '../utils/ApiError';

type ValidateTarget = 'body' | 'query' | 'params';

/**
 * Zod request validation middleware factory
 * Usage: validate(MySchema) — validates req.body by default
 * Usage: validate(MySchema, 'query') — validates req.query
 */
export const validate = (schema: ZodSchema, target: ValidateTarget = 'body') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of result.error.errors) {
        const field = issue.path.join('.') || 'general';
        if (!errors[field]) errors[field] = [];
        errors[field].push(issue.message);
      }
      throw ApiError.unprocessable('Validation failed', errors);
    }

    // Write coerced values back to the request.
    // req.query and req.params are getter-only properties on some router
    // versions (the `router` package used here), so we must use Object.assign
    // to mutate the existing object rather than replacing the reference.
    if (target === 'body') {
      req.body = result.data;
    } else {
      Object.assign(req[target], result.data);
    }
    next();
  };
};
