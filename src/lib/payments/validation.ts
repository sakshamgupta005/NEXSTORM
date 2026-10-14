export const SUPPORTED_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'SGD', 'CHF', 'NZD',
]);

// Currencies with zero decimal places (e.g. Japanese Yen)
export const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'CLP']);

/**
 * Validates integer amount in minor currency units (cents / paise).
 */
export function validatePaymentAmount(amount: number): { valid: boolean; error?: string } {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return { valid: false, error: 'Payment amount must be a finite number' };
  }

  if (!Number.isInteger(amount)) {
    return { valid: false, error: 'Payment amount must be an integer in minor units (e.g., cents or paise)' };
  }

  if (amount <= 0) {
    return { valid: false, error: 'Payment amount must be greater than zero' };
  }

  // Prevent unrealistic overflow amounts (max 100,000,000 minor units = $1,000,000)
  if (amount > 100_000_000) {
    return { valid: false, error: 'Payment amount exceeds maximum transaction limit' };
  }

  return { valid: true };
}

/**
 * Validates and normalizes 3-letter ISO-4217 currency code.
 */
export function validateCurrency(currency: string): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  if (!currency || typeof currency !== 'string') {
    return { valid: false, error: 'Currency is required' };
  }

  const clean = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(clean)) {
    return { valid: false, error: `Invalid currency format "${currency}". Expected 3-letter ISO code.` };
  }

  if (!SUPPORTED_CURRENCIES.has(clean)) {
    return { valid: false, error: `Unsupported currency code "${clean}".` };
  }

  return { valid: true, normalized: clean };
}

/**
 * Validates application-owned reference identifier (orderId, invoiceId, etc.).
 */
export function validateReferenceId(referenceId: string): {
  valid: boolean;
  sanitized?: string;
  error?: string;
} {
  if (!referenceId || typeof referenceId !== 'string') {
    return { valid: false, error: 'Reference ID is required' };
  }

  const clean = referenceId.trim();
  if (clean.length < 3 || clean.length > 64) {
    return { valid: false, error: 'Reference ID must be between 3 and 64 characters' };
  }

  // Allow alphanumeric, underscores, hyphens, and colons
  if (!/^[a-zA-Z0-9_\-:]+$/.test(clean)) {
    return { valid: false, error: 'Reference ID contains invalid characters. Use alphanumeric, -, _, or :' };
  }

  return { valid: true, sanitized: clean };
}

/**
 * Formats minor units (cents/paise) into human-readable monetary string.
 */
export function formatCurrencyAmount(amountMinor: number, currency: string): string {
  const normCurrency = currency.toUpperCase();
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(normCurrency);

  const value = isZeroDecimal ? amountMinor : amountMinor / 100;

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normCurrency,
      minimumFractionDigits: isZeroDecimal ? 0 : 2,
    }).format(value);
  } catch {
    return `${normCurrency} ${value.toFixed(isZeroDecimal ? 0 : 2)}`;
  }
}
