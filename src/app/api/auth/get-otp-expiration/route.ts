import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { message: 'Email is required' },
        { status: 400 }
      );
    }

    // Find the most recent OTP record for this email
    const otpRecord = await prisma.otp.findFirst({
      where: { email: email.toLowerCase() },
      orderBy: { createdAt: 'desc' },
      select: {
        expiresAt: true,
        resendCount: true,
      },
    });

    if (!otpRecord) {
      return NextResponse.json(
        { message: 'No OTP found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      expiresAt: otpRecord.expiresAt,
      resendCount: otpRecord.resendCount,
    });
  } catch (error: any) {
    console.error('Get OTP expiration error:', error);

    return NextResponse.json(
      { message: error.message || 'Failed to get OTP expiration' },
      { status: 500 }
    );
  }
}
