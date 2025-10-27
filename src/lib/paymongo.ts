import axios, { AxiosInstance } from 'axios';

const PAYMONGO_API_URL = 'https://api.paymongo.com/v1';

export class PayMongoClient {
  private client: AxiosInstance;
  private secretKey: string;

  constructor() {
    this.secretKey = process.env.PAYMONGO_SECRET_KEY || '';
    
    if (!this.secretKey) {
      throw new Error('PAYMONGO_SECRET_KEY is not configured');
    }

    this.client = axios.create({
      baseURL: PAYMONGO_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(this.secretKey).toString('base64')}`,
      },
    });
  }

  // Create a Payment Intent
  async createPaymentIntent(params: {
    amount: number; // in cents (e.g., 1000 = $10.00)
    currency?: string;
    description?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      const response = await this.client.post('/payment_intents', {
        data: {
          attributes: {
            amount: params.amount,
            currency: params.currency || 'USD',
            description: params.description,
            payment_method_allowed: ['card', 'gcash', 'grab_pay', 'paymaya'],
            metadata: params.metadata,
          },
        },
      });

      return response.data.data;
    } catch (error: any) {
      console.error('PayMongo createPaymentIntent error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to create payment intent');
    }
  }

  // Attach Payment Method to Payment Intent
  async attachPaymentMethod(paymentIntentId: string, paymentMethodId: string) {
    try {
      const response = await this.client.post(
        `/payment_intents/${paymentIntentId}/attach`,
        {
          data: {
            attributes: {
              payment_method: paymentMethodId,
            },
          },
        }
      );

      return response.data.data;
    } catch (error: any) {
      console.error('PayMongo attachPaymentMethod error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to attach payment method');
    }
  }

  // Retrieve Payment Intent
  async getPaymentIntent(paymentIntentId: string) {
    try {
      const response = await this.client.get(`/payment_intents/${paymentIntentId}`);
      return response.data.data;
    } catch (error: any) {
      console.error('PayMongo getPaymentIntent error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to retrieve payment intent');
    }
  }

  // Create Payment Method (for card payments)
  async createPaymentMethod(params: {
    type: 'card';
    details: {
      card_number: string;
      exp_month: number;
      exp_year: number;
      cvc: string;
    };
    billing?: {
      name: string;
      email: string;
      phone?: string;
    };
  }) {
    try {
      const response = await this.client.post('/payment_methods', {
        data: {
          attributes: {
            type: params.type,
            details: params.details,
            billing: params.billing,
          },
        },
      });

      return response.data.data;
    } catch (error: any) {
      console.error('PayMongo createPaymentMethod error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to create payment method');
    }
  }

  // Create a Checkout Session (for hosted checkout page)
  async createCheckoutSession(params: {
    amount: number;
    currency?: string;
    description: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, any>;
  }) {
    try {
      const response = await this.client.post('/checkout_sessions', {
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            line_items: [
              {
                currency: params.currency || 'USD',
                amount: params.amount,
                description: params.description,
                name: params.description,
                quantity: 1,
              },
            ],
            payment_method_types: ['card', 'gcash', 'grab_pay', 'paymaya'],
            success_url: params.successUrl,
            cancel_url: params.cancelUrl,
            metadata: params.metadata,
          },
        },
      });

      return response.data.data;
    } catch (error: any) {
      console.error('PayMongo createCheckoutSession error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to create checkout session');
    }
  }

  // Retrieve Checkout Session
  async getCheckoutSession(checkoutSessionId: string) {
    try {
      const response = await this.client.get(`/checkout_sessions/${checkoutSessionId}`);
      return response.data.data;
    } catch (error: any) {
      console.error('PayMongo getCheckoutSession error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to retrieve checkout session');
    }
  }

  // Create Webhook
  async createWebhook(params: {
    url: string;
    events: string[];
  }) {
    try {
      const response = await this.client.post('/webhooks', {
        data: {
          attributes: {
            url: params.url,
            events: params.events,
          },
        },
      });

      return response.data.data;
    } catch (error: any) {
      console.error('PayMongo createWebhook error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to create webhook');
    }
  }

  // List Webhooks
  async listWebhooks() {
    try {
      const response = await this.client.get('/webhooks');
      return response.data.data;
    } catch (error: any) {
      console.error('PayMongo listWebhooks error:', error.response?.data || error.message);
      throw new Error('Failed to list webhooks');
    }
  }

  // Verify Webhook Signature
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const crypto = require('crypto');
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET || '';
    
    if (!webhookSecret) {
      console.error('PAYMONGO_WEBHOOK_SECRET is not configured');
      return false;
    }

    const computedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    return computedSignature === signature;
  }
}

// Helper function to calculate subscription amount
export function calculateSubscriptionAmount(memberCount: number, pricePerMember: number = 10): number {
  // Returns amount in cents
  return memberCount * pricePerMember * 100;
}

// Helper function to format amount for display
export function formatAmount(amountInCents: number, currency: string = 'USD'): string {
  const amount = amountInCents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export const paymongoClient = new PayMongoClient();
