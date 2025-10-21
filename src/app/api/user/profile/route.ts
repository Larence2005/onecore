import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Use session user ID (query param is ignored for security)
    const userId = session.user.id;

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      console.error(`User not found with ID: ${userId}`);
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    console.log(`Fetching profile for user: ${userId}, email: ${user.email}`);

    // Check if user is an organization member
    const orgMember = await prisma.organizationMember.findFirst({
      where: { userId: userId },
      include: {
        organization: true,
      },
    });

    console.log(`Organization member found: ${!!orgMember}`);

    if (orgMember) {
      return NextResponse.json({
        uid: user.id,
        email: orgMember.email, // Use Microsoft 365 email from OrganizationMember
        name: user.name || orgMember.name,
        organizationId: orgMember.organization.id,
        organizationName: orgMember.organization.name,
        organizationOwnerUid: orgMember.organization.ownerId,
        isClient: orgMember.isClient, // Use actual value from database
        address: orgMember.organization.address,
        mobile: orgMember.organization.mobile,
        landline: orgMember.organization.landline,
        website: orgMember.organization.website,
        status: orgMember.status,
        organizationDomain: orgMember.organization.domain,
        deadlineSettings: orgMember.organization.deadlineSettings,
      });
    }

    // Check if user is a company employee (client)
    const employee = await prisma.employee.findFirst({
      where: { userId: userId },
      include: {
        company: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (employee) {
      return NextResponse.json({
        uid: user.id,
        email: user.email,
        name: user.name || employee.name,
        organizationId: employee.company.organization.id,
        organizationName: employee.company.organization.name,
        organizationOwnerUid: employee.company.organization.ownerId,
        isClient: true,
        status: employee.status,
      });
    }

    // User not found in any organization
    return NextResponse.json({
      uid: user.id,
      email: user.email,
      name: user.name,
    });
  } catch (error: any) {
    console.error('Profile fetch error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { message: error.message || 'An error occurred', error: error.toString() },
      { status: 500 }
    );
  }
}
