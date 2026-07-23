/**
 * exchangeRate.service.ts
 *
 * Fetches the live USD to INR exchange rate from open.er-api.com.
 * - 1-hour in-memory cache (no DB persistence, no schema changes).
 * - Falls back to FALLBACK_RATE if the external API is unavailable.
 */

const FALLBACK_RATE = 83.5;
const CACHE_TTL_MS = 60 * 60 * 1000;

interface RateCache {
  rate: number;
  fetchedAt: Date;
}

let cache: RateCache | null = null;

export async function getUsdToInrRate(force = false): Promise<{ rate: number; fetchedAt: Date; isFallback: boolean }> {
  const now = new Date();

  if (!force && cache && now.getTime() - cache.fetchedAt.getTime() < CACHE_TTL_MS) {
    return { rate: cache.rate, fetchedAt: cache.fetchedAt, isFallback: false };
  }

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Exchange rate API returned ${response.status}`);
    }

    const data = await response.json() as { result: string; rates: Record<string, number> };

    if (data.result !== 'success' || !data.rates?.INR) {
      throw new Error('Unexpected exchange rate API response shape');
    }

    const rate = data.rates.INR;
    cache = { rate, fetchedAt: now };

    return { rate, fetchedAt: now, isFallback: false };
  } catch (err) {
    console.warn('[ExchangeRate] Failed to fetch live rate, using fallback:', err);

    if (cache) {
      return { rate: cache.rate, fetchedAt: cache.fetchedAt, isFallback: true };
    }

    return { rate: FALLBACK_RATE, fetchedAt: now, isFallback: true };
  }
}
