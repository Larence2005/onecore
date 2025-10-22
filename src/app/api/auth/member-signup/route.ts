import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { memberSignUpSchema } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate input
    const validatedData = memberSignUpSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: 'This email address has already been registered.' },
        { status: 400 }
      );
    }

    // Check if they are invited as an organization member
    const orgMember = await prisma.organizationMember.findFirst({
      where: {
        email: validatedData.email.toLowerCase(),
        userId: null, // Not yet registered
      },
      include: {
        organization: true,
      },
    });

    if (orgMember) {
      if (orgMember.status === 'UNINVITED') {
        return NextResponse.json(
          { message: 'Your account has not been verified by an administrator. Please contact them to send a verification email.' },
          { status: 400 }
        );
      }

      if (orgMember.status !== 'INVITED') {
        return NextResponse.json(
          { message: 'Invalid invitation status.' },
          { status: 400 }
        );
      }

      // Hash password
      const hashedPassword = await hashPassword(validatedData.password);

      // Create user and update member in transaction
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: validatedData.email.toLowerCase(),
            password: hashedPassword,
            name: orgMember.name,
            emailVerified: new Date(),
          },
        });

        await tx.organizationMember.update({
          where: { id: orgMember.id },
          data: {
            userId: user.id,
            status: 'VERIFIED',
          },
        });

        return { user };
      });

      return NextResponse.json({
        success: true,
        userId: result.user.id,
      });
    }

    // Check if they are invited as a company employee
    const employee = await prisma.employee.findFirst({
      where: {
        email: validatedData.email.toLowerCase(),
        userId: null,
      },
      include: {
        company: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (employee) {
      if (employee.status === 'UNINVITED') {
        return NextResponse.json(
          { message: 'Your account has not been verified by your company administrator. Please contact them to send a verification email.' },
          { status: 400 }
        );
      }

      if (employee.status === 'VERIFIED') {
        return NextResponse.json(
          { message: 'This email address has already been registered as an employee.' },
          { status: 400 }
        );
      }

      if (employee.status !== 'INVITED') {
        return NextResponse.json(
          { message: 'Invalid invitation status.' },
          { status: 400 }
        );
      }

      // Hash password
      const hashedPassword = await hashPassword(validatedData.password);

      // Create user and update employee in transaction
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: validatedData.email.toLowerCase(),
            password: hashedPassword,
            name: employee.name,
            emailVerified: new Date(),
          },
        });

        await tx.employee.update({
          where: { id: employee.id },
          data: {
            userId: user.id,
            status: 'VERIFIED',
          },
        });

        return { user };
      });

      return NextResponse.json({
        success: true,
        userId: result.user.id,
      });
    }

    // Not found in any invitation list
    return NextResponse.json(
      { message: 'You have not been invited to an organization or client company. Please contact an administrator.' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Member signup error:', error);
    
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
