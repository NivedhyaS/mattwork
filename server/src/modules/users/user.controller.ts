import { Request, Response } from 'express';
import { userService } from './user.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export class UserController {
  listUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await userService.listUsers(req.query as any);
    ApiResponse.paginated(res, result.data, result.meta, 'Users retrieved successfully');
  });

  getUserById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = await userService.getUserById(req.params.id as string);
    ApiResponse.success(res, user, 'User retrieved successfully');
  });

  updateUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = await userService.updateUser(req.params.id as string, req.body);
    ApiResponse.success(res, user, 'User updated successfully');
  });

  deleteUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await userService.deleteUser(req.params.id as string, req.user!.id);
    ApiResponse.noContent(res);
  });

  changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await userService.changePassword(req.user!.id, req.body);
    ApiResponse.success(res, null, 'Password changed successfully');
  });

  toggleStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = await userService.toggleUserStatus(req.params.id as string);
    ApiResponse.success(res, user, `User ${user.isActive ? 'activated' : 'deactivated'} successfully`);
  });

  adminPasswordReset = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await userService.adminPasswordReset(req.params.id as string, req.body);
    ApiResponse.success(res, null, 'User password forcefully reset successfully');
  });
}

export const userController = new UserController();
