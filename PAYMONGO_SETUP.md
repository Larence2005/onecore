# PayMongo Subscription Setup Guide

## Overview

This system implements monthly subscription billing based on the number of agents (OrganizationMembers) in your organization.

**Pricing:** ₱500 per agent per month

## Features Implemented

✅ **Subscription Management**
- Automatic subscription creation on signup
- 14-day free trial
- Monthly billing cycle
- Agent-based pricing

✅ **Payment Processing**
- PayMongo payment links
- Manual payment verification (no webhooks yet)
- Payment history tracking
- Multiple payment methods (GCash, Cards, etc.)

✅ **UI Components**
- Subscription overview dashboard
- Payment history table
- Real-time status checking
- Trial period alerts

## Setup Instructions

### 1. Add PayMongo API Keys

Add these to your `.env` file:

```env
# PayMongo API Keys
PAYMONGO_PUBLIC_KEY=pk_test_your_public_key_here
PAYMONGO_SECRET_KEY=sk_test_your_secret_key_here
```

**Where to get your keys:**
1. Go to https://dashboard.paymongo.com/
2. Login to your account
3. Navigate to **Developers** → **API Keys**
4. Copy your **Public Key** and **Secret Key**

**Note:** Use test keys (`pk_test_...` and `sk_test_...`) for development.

### 2. Update Database Schema

Run these commands to create the subscription tables:

```bash
# Generate Prisma client with new models
npm run prisma:generate

# Push schema changes to database
npm run prisma:push
```

This will create:
- `Subscription` table
- `Payment` table
- Related enums (`SubscriptionStatus`, `BillingCycle`, `PaymentStatus`)

### 3. Verify Installation

1. Start your development server:
```bash
npm run dev
```

2. Login to your application
3. Go to **Settings** → **Subscription & Billing** tab
4. You should see your subscription overview

## How It Works

### Subscription Lifecycle

```
1. Organization Created
   ↓
2. Subscription Auto-Created (TRIAL status)
   ↓
3. 14-Day Free Trial Period
   ↓
4. Trial Ends → Admin must pay
   ↓
5. Payment Link Generated
   ↓
6. User Pays via PayMongo
   ↓
7. Admin checks payment status
   ↓
8. Subscription Activated (ACTIVE status)
   ↓
9. Monthly Billing Continues
```

### Agent-Based Billing

**How agents are counted:**
- Only `OrganizationMember` records where `isClient = false`
- Excludes clients (customers)
- Updates automatically when agents are added/removed

**Example:**
- 3 agents = ₱1,500/month (3 × ₱500)
- 5 agents = ₱2,500/month (5 × ₱500)
- 10 agents = ₱5,000/month (10 × ₱500)

### Payment Flow (Without Webhooks)

```
1. Admin clicks "Pay Now"
   ↓
2. System creates PayMongo payment link
   ↓
3. Payment page opens in iframe modal
   ↓
4. User completes payment (GCash, Card, etc.)
   ↓
5. User closes modal
   ↓
6. System automatically checks payment status
   ↓
7. If paid → Subscription activated
```

**Features:**
- ✅ Embedded payment (iframe modal)
- ✅ User stays in your app
- ✅ Auto-check status on modal close
- ✅ Manual "Check Status" button for pending payments

**Note:** Without webhooks, payment confirmation happens when user closes the modal or clicks "Check Status".

## Database Models

### Subscription Model

```prisma
model Subscription {
  id                String   @id @default(cuid())
  organizationId    String   @unique
  status            SubscriptionStatus @default(TRIAL)
  agentCount        Int      @default(1)
  pricePerAgent     Float    @default(500.00) // ₱500 per agent per month
  totalAmount       Float
  billingCycle      BillingCycle @default(MONTHLY)
  currentPeriodStart DateTime @default(now())
  currentPeriodEnd   DateTime
  trialEndsAt       DateTime?
  canceledAt        DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

**Statuses:**
- `TRIAL` - Free trial period (14 days)
- `ACTIVE` - Paid and active
- `PAST_DUE` - Payment failed/overdue
- `CANCELED` - Subscription canceled
- `EXPIRED` - Trial expired, no payment

### Payment Model

```prisma
model Payment {
  id                String   @id @default(cuid())
  organizationId    String
  paymongoPaymentId String?  @unique
  paymongoLinkId    String?
  amount            Float
  currency          String   @default("PHP")
  status            PaymentStatus @default(PENDING)
  paymentMethod     String?
  description       String?
  billingPeriod     String?
  agentCount        Int?
  paidAt            DateTime?
  failedAt          DateTime?
  metadata          Json?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

**Statuses:**
- `PENDING` - Payment link created, awaiting payment
- `PAID` - Payment successful
- `FAILED` - Payment failed
- `REFUNDED` - Payment refunded

## API Functions

### Server Actions (`/src/app/actions-subscription.ts`)

```typescript
// Get or create subscription
getOrCreateSubscription(organizationId: string)

// Update agent count
updateSubscriptionAgentCount(organizationId: string)

// Create payment link
createSubscriptionPayment(organizationId: string)

// Check payment status (manual verification)
checkPaymentStatus(paymentId: string)

// Get payment history
getOrganizationPayments(organizationId: string)

// Cancel subscription
cancelSubscription(organizationId: string)
```

### PayMongo Integration (`/src/lib/paymongo.ts`)

```typescript
// Create payment link
createPaymentLink(params: { amount, description, remarks })

// Get payment link status
getPaymentLinkStatus(linkId: string)

// Get payment details
getPayment(paymentId: string)

// Calculate subscription amount
calculateSubscriptionAmount(agentCount: number, pricePerAgent: number)
```

## UI Components

### Settings Page (`/src/components/settings-page.tsx`)
- Tabs for General Settings and Subscription
- Navigation between settings sections

### Subscription View (`/src/components/subscription-view.tsx`)
- Subscription overview card
- Agent count and pricing display
- Payment history table
- "Pay Now" button
- "Check Status" button for pending payments
- Cancel subscription dialog

## Usage

### For Admins

**View Subscription:**
1. Go to **Settings** → **Subscription & Billing**
2. See current status, agent count, and monthly cost

**Make Payment:**
1. Click **"Pay Now"** button
2. Complete payment on PayMongo page
3. Return to app
4. Click **"Check Status"** to verify payment

**View Payment History:**
- Scroll down to see all past payments
- Check payment status and dates

**Cancel Subscription:**
1. Click **"Cancel Subscription"**
2. Confirm cancellation
3. Access continues until end of billing period

### For Developers

**Test Payment Flow:**
1. Use test API keys (`pk_test_...`, `sk_test_...`)
2. Use PayMongo test cards:
   - Success: `4343434343434345`
   - Decline: `4571736000000075`

**Monitor Payments:**
- Check PayMongo dashboard for payment logs
- Review database `Payment` table for records

## Adding Webhooks Later

When you're ready to add webhooks for automatic payment confirmation:

### 1. Create Webhook Endpoint

```typescript
// /src/app/api/webhooks/paymongo/route.ts
export async function POST(req: Request) {
  const payload = await req.json();
  
  // Verify webhook signature
  // Process payment.paid event
  // Update subscription status
  
  return new Response('OK', { status: 200 });
}
```

### 2. Register Webhook in PayMongo

1. Go to PayMongo Dashboard → Webhooks
2. Add webhook URL: `https://yourdomain.com/api/webhooks/paymongo`
3. Select events: `payment.paid`, `payment.failed`

### 3. Update Code

Remove manual "Check Status" button and rely on webhooks for automatic updates.

## Troubleshooting

### Payment Link Not Opening
- Check if `PAYMONGO_SECRET_KEY` is set correctly
- Verify API key has correct permissions
- Check browser console for errors

### Payment Status Not Updating
- Click "Check Status" button manually
- Verify PayMongo payment was completed
- Check payment ID in database matches PayMongo

### Subscription Not Created
- Check if organization exists
- Verify Prisma schema is up to date
- Run `npm run prisma:generate`

### Agent Count Wrong
- Verify `isClient` field on OrganizationMembers
- Check database for duplicate members
- Run `updateSubscriptionAgentCount()` manually

## Security Notes

⚠️ **Important:**
- Never commit `.env` file to git
- Use test keys in development
- Use live keys only in production
- Validate webhook signatures (when implemented)
- Store API keys securely

## Support

For PayMongo-specific issues:
- Documentation: https://developers.paymongo.com/
- Support: support@paymongo.com

For application issues:
- Check console logs
- Review database records
- Test with PayMongo test cards

## Next Steps

1. ✅ Add PayMongo keys to `.env`
2. ✅ Run `npm run prisma:generate`
3. ✅ Run `npm run prisma:push`
4. ✅ Test subscription flow
5. ⏳ Add webhooks (optional, later)
6. ⏳ Switch to live keys (production)

## Pricing Configuration

To change the price per agent, update in:

```typescript
// /prisma/schema.prisma
pricePerAgent Float @default(299.00) // Change default here

// Or update via code:
await prisma.subscription.update({
  where: { organizationId },
  data: { pricePerAgent: 399.00 }, // New price
});
```

## Files Created/Modified

**New Files:**
- `/src/lib/paymongo.ts` - PayMongo API integration
- `/src/app/actions-subscription.ts` - Subscription server actions
- `/src/components/subscription-view.tsx` - Subscription UI
- `/src/components/settings-page.tsx` - Settings with tabs
- `/PAYMONGO_SETUP.md` - This guide

**Modified Files:**
- `/prisma/schema.prisma` - Added Subscription & Payment models
- `/src/components/main-view.tsx` - Updated to use SettingsPage

**Environment Variables:**
- `PAYMONGO_PUBLIC_KEY`
- `PAYMONGO_SECRET_KEY`
