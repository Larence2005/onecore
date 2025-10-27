# PayMongo Integration Setup

## Overview
This application uses PayMongo for subscription billing. Organization owners pay $10 per agent per month.

## Environment Variables

Add these to your `.env` file:

```bash
# PayMongo Configuration
PAYMONGO_SECRET_KEY=sk_test_your_secret_key_here
PAYMONGO_PUBLIC_KEY=pk_test_your_public_key_here
PAYMONGO_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## Getting PayMongo Keys

1. Sign up at https://dashboard.paymongo.com/
2. Go to **Developers** > **API Keys**
3. Copy your **Secret Key** and **Public Key**
4. Use test keys (starting with `sk_test_` and `pk_test_`) for development

## Database Migration

Run the following commands to update your database schema:

```bash
# Generate Prisma Client with new models
npm run prisma:generate

# Push schema changes to database
npm run prisma:push
```

## Webhook Setup

1. Go to PayMongo Dashboard > **Developers** > **Webhooks**
2. Create a new webhook with URL: `https://yourdomain.com/api/webhooks/paymongo`
3. Subscribe to these events:
   - `payment.paid`
   - `payment.failed`
   - `checkout_session.payment.paid`
4. Copy the webhook signing secret and add it to your `.env` as `PAYMONGO_WEBHOOK_SECRET`

## Testing

For local development, use ngrok or similar to expose your localhost:

```bash
ngrok http 9002
```

Then use the ngrok URL for your webhook endpoint.

## Payment Flow

### When Adding a New Member:

1. Admin navigates to add member page
2. System calculates: `current_agents * $10/month`
3. Creates PayMongo checkout session
4. Redirects admin to PayMongo hosted checkout page
5. Admin completes payment
6. Webhook updates subscription status
7. Member is added to organization

### Subscription Status:

- **TRIAL**: Free trial period (if applicable)
- **ACTIVE**: Payment successful, subscription active
- **PAST_DUE**: Payment failed, needs attention
- **CANCELED**: Subscription canceled
- **INCOMPLETE**: Checkout created but not completed

## API Endpoints

### Create Checkout Session
```
POST /api/subscription/create-checkout
Body: { organizationId, memberCount }
```

### Get Subscription Status
```
GET /api/subscription/status?organizationId=xxx
```

### Webhook Handler
```
POST /api/webhooks/paymongo
```

## Pricing

- **Base**: $10 per agent per month
- **Billing**: Monthly recurring
- **Calculation**: `number_of_agents × $10`

Example:
- 1 agent = $10/month
- 5 agents = $50/month
- 10 agents = $100/month

## Security Notes

- Never expose secret keys in client-side code
- Always verify webhook signatures
- Use HTTPS in production
- Store sensitive data encrypted
