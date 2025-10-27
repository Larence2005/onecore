import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { paymongoClient, calculateSubscriptionAmount } from '@/lib/paymongo';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { organizationId, memberCount } = body;

    if (!organizationId || !memberCount || memberCount < 1) {
      return NextResponse.json(
        { message: 'Organization ID and member count are required' },
        { status: 400 }
      );
    }

    // Verify user is the organization owner
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        owner: true,
        subscription: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { message: 'Organization not found' },
        { status: 404 }
      );
    }

    if (organization.owner.email !== session.user.email) {
      return NextResponse.json(
        { message: 'Only organization owner can manage subscription' },
        { status: 403 }
      );
    }

    // Calculate amount (memberCount * $10 per month)
    const amount = calculateSubscriptionAmount(memberCount);
    const description = `Subscription for ${memberCount} member${memberCount > 1 ? 's' : ''} - ${organization.name}`;

    // Create checkout session
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:9002';
    const checkoutSession = await paymongoClient.createCheckoutSession({
      amount,
      currency: 'USD',
      description,
      successUrl: `${baseUrl}/organization/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/organization/subscription/cancel`,
      metadata: {
        organizationId,
        memberCount,
        type: 'subscription_payment',
      },
    });

    // Create or update subscription record
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

    if (organization.subscription) {
      await prisma.subscription.update({
        where: { id: organization.subscription.id },
        data: {
          memberCount,
          currentPeriodStart,
          currentPeriodEnd,
          status: 'INCOMPLETE',
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          organizationId,
          memberCount,
          status: 'INCOMPLETE',
          currentPeriodStart,
          currentPeriodEnd,
        },
      });
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: checkoutSession.attributes.checkout_url,
      sessionId: checkoutSession.id,
    });
  } catch (error: any) {
    console.error('Create checkout error:', error);

    return NextResponse.json(
      { message: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
