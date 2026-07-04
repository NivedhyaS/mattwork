import { Request, Response } from 'express';
import { editorService } from './editor.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export class EditorController {
  listEditors = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await editorService.listEditors(req.query as any);
    ApiResponse.paginated(res, result.data, result.meta, 'Editors retrieved successfully');
  });

  getEditorById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const editor = await editorService.getEditorById(req.params.id as string);
    ApiResponse.success(res, editor, 'Editor retrieved successfully');
  });

  getMyProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const editor = await editorService.getEditorByUserId(req.user!.id);
    ApiResponse.success(res, editor, 'Editor profile retrieved');
  });

  createEditor = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const editor = await editorService.createEditor(req.body);
    ApiResponse.created(res, editor, 'Editor created successfully');
  });

  updateEditor = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const editor = await editorService.updateEditor(req.params.id as string, req.body);
    ApiResponse.success(res, editor, 'Editor updated successfully');
  });

  deleteEditor = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await editorService.deleteEditor(req.params.id as string);
    ApiResponse.noContent(res);
  });

  getEarnings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const earnings = await editorService.getEditorEarnings(req.params.id as string, req.user!);
    ApiResponse.success(res, earnings, 'Editor earnings retrieved successfully');
  });
}

export const editorController = new EditorController();
