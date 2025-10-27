import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import axios from 'axios';

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP email using Microsoft Graph API
async function sendOTPEmail(email: string, otp: string): Promise<void> {
  const notificationEmail = process.env.EMAIL_NOTIFICATION;
  const clientId = process.env.AZURE_CLIENT_ID;
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!notificationEmail || !clientId || !tenantId || !clientSecret) {
    throw new Error('Email notification configuration is missing');
  }

  // Get access token
  const tokenResponse = await axios.post(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: clientId,
      scope: 'https://graph.microsoft.com/.default',
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  const accessToken = tokenResponse.data.access_token;

  // Send email
  const emailPayload = {
    message: {
      subject: 'Your OTP for Quickdesk Signup',
      body: {
        contentType: 'HTML',
        content: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Email Verification</h2>
            <p>Thank you for signing up with Quickdesk!</p>
            <p>Your One-Time Password (OTP) is:</p>
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #4F46E5; font-size: 36px; letter-spacing: 5px; margin: 0;">${otp}</h1>
            </div>
            <p><strong>This OTP will expire in 3 minutes.</strong></p>
            <p>If you didn't request this OTP, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">This is an automated message, please do not reply.</p>
          </div>
        `,
      },
      toRecipients: [
        {
          emailAddress: {
            address: email,
          },
        },
      ],
    },
    saveToSentItems: false,
  };

  await axios.post(
    `https://graph.microsoft.com/v1.0/users/${notificationEmail}/sendMail`,
    emailPayload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

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

    // Find existing OTP record
    const existingOTP = await prisma.otp.findFirst({
      where: { email: email.toLowerCase() },
      orderBy: { createdAt: 'desc' },
    });

    if (!existingOTP) {
      return NextResponse.json(
        { message: 'No OTP request found. Please start the signup process again.' },
        { status: 400 }
      );
    }

    // Check resend limit
    if (existingOTP.resendCount >= 3) {
      // Delete OTP data
      await prisma.otp.deleteMany({
        where: { email: email.toLowerCase() },
      });
      return NextResponse.json(
        { message: 'Maximum OTP resend limit exceeded. Please start the signup process again.' },
        { status: 400 }
      );
    }

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes from now

    // Send OTP email
    await sendOTPEmail(email, otp);

    // Update OTP record
    await prisma.otp.update({
      where: { id: existingOTP.id },
      data: {
        otp,
        expiresAt,
        resendCount: existingOTP.resendCount + 1,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'OTP resent successfully',
      resendCount: existingOTP.resendCount + 1,
      expiresAt: expiresAt,
    });
  } catch (error: any) {
    console.error('Resend OTP error:', error);

    return NextResponse.json(
      { message: error.message || 'Failed to resend OTP' },
      { status: 500 }
    );
  }
}
