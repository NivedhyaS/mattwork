/**
 * Currency configuration for the Mattwork platform.
 *
 * APP_CURRENCY is the platform-wide default used for admin dashboards,
 * reports, and any context where a per-client currency is not available.
 *
 * Client-specific currency is stored in Client.currency and should always
 * take precedence over APP_CURRENCY when displaying amounts to or about
 * a specific client.
 */
export const APP_CURRENCY = 'USD';

/**
 * Returns a human-readable symbol for a given ISO 4217 currency code.
 * Falls back to the APP_CURRENCY symbol if the code is unrecognized.
 */
export function getCurrencySymbol(code: string = APP_CURRENCY): string {
  switch ((code || APP_CURRENCY).toUpperCase()) {
    case 'USD': return '$';
    case 'GBP': return '£';
    case 'EUR': return '€';
    case 'INR': return '₹';
    default: return '$';
  }
}
