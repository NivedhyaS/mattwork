import { Response } from 'express';
import { ApiResponseShape } from '../types';

export class ApiResponse {
  static success<T>(
    res: Response,
    data: T,
    message = 'Success',
    statusCode = 200,
    meta?: Record<string, unknown>
  ): Response {
    const response: ApiResponseShape<T> = {
      success: true,
      message,
      data,
      ...(meta && { meta }),
    };
    return res.status(statusCode).json(response);
  }

  static created<T>(res: Response, data: T, message = 'Created successfully'): Response {
    return ApiResponse.success(res, data, message, 201);
  }

  static noContent(res: Response): Response {
    return res.status(204).send();
  }

  static error(
    res: Response,
    message: string,
    statusCode = 500,
    errors?: Record<string, string[]>
  ): Response {
    const response: ApiResponseShape = {
      success: false,
      message,
      ...(errors && { errors }),
    };
    return res.status(statusCode).json(response);
  }

  static paginated<T>(
    res: Response,
    data: T[],
    meta: {
      total: number;
      page: number;
      limit: number;
    },
    message = 'Success'
  ): Response {
    const totalPages = Math.ceil(meta.total / meta.limit);
    return ApiResponse.success(
      res,
      data,
      message,
      200,
      {
        total: meta.total,
        page: meta.page,
        limit: meta.limit,
        totalPages,
        hasNextPage: meta.page < totalPages,
        hasPrevPage: meta.page > 1,
      }
    );
  }
}
