import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { message: 'Email is required' },
        { status: 400 }
      );
    }

    // Delete all OTP records for this email
    await prisma.otp.deleteMany({
      where: { email: email.toLowerCase() },
    });

    return NextResponse.json({
      success: true,
      message: 'OTP records deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete expired OTP error:', error);

    return NextResponse.json(
      { message: error.message || 'Failed to delete OTP records' },
      { status: 500 }
    );
  }
}
