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
      const pricePerAgent = 10.00; // $10 USD per agent
      const agentCount = 1; // Start with 1 agent (the admin/owner)
      const agentSlots = 0; // Start with 0 slots
      const totalAmount = 0; // Start with $0
      const now = new Date();
      const trialEndsAt = addDays(now, 14); // 14-day trial
      const currentPeriodEnd = addMonths(now, 1);

      // Create new subscription with trial - starts at 0/0 licenses but 1 active agent
      subscription = await prisma.subscription.create({
        data: {
          organizationId,
          status: 'TRIAL',
          agentCount,
          agentSlots,
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
 * Update subscription agent count when members are added/removed or licenses changed
 */
export async function updateSubscriptionAgentCount(organizationId: string) {
  try {
    // Count agents WITHOUT licenses (non-client members who don't have a license)
    const agentCount = await prisma.organizationMember.count({
      where: {
        organizationId,
        isClient: false,
        hasLicense: false,
      },
    });

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      return { success: false, error: 'Subscription not found' };
    }

    // Monthly cost is based on total purchased licenses (agentSlots)
    const agentSlots = (subscription as any).agentSlots || 0;
    const totalAmount = agentSlots * subscription.pricePerAgent;

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

    // Calculate amount in centavos (PayMongo only accepts PHP, USD is converted to PHP using real-time rates)
    const amountInCentavos = await calculateSubscriptionAmount(
      subscription.agentCount,
      subscription.pricePerAgent
    );

    const billingPeriod = getBillingPeriod();
    const description = `${subscription.organization.name} - ${billingPeriod} (${subscription.agentCount} agent${subscription.agentCount > 1 ? 's' : ''})`;

    // Create PayMongo payment link (amount is in PHP centavos, but we display USD to users)
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
        currency: 'USD',
        status: 'PENDING',
        description,
        billingPeriod,
        agentCount: subscription.agentCount,
        metadata: {
          referenceNumber: paymentLinkResult.referenceNumber,
          checkoutUrl: paymentLinkResult.link, // Store the checkout URL
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
 * Get payment link URL for an existing pending payment
 */
export async function getPaymentLink(paymentId: string) {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }

    if (payment.status !== 'PENDING') {
      return { success: false, error: 'Payment is not pending' };
    }

    // Try to get checkout URL from metadata first
    const metadata = payment.metadata as any;
    let checkoutUrl = metadata?.checkoutUrl;

    console.log('[getPaymentLink] Payment ID:', paymentId);
    console.log('[getPaymentLink] Metadata:', metadata);
    console.log('[getPaymentLink] Checkout URL from metadata:', checkoutUrl);

    // If not in metadata, fetch from PayMongo API
    if (!checkoutUrl && payment.paymongoLinkId) {
      console.log('[getPaymentLink] Fetching from PayMongo API, linkId:', payment.paymongoLinkId);
      const statusResult = await getPaymentLinkStatus(payment.paymongoLinkId);
      
      console.log('[getPaymentLink] PayMongo status result:', statusResult);
      
      if (statusResult.success) {
        // Use the checkout URL directly from PayMongo API
        checkoutUrl = statusResult.checkoutUrl;
        console.log('[getPaymentLink] Checkout URL from API:', checkoutUrl);
      }
    }

    if (!checkoutUrl) {
      console.error('[getPaymentLink] No checkout URL available');
      return { success: false, error: 'Payment link not available' };
    }

    return {
      success: true,
      paymentLink: checkoutUrl,
      payment,
    };
  } catch (error: any) {
    console.error('Error getting payment link:', error);
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

    console.log('[checkPaymentStatus] PayMongo status result:', JSON.stringify(statusResult, null, 2));
    console.log('[checkPaymentStatus] Current payment status:', payment.status);

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

      // Check if this is an agent slots purchase
      const metadata = payment.metadata as any;
      const isSlotPurchase = metadata?.type === 'AGENT_SLOTS';

      if (isSlotPurchase && metadata?.slotsToAdd) {
        // Add slots to subscription
        const subscription = await prisma.subscription.findUnique({
          where: { organizationId: payment.organizationId },
          include: {
            organization: true,
          },
        });

        if (subscription) {
          const currentSlots = (subscription as any).agentSlots || 0;
          await prisma.subscription.update({
            where: { organizationId: payment.organizationId },
            data: {
              agentSlots: currentSlots + metadata.slotsToAdd,
              status: 'ACTIVE',
            } as any, // Type cast for agentSlots field until schema is migrated
          });

          // Automatically assign first license to admin/owner if they don't have one
          const ownerId = subscription.organization.ownerId;
          if (ownerId && currentSlots === 0) {
            // This is the first license purchase, assign to admin
            const adminMember = await prisma.organizationMember.findFirst({
              where: {
                organizationId: payment.organizationId,
                userId: ownerId,
              },
            });

            if (adminMember && !(adminMember as any).hasLicense) {
              await prisma.organizationMember.update({
                where: { id: adminMember.id },
                data: { hasLicense: true } as any,
              });
            }
          }

          // Update subscription agent count
          await updateSubscriptionAgentCount(payment.organizationId);
        }
      } else {
        // Regular subscription payment - update status to ACTIVE
        await prisma.subscription.update({
          where: { organizationId: payment.organizationId },
          data: {
            status: 'ACTIVE',
            currentPeriodStart: new Date(),
            currentPeriodEnd: addMonths(new Date(), 1),
          },
        });
      }

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
 * Cancel/delete a pending payment
 */
export async function cancelPendingPayment(paymentId: string) {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }

    if (payment.status !== 'PENDING') {
      return { success: false, error: 'Only pending payments can be canceled' };
    }

    // Delete the pending payment
    await prisma.payment.delete({
      where: { id: paymentId },
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error canceling pending payment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Buy additional agent slots
 */
export async function buyAgentSlots(organizationId: string, slotsToAdd: number) {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: { organization: true },
    });

    if (!subscription) {
      return { success: false, error: 'Subscription not found' };
    }

    const pricePerSlot = subscription.pricePerAgent;
    const totalCost = slotsToAdd * pricePerSlot;

    // Calculate amount in centavos (PayMongo only accepts PHP, USD is converted to PHP using real-time rates)
    const amountInCentavos = await calculateSubscriptionAmount(slotsToAdd, pricePerSlot);

    const billingPeriod = getBillingPeriod();
    const description = `${subscription.organization.name} - Buy ${slotsToAdd} Agent Slot${slotsToAdd > 1 ? 's' : ''}`;

    // Create PayMongo payment link (amount is in PHP centavos, but we display USD to users)
    const paymentLinkResult = await createPaymentLink({
      amount: amountInCentavos,
      description,
      remarks: `Purchase ${slotsToAdd} agent slot${slotsToAdd > 1 ? 's' : ''}`,
    });

    if (!paymentLinkResult.success) {
      return { success: false, error: paymentLinkResult.error };
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        organizationId,
        paymongoLinkId: paymentLinkResult.linkId,
        amount: totalCost,
        currency: 'USD',
        status: 'PENDING',
        description,
        billingPeriod: `Agent License Purchase`,
        agentCount: slotsToAdd,
        metadata: {
          referenceNumber: paymentLinkResult.referenceNumber,
          checkoutUrl: paymentLinkResult.link,
          type: 'AGENT_SLOTS', // Mark as slot purchase
          slotsToAdd,
        },
      },
    });

    return {
      success: true,
      payment,
      paymentLink: paymentLinkResult.link,
      referenceNumber: paymentLinkResult.referenceNumber,
      totalCost,
      slotsToAdd,
    };
  } catch (error: any) {
    console.error('Error buying agent slots:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get available agent slots (slots purchased - current agents)
 */
export async function getAvailableSlots(organizationId: string) {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      return { success: false, error: 'Subscription not found', availableSlots: 0 };
    }

    // Get agentSlots field, default to 0 if not set
    const totalSlots = (subscription as any).agentSlots || 0;
    
    // Count agents WITH licenses (used slots)
    const licensedAgentsCount = await prisma.organizationMember.count({
      where: {
        organizationId,
        isClient: false,
        hasLicense: true,
      },
    });
    
    // Only count used slots if there are purchased slots, otherwise show 0/0
    const usedSlots = totalSlots > 0 ? licensedAgentsCount : 0;
    const availableSlots = totalSlots - usedSlots;

    return {
      success: true,
      totalSlots,
      usedSlots,
      availableSlots,
      status: subscription.status,
    };
  } catch (error: any) {
    console.error('Error getting available slots:', error);
    return { success: false, error: error.message, availableSlots: 0 };
  }
}

/**
 * Check if organization can add new members (has active/paid subscription)
 */
export async function canAddMembers(organizationId: string) {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      return { 
        success: false, 
        canAdd: false, 
        reason: 'No subscription found. Please set up your subscription first.' 
      };
    }

    // Check available slots
    const slotsResult = await getAvailableSlots(organizationId);
    if (slotsResult.success && slotsResult.availableSlots <= 0) {
      return {
        success: true,
        canAdd: false,
        reason: `No available agent slots. You have ${slotsResult.usedSlots}/${slotsResult.totalSlots} slots used. Please buy more slots in Settings → Subscription.`,
      };
    }

    // Check if there are any pending payments
    const pendingPayments = await prisma.payment.findMany({
      where: {
        organizationId,
        status: 'PENDING',
      },
    });

    if (pendingPayments.length > 0) {
      return {
        success: true,
        canAdd: false,
        reason: 'You have pending payments. Please complete your payment before adding new agents.',
      };
    }

    // Allow adding members if subscription is TRIAL or ACTIVE
    if (subscription.status === 'TRIAL' || subscription.status === 'ACTIVE') {
      return {
        success: true,
        canAdd: true,
        reason: null,
      };
    }

    // Block if subscription is PAST_DUE, CANCELED, or EXPIRED
    return {
      success: true,
      canAdd: false,
      reason: `Your subscription is ${subscription.status.toLowerCase()}. Please renew your subscription to add new agents.`,
    };
  } catch (error: any) {
    console.error('Error checking if can add members:', error);
    return { 
      success: false, 
      canAdd: false, 
      reason: 'Failed to verify subscription status.' 
    };
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

/**
 * Check if Microsoft 365 licenses are available
 * Checks the Microsoft Graph API for available Business Basic licenses
 */
export async function checkMicrosoftLicenseAvailability(organizationId: string) {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return { success: false, available: false, error: 'Organization not found' };
    }

    // Get Microsoft Graph client
    const { Client } = require('@microsoft/microsoft-graph-client');
    const { getGraphClient } = require('./actions-new');
    
    const client = await getGraphClient();
    
    // Get subscribed SKUs from Microsoft Graph API
    const subscribedSkus = await client.api('/subscribedSkus').get();
    const businessBasicSku = subscribedSkus.value.find((sku: any) => sku.skuPartNumber === 'O365_BUSINESS_ESSENTIALS');
    
    if (!businessBasicSku) {
      return { 
        success: true, 
        available: false,
        message: 'No Microsoft 365 Business Basic licenses found'
      };
    }
    
    // Check if there are available licenses
    const availableUnits = businessBasicSku.prepaidUnits?.enabled || 0;
    const consumedUnits = businessBasicSku.consumedUnits || 0;
    const licensesAvailable = (availableUnits - consumedUnits) > 0;

    return { 
      success: true, 
      available: licensesAvailable,
      availableCount: availableUnits - consumedUnits,
      message: licensesAvailable 
        ? `${availableUnits - consumedUnits} Microsoft 365 license(s) available` 
        : 'No Microsoft licenses available'
    };
  } catch (error: any) {
    console.error('Error checking Microsoft license availability:', error);
    return { 
      success: false, 
      available: false, 
      error: error.message 
    };
  }
}

/**
 * Activate license for a member
 */
export async function activateLicense(organizationId: string, memberEmail: string) {
  try {
    // Check if there are available licenses
    const slotsResult = await getAvailableSlots(organizationId);
    if (!slotsResult.success || slotsResult.availableSlots <= 0) {
      return { 
        success: false, 
        error: 'No available licenses. Please purchase more licenses first.' 
      };
    }

    // Update member to have active license
    const member = await prisma.organizationMember.update({
      where: {
        organizationId_email: {
          organizationId,
          email: memberEmail,
        },
      },
      data: {
        hasLicense: true,
      },
    });

    // Update subscription agent count and monthly cost
    await updateSubscriptionAgentCount(organizationId);

    return { success: true, member };
  } catch (error: any) {
    console.error('Error activating license:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Revoke license from a member
 */
export async function revokeLicense(organizationId: string, memberEmail: string) {
  try {
    const member = await prisma.organizationMember.update({
      where: {
        organizationId_email: {
          organizationId,
          email: memberEmail,
        },
      },
      data: {
        hasLicense: false,
      },
    });

    // Update subscription agent count and monthly cost
    await updateSubscriptionAgentCount(organizationId);

    return { success: true, member };
  } catch (error: any) {
    console.error('Error revoking license:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Bulk activate licenses for multiple members
 */
export async function bulkActivateLicenses(organizationId: string, memberEmails: string[]) {
  try {
    // Check if there are enough available licenses
    const slotsResult = await getAvailableSlots(organizationId);
    if (!slotsResult.success || slotsResult.availableSlots < memberEmails.length) {
      return { 
        success: false, 
        error: `Not enough available licenses. You need ${memberEmails.length} licenses but only have ${slotsResult.availableSlots} available.` 
      };
    }

    // Update all members to have active licenses
    const updatePromises = memberEmails.map(email =>
      prisma.organizationMember.update({
        where: {
          organizationId_email: {
            organizationId,
            email,
          },
        },
        data: {
          hasLicense: true,
        },
      })
    );

    await Promise.all(updatePromises);

    // Update subscription agent count and monthly cost
    await updateSubscriptionAgentCount(organizationId);

    return { success: true, count: memberEmails.length };
  } catch (error: any) {
    console.error('Error bulk activating licenses:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get license status for organization members
 */
export async function getMembersLicenseStatus(organizationId: string) {
  try {
    const members = await prisma.organizationMember.findMany({
      where: { 
        organizationId,
        isClient: false, // Only count agents, not clients
      },
      select: {
        email: true,
        name: true,
        hasLicense: true,
      },
    });

    const licensed = members.filter(m => m.hasLicense).length;
    const unlicensed = members.filter(m => !m.hasLicense).length;

    return {
      success: true,
      members,
      licensed,
      unlicensed,
      total: members.length,
    };
  } catch (error: any) {
    console.error('Error getting members license status:', error);
    return { success: false, error: error.message };
  }
}
