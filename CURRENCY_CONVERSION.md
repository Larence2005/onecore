# Real-Time Currency Conversion System

## Overview
The subscription system displays prices in **USD** but processes payments in **PHP** through PayMongo using real-time exchange rates.

## How It Works

### 1. **Currency Conversion (`src/lib/currency.ts`)**
- Uses **exchangerate-api.com** for real-time USD to PHP conversion
- Free API with no authentication required
- Caches exchange rate for 1 hour to reduce API calls
- Falls back to 1 USD = 56 PHP if API fails

### 2. **Payment Processing (`src/lib/paymongo.ts`)**
- `calculateSubscriptionAmount()` converts USD to PHP automatically
- Uses real-time exchange rate from currency API
- Converts to PHP centavos for PayMongo (e.g., ₱560 = 56,000 centavos)

### 3. **Display (`src/components/subscription-view.tsx`)**
- Shows prices in USD to users ($10 per agent)
- Displays current exchange rate in subscription overview
- Users see: "$10.00 per agent"
- PayMongo receives: PHP equivalent (e.g., ₱560)

## Example Flow

### User has 2 agents:
1. **Display:** $20.00 USD (2 agents × $10)
2. **API Fetch:** Current rate = 1 USD = 57.25 PHP
3. **Conversion:** $20 × 57.25 = ₱1,145 PHP
4. **PayMongo:** 114,500 centavos sent to payment gateway
5. **User Pays:** ₱1,145 via GCash/Card/etc.

## API Details

### Exchange Rate API
- **Endpoint:** `https://api.exchangerate-api.com/v4/latest/USD`
- **Rate Limit:** Free tier (no key required)
- **Update Frequency:** Real-time, cached for 1 hour
- **Fallback:** 1 USD = 56 PHP

### Response Format
```json
{
  "base": "USD",
  "date": "2025-10-28",
  "rates": {
    "PHP": 57.25,
    ...
  }
}
```

## Caching Strategy
- **Duration:** 1 hour (3600 seconds)
- **Storage:** In-memory cache
- **Refresh:** Automatic after cache expires
- **Fallback:** Uses last cached rate if API fails

## Benefits
1. ✅ **Accurate Pricing:** Always uses current exchange rates
2. ✅ **User-Friendly:** Displays familiar USD pricing
3. ✅ **PayMongo Compatible:** Converts to required PHP format
4. ✅ **Reliable:** Fallback rate if API is unavailable
5. ✅ **Efficient:** Caches rate to minimize API calls

## Configuration

### Change Fallback Rate
Edit `src/lib/currency.ts`:
```typescript
const FALLBACK_USD_TO_PHP_RATE = 56; // Change this value
```

### Change Cache Duration
Edit `src/lib/currency.ts`:
```typescript
const CACHE_DURATION = 3600000; // 1 hour in milliseconds
```

### Use Different API
Replace the API URL in `src/lib/currency.ts`:
```typescript
const EXCHANGE_RATE_API_URL = 'your-api-url-here';
```

## Alternative APIs

If you need a different provider:

1. **ExchangeRate-API** (current) - Free, no key
2. **Fixer.io** - Free tier available, requires API key
3. **CurrencyAPI** - Free tier, requires API key
4. **Open Exchange Rates** - Free tier, requires API key

## Monitoring

Check exchange rate in:
- Subscription page (displays current rate)
- Server logs: `[Currency] Fresh exchange rate fetched: XX.XX`
- Fallback logs: `[Currency] Using fallback rate: 56`

## Testing

To test the conversion:
```typescript
import { getUSDtoPHPRate, convertUSDtoPHP } from '@/lib/currency';

// Get current rate
const rate = await getUSDtoPHPRate();
console.log(`1 USD = ${rate} PHP`);

// Convert amount
const phpAmount = await convertUSDtoPHP(10); // $10 USD
console.log(`$10 = ₱${phpAmount}`);
```
