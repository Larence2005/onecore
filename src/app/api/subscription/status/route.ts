import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { message: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Get organization with subscription
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        owner: true,
        subscription: {
          include: {
            payments: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
        members: {
          where: { isClient: false },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { message: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if user has access
    const isOwner = organization.owner.email === session.user.email;
    const isMember = organization.members.some(m => m.email === session.user.email);

    if (!isOwner && !isMember) {
      return NextResponse.json(
        { message: 'Access denied' },
        { status: 403 }
      );
    }

    const activeAgentCount = organization.members.filter(m => !m.isClient).length;

    return NextResponse.json({
      subscription: organization.subscription,
      activeAgentCount,
      isOwner,
    });
  } catch (error: any) {
    console.error('Get subscription status error:', error);

    return NextResponse.json(
      { message: error.message || 'Failed to get subscription status' },
      { status: 500 }
    );
  }
}
