import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { extractTokenFromHeader, verifyAccessToken } from '../utils/jwt.utils';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import prisma from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Verifies JWT access token and attaches user to request
 */
export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = extractTokenFromHeader(req.headers.authorization);
    const payload = verifyAccessToken(token);

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User not found or account deactivated');
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    next();
  }
);

/**
 * Role-based access control guard
 * Usage: authorize(Role.ADMIN, Role.EDITOR)
 */
export const authorize = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      ApiResponse.error(res, 'Unauthorized', 401);
      return;
    }

    if (!roles.includes(req.user.role)) {
      ApiResponse.error(
        res,
        `Access denied. Required role(s): ${roles.join(', ')}`,
        403
      );
      return;
    }

    next();
  };
};

/**
 * Allow only the resource owner or admins
 */
export const authorizeOwnerOrAdmin = (getUserId: (req: Request) => string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      ApiResponse.error(res, 'Unauthorized', 401);
      return;
    }

    const resourceUserId = getUserId(req);
    const isOwner = req.user.id === resourceUserId;
    const isAdmin = req.user.role === Role.ADMIN;

    if (!isOwner && !isAdmin) {
      ApiResponse.error(res, 'Access denied', 403);
      return;
    }

    next();
  };
};
