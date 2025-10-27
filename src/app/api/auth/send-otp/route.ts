import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signUpSchema } from '@/lib/types';
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

    // Validate signup data
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

    // Check for existing OTP record
    const existingOTP = await prisma.otp.findFirst({
      where: { email: validatedData.email.toLowerCase() },
      orderBy: { createdAt: 'desc' },
    });

    // If there's a valid existing OTP (not expired), don't send a new one
    if (existingOTP && new Date() < existingOTP.expiresAt) {
      return NextResponse.json({
        success: true,
        message: 'An OTP has already been sent to your email. Please check your inbox or wait for it to expire.',
        email: validatedData.email,
        alreadySent: true,
      });
    }

    // Check if resend limit exceeded
    if (existingOTP && existingOTP.resendCount >= 3) {
      // Delete old OTP data if limit exceeded
      await prisma.otp.deleteMany({
        where: { email: validatedData.email.toLowerCase() },
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes from now

    // Send OTP email
    await sendOTPEmail(validatedData.email, otp);

    // Store or update OTP in database
    if (existingOTP && existingOTP.resendCount < 3) {
      // Update existing OTP only if under limit
      await prisma.otp.update({
        where: { id: existingOTP.id },
        data: {
          otp,
          expiresAt,
          resendCount: existingOTP.resendCount + 1,
          signupData: validatedData as any,
        },
      });
    } else {
      // Create new OTP record - starts at 1 since this is the first send
      await prisma.otp.create({
        data: {
          email: validatedData.email.toLowerCase(),
          otp,
          expiresAt,
          resendCount: 1,
          signupData: validatedData as any,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your email address',
      email: validatedData.email,
    });
  } catch (error: any) {
    console.error('Send OTP error:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        { message: 'Invalid input data', errors: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: error.message || 'Failed to send OTP' },
      { status: 500 }
    );
  }
}
