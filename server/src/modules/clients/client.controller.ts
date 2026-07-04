import { Request, Response } from 'express';
import { clientService } from './client.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export class ClientController {
  listClients = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await clientService.listClients(req.query as any);
    ApiResponse.paginated(res, result.data, result.meta, 'Clients retrieved successfully');
  });

  getClientById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const client = await clientService.getClientById(req.params.id as string);
    ApiResponse.success(res, client, 'Client retrieved successfully');
  });

  getMyProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const client = await clientService.getClientByUserId(req.user!.id);
    ApiResponse.success(res, client, 'Client profile retrieved');
  });

  createClient = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const client = await clientService.createClient(req.body);
    ApiResponse.created(res, client, 'Client created successfully');
  });

  updateClient = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const client = await clientService.updateClient(req.params.id as string, req.body);
    ApiResponse.success(res, client, 'Client updated successfully');
  });

  deleteClient = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await clientService.deleteClient(req.params.id as string);
    ApiResponse.noContent(res);
  });

  getBalance = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const balance = await clientService.getClientBalance(req.params.id as string, req.user!);
    ApiResponse.success(res, balance, 'Client balance retrieved successfully');
  });
}

export const clientController = new ClientController();
