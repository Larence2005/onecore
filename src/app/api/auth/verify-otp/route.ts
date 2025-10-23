import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return NextResponse.json(
        { message: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    // Find OTP record by email first
    const otpRecord = await prisma.otp.findFirst({
      where: {
        email: email.toLowerCase(),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return NextResponse.json(
        { message: 'No OTP found. Please start the signup process again.' },
        { status: 400 }
      );
    }

    // Check if 5 minutes have passed since first OTP
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (otpRecord.firstSentAt < fiveMinutesAgo) {
      // Delete expired OTP data
      await prisma.otp.deleteMany({
        where: { email: email.toLowerCase() },
      });
      return NextResponse.json(
        { message: 'OTP session expired. Please start the signup process again.' },
        { status: 400 }
      );
    }

    // Check if maximum verification attempts exceeded
    if (otpRecord.verifyAttempts >= 3) {
      // Delete OTP data after 3 failed attempts
      await prisma.otp.deleteMany({
        where: { email: email.toLowerCase() },
      });
      return NextResponse.json(
        { message: 'Maximum verification attempts exceeded. Please wait 5 minutes and start the signup process again.' },
        { status: 400 }
      );
    }

    // Check if OTP matches
    if (otpRecord.otp !== otp.trim()) {
      // Increment verification attempts
      await prisma.otp.update({
        where: { id: otpRecord.id },
        data: {
          verifyAttempts: otpRecord.verifyAttempts + 1,
        },
      });

      const remainingAttempts = 3 - (otpRecord.verifyAttempts + 1);
      
      if (remainingAttempts <= 0) {
        // Delete OTP data after 3 failed attempts
        await prisma.otp.deleteMany({
          where: { email: email.toLowerCase() },
        });
        return NextResponse.json(
          { message: 'Maximum verification attempts exceeded. Please wait 5 minutes and start the signup process again.' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { message: `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts > 1 ? 's' : ''} remaining.` },
        { status: 400 }
      );
    }

    // Check if OTP has expired
    if (new Date() > otpRecord.expiresAt) {
      return NextResponse.json(
        { message: 'OTP has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // OTP is valid, proceed with signup
    const signupData = otpRecord.signupData as any;

    // Hash password
    const hashedPassword = await hashPassword(signupData.password);

    // Create user and organization in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: signupData.email.toLowerCase(),
          password: hashedPassword,
          name: signupData.name,
          emailVerified: new Date(), // Email is verified via OTP
        },
      });

      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: signupData.organizationName,
          domain: signupData.domain,
          ownerId: user.id,
          deadlineSettings: {
            Urgent: 1,
            High: 2,
            Medium: 3,
            Low: 4,
          },
        },
      });

      // Add user as organization member
      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          name: signupData.name,
          email: signupData.email.toLowerCase(),
          status: 'NOT_VERIFIED', // Owner needs to complete email verification in settings
          isClient: false,
        },
      });

      // Delete OTP record after successful signup
      await tx.otp.deleteMany({
        where: { email: email.toLowerCase() },
      });

      return { user, organization };
    });

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      userId: result.user.id,
      organizationId: result.organization.id,
    });
  } catch (error: any) {
    console.error('Verify OTP error:', error);

    return NextResponse.json(
      { message: error.message || 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}
