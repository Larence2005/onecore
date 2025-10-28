import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import axios from 'axios';

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP email for password reset
async function sendPasswordResetOTP(email: string, otp: string): Promise<void> {
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
      subject: 'Password Reset OTP - Quickdesk',
      body: {
        contentType: 'HTML',
        content: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>You have requested to reset your password for your Quickdesk account.</p>
            <p>Your One-Time Password (OTP) is:</p>
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #4F46E5; font-size: 36px; letter-spacing: 5px; margin: 0;">${otp}</h1>
            </div>
            <p>This OTP will expire in 10 minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this password reset, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">This is an automated message from Quickdesk. Please do not reply to this email.</p>
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
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { message: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user exists in User table (this is the login email)
    // Only accept emails from User table, not OrganizationMember emails
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // User not found - return generic message for security
      // (Don't reveal whether email exists or not)
      return NextResponse.json(
        { 
          message: 'If an account exists with this email, you will receive a password reset code.',
          sent: false // Flag to indicate OTP was not sent
        },
        { status: 200 }
      );
    }

    const userEmail = email.toLowerCase();

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing password reset OTP for the login email
    await prisma.passwordResetOtp.deleteMany({
      where: { email: userEmail },
    });

    // Store OTP in database with the login email (User table email)
    // This is important because password reset needs to match the login email
    await prisma.passwordResetOtp.create({
      data: {
        email: userEmail, // Store with login email
        otp,
        expiresAt,
      },
    });

    // Send OTP email to the email address they entered
    await sendPasswordResetOTP(email, otp);

    return NextResponse.json(
      { 
        message: 'If an account exists with this email, you will receive a password reset code.',
        sent: true // Flag to indicate OTP was sent
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error sending password reset OTP:', error);
    return NextResponse.json(
      { message: 'Failed to send password reset code. Please try again.' },
      { status: 500 }
    );
  }
}
