import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json(
        { message: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    // Find OTP record
    const otpRecord = await prisma.passwordResetOtp.findFirst({
      where: {
        email: email.toLowerCase(),
        otp: otp,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpRecord) {
      return NextResponse.json(
        { message: 'Invalid OTP code' },
        { status: 400 }
      );
    }

    // Check if OTP is expired
    if (new Date() > otpRecord.expiresAt) {
      // Delete expired OTP
      await prisma.passwordResetOtp.delete({
        where: { id: otpRecord.id },
      });
      
      return NextResponse.json(
        { message: 'OTP has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // OTP is valid
    return NextResponse.json(
      { 
        message: 'OTP verified successfully',
        verified: true 
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json(
      { message: 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}
