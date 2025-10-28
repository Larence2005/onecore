'use server';

import { prisma } from '@/lib/prisma';
import { createPaymentLink, getPaymentLinkStatus, getPayment, calculateSubscriptionAmount, getBillingPeriod } from '@/lib/paymongo';
import { addMonths, addDays } from 'date-fns';

/**
 * Create or get subscription for an organization
 */
export async function getOrCreateSubscription(organizationId: string) {
  try {
    // Check if subscription exists
    let subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: {
        organization: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!subscription) {
      // Count active agents (non-client members)
      const agentCount = await prisma.organizationMember.count({
        where: {
          organizationId,
          isClient: false,
        },
      });

      const pricePerAgent = 500.00;
      const totalAmount = agentCount * pricePerAgent;
      const now = new Date();
      const trialEndsAt = addDays(now, 14); // 14-day trial
      const currentPeriodEnd = addMonths(now, 1);

      // Create new subscription with trial
      subscription = await prisma.subscription.create({
        data: {
          organizationId,
          status: 'TRIAL',
          agentCount,
          pricePerAgent,
          totalAmount,
          currentPeriodStart: now,
          currentPeriodEnd,
          trialEndsAt,
        },
        include: {
          organization: {
            include: {
              members: true,
            },
          },
        },
      });
    }

    return { success: true, subscription };
  } catch (error: any) {
    console.error('Error getting/creating subscription:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update subscription agent count when members are added/removed
 */
export async function updateSubscriptionAgentCount(organizationId: string) {
  try {
    // Count active agents (non-client members)
    const agentCount = await prisma.organizationMember.count({
      where: {
        organizationId,
        isClient: false,
      },
    });

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      return { success: false, error: 'Subscription not found' };
    }

    const totalAmount = agentCount * subscription.pricePerAgent;

    await prisma.subscription.update({
      where: { organizationId },
      data: {
        agentCount,
        totalAmount,
      },
    });

    return { success: true, agentCount, totalAmount };
  } catch (error: any) {
    console.error('Error updating subscription agent count:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create payment link for subscription billing
 */
export async function createSubscriptionPayment(organizationId: string) {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: {
        organization: true,
      },
    });

    if (!subscription) {
      return { success: false, error: 'Subscription not found' };
    }

    // Calculate amount in centavos
    const amountInCentavos = calculateSubscriptionAmount(
      subscription.agentCount,
      subscription.pricePerAgent
    );

    const billingPeriod = getBillingPeriod();
    const description = `${subscription.organization.name} - ${billingPeriod} (${subscription.agentCount} agent${subscription.agentCount > 1 ? 's' : ''})`;

    // Create PayMongo payment link
    const paymentLinkResult = await createPaymentLink({
      amount: amountInCentavos,
      description,
      remarks: `Subscription billing for ${billingPeriod}`,
    });

    if (!paymentLinkResult.success) {
      return { success: false, error: paymentLinkResult.error };
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        organizationId,
        paymongoLinkId: paymentLinkResult.linkId,
        amount: subscription.totalAmount,
        currency: 'PHP',
        status: 'PENDING',
        description,
        billingPeriod,
        agentCount: subscription.agentCount,
        metadata: {
          referenceNumber: paymentLinkResult.referenceNumber,
        },
      },
    });

    return {
      success: true,
      payment,
      paymentLink: paymentLinkResult.link,
      referenceNumber: paymentLinkResult.referenceNumber,
    };
  } catch (error: any) {
    console.error('Error creating subscription payment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check payment status (manual verification without webhooks)
 */
export async function checkPaymentStatus(paymentId: string) {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }

    if (!payment.paymongoLinkId) {
      return { success: false, error: 'No PayMongo link ID' };
    }

    // Check PayMongo payment link status
    const statusResult = await getPaymentLinkStatus(payment.paymongoLinkId);

    if (!statusResult.success) {
      return { success: false, error: statusResult.error };
    }

    // Update payment status if paid
    if (statusResult.status === 'paid' && payment.status !== 'PAID') {
      const paymongoPayment = statusResult.payments[0];

      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'PAID',
          paymongoPaymentId: paymongoPayment?.id,
          paymentMethod: paymongoPayment?.attributes?.source?.type,
          paidAt: new Date(),
          metadata: {
            ...payment.metadata as object,
            paymongoData: paymongoPayment,
          },
        },
      });

      // Update subscription status to ACTIVE
      await prisma.subscription.update({
        where: { organizationId: payment.organizationId },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: addMonths(new Date(), 1),
        },
      });

      return { success: true, status: 'PAID', payment };
    }

    return { success: true, status: statusResult.status, payment };
  } catch (error: any) {
    console.error('Error checking payment status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all payments for an organization
 */
export async function getOrganizationPayments(organizationId: string) {
  try {
    const payments = await prisma.payment.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, payments };
  } catch (error: any) {
    console.error('Error getting payments:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(organizationId: string) {
  try {
    await prisma.subscription.update({
      where: { organizationId },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    return { success: false, error: error.message };
  }
}
