/**
 * PayMongo API Integration
 * 
 * This module handles PayMongo payment processing without webhooks.
 * Webhooks can be added later for automatic payment confirmations.
 */

import { convertUSDtoPHP } from './currency';

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY!;
const PAYMONGO_PUBLIC_KEY = process.env.PAYMONGO_PUBLIC_KEY!;
const PAYMONGO_API_URL = 'https://api.paymongo.com/v1';

// Base64 encode the secret key for authorization
const getAuthHeader = () => {
  const encoded = Buffer.from(PAYMONGO_SECRET_KEY).toString('base64');
  return `Basic ${encoded}`;
};

/**
 * Create a payment link for subscription billing
 */
export async function createPaymentLink(params: {
  amount: number; // Amount in centavos (e.g., 29900 for PHP 299.00)
  description: string;
  remarks?: string;
}) {
  try {
    const response = await fetch(`${PAYMONGO_API_URL}/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader(),
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: params.amount,
            description: params.description,
            remarks: params.remarks,
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0]?.detail || 'Failed to create payment link');
    }

    const data = await response.json();
    return {
      success: true,
      link: data.data.attributes.checkout_url,
      linkId: data.data.id,
      referenceNumber: data.data.attributes.reference_number,
    };
  } catch (error: any) {
    console.error('PayMongo createPaymentLink error:', error);
    return {
      success: false,
      error: error.message || 'Failed to create payment link',
    };
  }
}

/**
 * Retrieve payment link status
 */
export async function getPaymentLinkStatus(linkId: string) {
  try {
    const response = await fetch(`${PAYMONGO_API_URL}/links/${linkId}`, {
      method: 'GET',
      headers: {
        'Authorization': getAuthHeader(),
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0]?.detail || 'Failed to get payment link');
    }

    const data = await response.json();
    const attributes = data.data.attributes;

    return {
      success: true,
      status: attributes.status, // 'unpaid' or 'paid'
      payments: attributes.payments || [],
      referenceNumber: attributes.reference_number,
      checkoutUrl: attributes.checkout_url, // The actual payment link URL
    };
  } catch (error: any) {
    console.error('PayMongo getPaymentLinkStatus error:', error);
    return {
      success: false,
      error: error.message || 'Failed to get payment link status',
    };
  }
}

/**
 * Retrieve payment details
 */
export async function getPayment(paymentId: string) {
  try {
    const response = await fetch(`${PAYMONGO_API_URL}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': getAuthHeader(),
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.errors?.[0]?.detail || 'Failed to get payment');
    }

    const data = await response.json();
    const attributes = data.data.attributes;

    return {
      success: true,
      payment: {
        id: data.data.id,
        status: attributes.status, // 'paid', 'failed', 'pending'
        amount: attributes.amount,
        currency: attributes.currency,
        description: attributes.description,
        paymentMethod: attributes.source?.type, // 'gcash', 'grab_pay', 'card', etc.
        paidAt: attributes.paid_at,
        metadata: attributes.metadata,
      },
    };
  } catch (error: any) {
    console.error('PayMongo getPayment error:', error);
    return {
      success: false,
      error: error.message || 'Failed to get payment',
    };
  }
}

/**
 * Calculate subscription amount based on agent count
 * PayMongo only accepts PHP, so we convert USD to PHP using real-time exchange rates
 */
export async function calculateSubscriptionAmount(agentCount: number, pricePerAgent: number = 10.00): Promise<number> {
  const amountInUSD = agentCount * pricePerAgent;
  const amountInPHP = await convertUSDtoPHP(amountInUSD);
  // Convert to centavos (PayMongo uses centavos for PHP)
  return Math.round(amountInPHP * 100);
}

/**
 * Format amount from cents to USD
 */
export function formatAmount(cents: number): string {
  const usd = cents / 100;
  return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Get billing period string
 */
export function getBillingPeriod(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
