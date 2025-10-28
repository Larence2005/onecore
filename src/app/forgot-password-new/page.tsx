"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RefreshCw } from "lucide-react";
import Image from "next/image";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const emailSchema = z.object({
  email: z.string().email("Invalid email address."),
});

const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
});

const passwordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type Step = 'email' | 'otp' | 'password' | 'success';

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onEmailSubmit(values: z.infer<typeof emailSchema>) {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/forgot-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email }),
      });

      const data = await response.json();

      if (response.ok) {
        // Check if OTP was actually sent
        if (data.sent) {
          setEmail(values.email);
          setStep('otp');
          toast({
            title: "OTP Sent",
            description: "Please check your email for the verification code.",
          });
        } else {
          // Email not found in database, show error
          toast({
            variant: "destructive",
            title: "Email Not Found",
            description: "This email is not registered in our system. Please check your email or sign up for a new account.",
          });
        }
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.message || "Failed to send OTP",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send OTP. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onOtpSubmit(values: z.infer<typeof otpSchema>) {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/forgot-password/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: values.otp }),
      });

      const data = await response.json();

      if (response.ok) {
        setOtp(values.otp);
        setStep('password');
        toast({
          title: "OTP Verified",
          description: "Please enter your new password.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.message || "Invalid OTP",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to verify OTP. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onPasswordSubmit(values: z.infer<typeof passwordSchema>) {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/forgot-password/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          otp, 
          newPassword: values.password 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStep('success');
        toast({
          title: "Password Reset Successful",
          description: "You can now login with your new password.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.message || "Failed to reset password",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reset password. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="flex w-full max-w-4xl rounded-lg shadow-lg overflow-hidden bg-card">
        <div className="hidden md:flex w-1/2 flex-col items-center justify-center p-12 bg-gray-100 dark:bg-zinc-900 relative">
          <Image src="/quickdesk_logowithtext_nobg.png" alt="Quickdesk Logo" width={250} height={250} unoptimized />
          <p className="absolute bottom-12 text-xs text-muted-foreground">@2025 | All Rights Reserved</p>
        </div>
        <div className="w-full md:w-1/2 p-8 sm:p-12">
          <div className="md:hidden flex flex-col items-center justify-center mb-8">
            <Image src="/quickdesk_logowithtext_nobg.png" alt="Quickdesk Logo" width={200} height={200} unoptimized />
          </div>
          
          <div className="mb-8 text-left">
            <h2 className="text-2xl font-bold text-primary">
              {step === 'email' && 'Forgot Password'}
              {step === 'otp' && 'Verify OTP'}
              {step === 'password' && 'Reset Password'}
              {step === 'success' && 'Success!'}
            </h2>
            <p className="text-muted-foreground">
              {step === 'email' && 'Enter your email to receive a verification code'}
              {step === 'otp' && 'Please enter the 6-digit verification code sent to your email. If you don’t see it, check your spam/junk folder.'}
              {step === 'password' && 'Enter your new password'}
              {step === 'success'}
            </p>
          </div>

          {step === 'email' && (
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-6">
                <FormField
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">Email Address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="your@email.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full font-bold py-3" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "SEND VERIFICATION CODE"
                  )}
                </Button>
              </form>
            </Form>
          )}

          {step === 'otp' && (
            <Form {...otpForm}>
              <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-6">
                <FormField
                  control={otpForm.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="flex justify-center">
                          <InputOTP maxLength={6} {...field}>
                            <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                              <InputOTPSlot index={3} />
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full font-bold py-3" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "VERIFY OTP"
                  )}
                </Button>
              </form>
            </Form>
          )}

          {step === 'password' && (
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                <FormField
                  control={passwordForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter new password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">Confirm Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Confirm new password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full font-bold py-3" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    "RESET PASSWORD"
                  )}
                </Button>
              </form>
            </Form>
          )}

          {step === 'success' && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-6">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-1">
                    Password Successfully Changed!
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    You can now use your new password to log in.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 text-center text-sm">
            <p>
              <Link href="/login" className="font-medium text-primary hover:underline">
                Back to Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
