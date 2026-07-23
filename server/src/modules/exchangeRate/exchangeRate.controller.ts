import { Request, Response } from 'express';
import { getUsdToInrRate } from '../../services/exchangeRate.service';

export async function getExchangeRate(req: Request, res: Response): Promise<void> {
  const force = req.query.force === 'true';
  const { rate, fetchedAt, isFallback } = await getUsdToInrRate(force);
  res.json({
    success: true,
    data: {
      usdToInr: rate,
      fetchedAt: fetchedAt.toISOString(),
      isFallback,
    },
  });
}
