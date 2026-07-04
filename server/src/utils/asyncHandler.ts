import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler and forwards any errors to Express's next()
 * Eliminates the need for try/catch boilerplate in every controller
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
