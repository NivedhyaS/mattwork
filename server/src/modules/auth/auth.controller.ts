import { Request, Response } from 'express';
import { authService } from './auth.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export class AuthController {
  register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await authService.register(req.body);
    ApiResponse.created(res, result, 'Account created successfully');
  });

  login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await authService.login(req.body);
    ApiResponse.success(res, result, 'Login successful');
  });

  logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await authService.logout(req.user!.id);
    ApiResponse.success(res, null, 'Logged out successfully');
  });

  refresh = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tokens = await authService.refreshTokens(req.body.refreshToken);
    ApiResponse.success(res, tokens, 'Tokens refreshed successfully');
  });

  me = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = await authService.getMe(req.user!.id);
    ApiResponse.success(res, user, 'Profile retrieved successfully');
  });
}

export const authController = new AuthController();
