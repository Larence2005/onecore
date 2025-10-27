# Forgot Password with OTP Implementation

## Overview
Implemented a secure forgot password flow using OTP (One-Time Password) verification sent via email using the `EMAIL_NOTIFICATION` from your `.env` file.

## Flow

1. **User enters email** → System sends 6-digit OTP to email
2. **User enters OTP** → System verifies the code
3. **User sets new password** → Password is reset
4. **Success** → User redirected to login

## Files Created

### API Routes

1. **`/api/auth/forgot-password/send-otp/route.ts`**
   - Generates 6-digit OTP
   - Stores OTP in database (expires in 10 minutes)
   - Sends OTP email using Microsoft Graph API via `EMAIL_NOTIFICATION`

2. **`/api/auth/forgot-password/verify-otp/route.ts`**
   - Validates OTP code
   - Checks expiration
   - Returns verification status

3. **`/api/auth/forgot-password/reset-password/route.ts`**
   - Verifies OTP one more time
   - Hashes new password with bcrypt
   - Updates user password
   - Deletes used OTP

### Frontend

4. **`/src/app/forgot-password-new/page.tsx`**
   - Multi-step form (Email → OTP → Password → Success)
   - Uses shadcn/ui components
   - OTP input with 6 slots
   - Password confirmation validation

### Database

5. **Updated `prisma/schema.prisma`**
   - Added `PasswordResetOtp` model:
     ```prisma
     model PasswordResetOtp {
       id        String   @id @default(cuid())
       email     String
       otp       String
       expiresAt DateTime
       createdAt DateTime @default(now())
       @@index([email])
       @@index([otp])
     }
     ```

## Setup Instructions

### 1. Update Database Credentials

First, make sure your `.env` file has the correct database credentials:

```env
DATABASE_URL="postgresql://quickdesk:YOUR_PASSWORD@localhost:5432/quickdesk"
```

### 2. Sync Database Schema

Run this command to create the `PasswordResetOtp` table:

```bash
npx prisma db push
```

Or if you prefer migrations:

```bash
npx prisma migrate dev --name add_password_reset_otp
```

### 3. Generate Prisma Client

```bash
npx prisma generate
```

This will resolve the TypeScript errors about `passwordResetOtp` not existing.

### 4. Verify Environment Variables

Make sure these are in your `.env`:

```env
# Email Configuration (Required for OTP)
EMAIL_NOTIFICATION="your-notification-email@yourdomain.com"
AZURE_CLIENT_ID="your-azure-client-id"
AZURE_TENANT_ID="your-azure-tenant-id"
AZURE_CLIENT_SECRET="your-azure-client-secret"

# Database
DATABASE_URL="postgresql://quickdesk:password@localhost:5432/quickdesk"

# NextAuth
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:9002"
```

### 5. Test the Flow

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Go to login page: `http://localhost:9002/login`

3. Click "Forgot Password?"

4. Enter your email and follow the steps

## Features

✅ **Secure OTP Generation** - 6-digit random code  
✅ **Email Delivery** - Uses your Microsoft Graph API setup  
✅ **Expiration** - OTP expires after 10 minutes  
✅ **One-time Use** - OTP deleted after successful password reset  
✅ **Password Validation** - Minimum 8 characters  
✅ **Password Confirmation** - Must match  
✅ **User-friendly UI** - Multi-step form with progress indicators  

## Security Features

- OTP stored with expiration timestamp
- Used OTPs are immediately deleted
- Passwords hashed with bcrypt (12 rounds)
- Email validation on all steps
- Rate limiting can be added (similar to signup OTP)

## Email Template

The OTP email includes:
- Clear subject: "Password Reset OTP - Quickdesk"
- Large, centered OTP code
- 10-minute expiration notice
- Security warning if user didn't request reset

## Troubleshooting

### Database Connection Error

If you get authentication errors:
1. Check your `DATABASE_URL` in `.env`
2. Verify PostgreSQL is running: `sudo systemctl status postgresql`
3. Test connection: `psql -U quickdesk -d quickdesk`

### Prisma Client Errors

If you see "Property 'passwordResetOtp' does not exist":
1. Run `npx prisma db push`
2. Run `npx prisma generate`
3. Restart your dev server

### Email Not Sending

1. Verify `EMAIL_NOTIFICATION` is set correctly
2. Check Azure credentials are valid
3. Check server logs for detailed error messages

## Next Steps

Optional enhancements:
- Add resend OTP functionality
- Add rate limiting (max 3 attempts per hour)
- Add OTP attempt counter
- Send confirmation email after password reset
- Add password strength indicator

## Migration from Old Flow

The old `/forgot-password` page still exists but is not linked.  
New flow is at `/forgot-password-new` and is linked from the login page.

You can safely delete `/src/app/forgot-password/page.tsx` after testing the new flow.
