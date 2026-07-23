import { Request, Response } from 'express';
import { formsService } from './forms.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export class FormsController {
  /**
   * Route 1: POST /api/v1/forms/connect
   * Takes a form URL, extracts the ID, calls forms.get, returns form title + questions list. Saves nothing yet.
   */
  connectForm = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await formsService.connectForm(req.body);
    ApiResponse.success(res, result, 'Form structure retrieved successfully');
  });

  /**
   * Route 2: POST /api/v1/forms/mapping (and /api/v1/forms/:connectedFormId/mapping)
   * Validates required mappings & type compatibility, saves ConnectedForm + Mappings, and creates Google Forms Watch.
   */
  saveMapping = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await formsService.saveFormMapping(req.user!.id, req.body);
    ApiResponse.created(res, result, 'Form mapping saved and watch created successfully');
  });

  /**
   * GET /api/v1/forms
   * List all connected forms for admin visibility.
   */
  listForms = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const forms = await formsService.listForms();
    ApiResponse.success(res, forms, 'Connected forms retrieved successfully');
  });

  /**
   * POST /api/v1/forms/:id/renew-watch
   * Manually renews watch for a connected form (Admin only).
   */
  renewWatch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await formsService.renewWatch(req.params.id as string);
    ApiResponse.success(res, result, 'Watch renewed successfully');
  });

  /**
   * POST /api/v1/forms/:id/sync
   * Manually synchronizes new form responses for a connected form (Admin only).
   */
  syncForm = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const summary = await formsService.processFormResponses(req.params.id as string);
    ApiResponse.success(res, summary, 'Form responses synchronized successfully');
  });
}

export const formsController = new FormsController();
