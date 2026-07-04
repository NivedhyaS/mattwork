import { Request, Response } from 'express';
import { projectService } from './project.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export class ProjectController {
  listProjects = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await projectService.listProjects(req.query as any, req.user!);
    ApiResponse.paginated(res, result.data, result.meta, 'Projects retrieved successfully');
  });

  getProjectById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const project = await projectService.getProjectById(req.params.id as string, req.user!);
    ApiResponse.success(res, project, 'Project retrieved successfully');
  });

  createProject = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const project = await projectService.createProject(req.body);
    ApiResponse.created(res, project, 'Project created successfully');
  });

  updateProject = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const project = await projectService.updateProject(req.params.id as string, req.body);
    ApiResponse.success(res, project, 'Project updated successfully');
  });

  updateStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const project = await projectService.updateProjectStatus(req.params.id as string, req.body);
    ApiResponse.success(res, project, 'Project status updated successfully');
  });

  deleteProject = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await projectService.deleteProject(req.params.id as string);
    ApiResponse.noContent(res);
  });
}

export const projectController = new ProjectController();
