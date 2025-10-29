/**
 * Currency Conversion Utilities
 * Uses exchangerate-api.com for real-time USD to PHP conversion
 */

const EXCHANGE_RATE_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';
const FALLBACK_USD_TO_PHP_RATE = 56; // Fallback rate if API fails
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

// In-memory cache for exchange rate
let cachedRate: { rate: number; timestamp: number } | null = null;

/**
 * Fetch current USD to PHP exchange rate
 */
export async function getUSDtoPHPRate(): Promise<number> {
  try {
    // Check if we have a valid cached rate
    if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_DURATION) {
      console.log('[Currency] Using cached exchange rate:', cachedRate.rate);
      return cachedRate.rate;
    }

    // Fetch fresh rate from API
    console.log('[Currency] Fetching fresh exchange rate from API...');
    const response = await fetch(EXCHANGE_RATE_API_URL, {
      next: { revalidate: 3600 }, // Cache for 1 hour in Next.js
    });

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json();
    const phpRate = data.rates?.PHP;

    if (!phpRate || typeof phpRate !== 'number') {
      throw new Error('Invalid PHP rate in API response');
    }

    // Cache the rate
    cachedRate = {
      rate: phpRate,
      timestamp: Date.now(),
    };

    console.log('[Currency] Fresh exchange rate fetched:', phpRate);
    return phpRate;
  } catch (error) {
    console.error('[Currency] Error fetching exchange rate:', error);
    console.log('[Currency] Using fallback rate:', FALLBACK_USD_TO_PHP_RATE);
    
    // Return cached rate if available, otherwise use fallback
    if (cachedRate) {
      return cachedRate.rate;
    }
    
    return FALLBACK_USD_TO_PHP_RATE;
  }
}

/**
 * Convert USD amount to PHP using real-time exchange rate
 */
export async function convertUSDtoPHP(usdAmount: number): Promise<number> {
  const rate = await getUSDtoPHPRate();
  return usdAmount * rate;
}

/**
 * Convert PHP amount to USD using real-time exchange rate
 */
export async function convertPHPtoUSD(phpAmount: number): Promise<number> {
  const rate = await getUSDtoPHPRate();
  return phpAmount / rate;
}

/**
 * Get formatted exchange rate info
 */
export async function getExchangeRateInfo(): Promise<{
  rate: number;
  formatted: string;
  lastUpdated: Date | null;
}> {
  const rate = await getUSDtoPHPRate();
  return {
    rate,
    formatted: `1 USD = ${rate.toFixed(2)} PHP`,
    lastUpdated: cachedRate ? new Date(cachedRate.timestamp) : null,
  };
}
