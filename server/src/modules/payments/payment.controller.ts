import { Request, Response } from 'express';
import { paymentService } from './payment.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';

export class PaymentController {
  listPayments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await paymentService.listPayments(req.query as any);
    ApiResponse.paginated(res, result.data, result.meta, 'Payments retrieved successfully');
  });

  getPaymentById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const payment = await paymentService.getPaymentById(req.params.id as string);
    ApiResponse.success(res, payment, 'Payment retrieved successfully');
  });

  createPayment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const payment = await paymentService.createPayment(req.body);
    ApiResponse.created(res, payment, 'Payment recorded successfully');
  });

  updatePayment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const payment = await paymentService.updatePayment(req.params.id as string, req.body);
    ApiResponse.success(res, payment, 'Payment updated successfully');
  });

  deletePayment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await paymentService.deletePayment(req.params.id as string);
    ApiResponse.noContent(res);
  });
}

export const paymentController = new PaymentController();
