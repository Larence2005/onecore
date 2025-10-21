import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { signUpSchema } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate input
    const validatedData = signUpSchema.parse(body);

    // Check if organization with same name or domain exists
    const existingOrg = await prisma.organization.findFirst({
      where: {
        OR: [
          { name: validatedData.organizationName },
          { domain: validatedData.domain },
        ],
      },
    });

    if (existingOrg) {
      if (existingOrg.name === validatedData.organizationName) {
        return NextResponse.json(
          { message: 'An organization with this name already exists.' },
          { status: 400 }
        );
      }
      if (existingOrg.domain === validatedData.domain) {
        return NextResponse.json(
          { message: 'An organization with this domain already exists.' },
          { status: 400 }
        );
      }
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: 'A user with this email already exists.' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password);

    // Create user and organization in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: validatedData.email.toLowerCase(),
          password: hashedPassword,
          name: validatedData.name,
          emailVerified: new Date(), // Auto-verify for now
        },
      });

      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: validatedData.organizationName,
          domain: validatedData.domain,
          ownerId: user.id,
          deadlineSettings: {
            Urgent: 1,
            High: 2,
            Medium: 3,
            Low: 4,
          },
        },
      });

      // Add user as organization member (owner is admin, needs to verify email)
      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          name: validatedData.name,
          email: validatedData.email.toLowerCase(),
          status: 'NOT_VERIFIED', // Owner needs to complete email verification in settings
          isClient: false, // Owner is admin, not a client
        },
      });

      return { user, organization };
    });

    return NextResponse.json({
      success: true,
      userId: result.user.id,
      organizationId: result.organization.id,
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { message: 'Invalid input data', errors: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: error.message || 'An error occurred during signup' },
      { status: 500 }
    );
  }
}
