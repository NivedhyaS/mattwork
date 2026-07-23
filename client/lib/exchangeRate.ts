'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ExchangeRateData {
  usdToInr: number;
  fetchedAt: string;
  isFallback: boolean;
}

/**
 * Hook to fetch the live USD->INR exchange rate.
 * Cached by React Query for 1 hour matching the server-side cache TTL.
 * Returns null while loading or on error.
 */
export function useExchangeRate(enabled = true) {
  const { data, isLoading } = useQuery<ExchangeRateData>({
    queryKey: ['exchange-rate'],
    queryFn: async () => {
      const res = await api.get('/exchange-rate');
      return res.data.data as ExchangeRateData;
    },
    staleTime: 60 * 60 * 1000,   // 1 hour
    refetchOnWindowFocus: false,
    retry: 1,
    enabled,
  });

  return { rate: data ?? null, isLoading };
}

/**
 * Formats a relative time label for when the exchange rate was last fetched.
 * e.g. "fetched 12 min ago", "fetched just now"
 */
export function formatFetchedAgo(fetchedAt: string): string {
  const diff = Math.floor((Date.now() - new Date(fetchedAt).getTime()) / 1000);
  if (diff < 60) return 'fetched just now';
  if (diff < 3600) return `fetched ${Math.floor(diff / 60)} min ago`;
  return `fetched ${Math.floor(diff / 3600)}h ago`;
}

/**
 * Builds the full three-part profit display string:
 *   $X (client, USD) / ₹Y (editor, INR)
 *   ~ $Z margin (at 1 USD = ₹RR.RR, fetched N min ago)
 */
export function buildProfitDisplay(
  clientPrice: number | string | null,
  editorPrice: number | string | null,
  rate: ExchangeRateData | null
): { line1: string; line2: string | null } {
  const cp = clientPrice != null ? Number(clientPrice) : null;
  const ep = editorPrice != null ? Number(editorPrice) : null;

  if (cp == null && ep == null) {
    return { line1: 'N/A', line2: null };
  }

  const usdStr = cp != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cp)
    : '—';
  const inrStr = ep != null
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(ep)
    : '—';

  const line1 = `${usdStr} (USD) / ${inrStr} (INR)`;

  if (cp == null || ep == null || rate == null) {
    return { line1, line2: null };
  }

  const editorInUsd = ep / rate.usdToInr;
  const marginUsd = cp - editorInUsd;
  const marginStr = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(marginUsd);
  const rateStr = rate.usdToInr.toFixed(2);
  const fetchedStr = formatFetchedAgo(rate.fetchedAt);

  const line2 = `≈ ${marginStr} margin (at 1 USD = \u20b9${rateStr}, ${fetchedStr})`;

  return { line1, line2 };
}
