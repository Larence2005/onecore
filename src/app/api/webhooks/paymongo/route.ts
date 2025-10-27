import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { paymongoClient } from '@/lib/paymongo';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('paymongo-signature') || '';

    // Verify webhook signature
    if (!paymongoClient.verifyWebhookSignature(body, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { message: 'Invalid signature' },
        { status: 401 }
      );
    }

    const event = JSON.parse(body);
    const eventType = event.data.attributes.type;
    const eventData = event.data.attributes.data;

    console.log('PayMongo webhook received:', eventType);

    switch (eventType) {
      case 'payment.paid':
        await handlePaymentPaid(eventData);
        break;

      case 'payment.failed':
        await handlePaymentFailed(eventData);
        break;

      case 'checkout_session.payment.paid':
        await handleCheckoutSessionPaid(eventData);
        break;

      default:
        console.log('Unhandled event type:', eventType);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { message: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handlePaymentPaid(paymentData: any) {
  try {
    const metadata = paymentData.attributes.metadata;
    const organizationId = metadata?.organizationId;

    if (!organizationId) {
      console.error('No organizationId in payment metadata');
      return;
    }

    // Update subscription status
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      console.error('Subscription not found for organization:', organizationId);
      return;
    }

    // Create payment record
    await prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        organizationId,
        paymongoPaymentId: paymentData.id,
        amount: paymentData.attributes.amount / 100, // Convert from cents
        currency: paymentData.attributes.currency,
        status: 'SUCCEEDED',
        paymentMethod: paymentData.attributes.source?.type || 'unknown',
        memberCount: subscription.memberCount,
        billingPeriodStart: subscription.currentPeriodStart || new Date(),
        billingPeriodEnd: subscription.currentPeriodEnd || new Date(),
        paidAt: new Date(),
        metadata: paymentData.attributes.metadata,
      },
    });

    // Update subscription status to ACTIVE
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
      },
    });

    console.log('Payment processed successfully for organization:', organizationId);
  } catch (error) {
    console.error('Error handling payment.paid:', error);
  }
}

async function handlePaymentFailed(paymentData: any) {
  try {
    const metadata = paymentData.attributes.metadata;
    const organizationId = metadata?.organizationId;

    if (!organizationId) {
      console.error('No organizationId in payment metadata');
      return;
    }

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      console.error('Subscription not found for organization:', organizationId);
      return;
    }

    // Create failed payment record
    await prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        organizationId,
        paymongoPaymentId: paymentData.id,
        amount: paymentData.attributes.amount / 100,
        currency: paymentData.attributes.currency,
        status: 'FAILED',
        paymentMethod: paymentData.attributes.source?.type || 'unknown',
        memberCount: subscription.memberCount,
        billingPeriodStart: subscription.currentPeriodStart || new Date(),
        billingPeriodEnd: subscription.currentPeriodEnd || new Date(),
        failedAt: new Date(),
        failureReason: paymentData.attributes.last_payment_error?.message || 'Payment failed',
        metadata: paymentData.attributes.metadata,
      },
    });

    // Update subscription status to PAST_DUE
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'PAST_DUE',
      },
    });

    console.log('Payment failed for organization:', organizationId);
  } catch (error) {
    console.error('Error handling payment.failed:', error);
  }
}

async function handleCheckoutSessionPaid(checkoutData: any) {
  try {
    const metadata = checkoutData.attributes.metadata;
    const organizationId = metadata?.organizationId;
    const memberCount = metadata?.memberCount;

    if (!organizationId) {
      console.error('No organizationId in checkout metadata');
      return;
    }

    // Retrieve the full checkout session
    const checkoutSession = await paymongoClient.getCheckoutSession(checkoutData.id);
    const paymentIntent = checkoutSession.attributes.payment_intent;

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      console.error('Subscription not found for organization:', organizationId);
      return;
    }

    // Create payment record
    await prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        organizationId,
        paymongoPaymentId: paymentIntent?.id || checkoutData.id,
        amount: checkoutData.attributes.line_items[0].amount / 100,
        currency: checkoutData.attributes.line_items[0].currency,
        status: 'SUCCEEDED',
        paymentMethod: paymentIntent?.attributes?.payment_method_used || 'checkout',
        memberCount: parseInt(memberCount) || subscription.memberCount,
        billingPeriodStart: subscription.currentPeriodStart || new Date(),
        billingPeriodEnd: subscription.currentPeriodEnd || new Date(),
        paidAt: new Date(),
        metadata: checkoutData.attributes.metadata,
      },
    });

    // Update subscription status to ACTIVE
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        memberCount: parseInt(memberCount) || subscription.memberCount,
      },
    });

    console.log('Checkout session paid for organization:', organizationId);
  } catch (error) {
    console.error('Error handling checkout_session.payment.paid:', error);
  }
}
