"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/providers/auth-provider-new";
import { RefreshCw, Mail, ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

function VerifyOTPContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { login } = useAuth();
  
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes in seconds
  const [canResend, setCanResend] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const [email, setEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (!emailParam) {
      router.push("/signup");
      return;
    }
    setEmail(emailParam);
    
    // Fetch OTP expiration time from server
    const fetchOTPExpiration = async () => {
      try {
        const response = await fetch(`/api/auth/get-otp-expiration?email=${encodeURIComponent(emailParam)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.expiresAt) {
            setExpiresAt(new Date(data.expiresAt));
            setResendCount(data.resendCount || 0);
          }
        } else if (response.status === 404) {
          // No OTP found, redirect to signup
          toast({
            variant: "destructive",
            title: "No OTP Found",
            description: "Please start the signup process again.",
          });
          router.push("/signup");
        }
      } catch (error) {
        console.error('Failed to fetch OTP expiration:', error);
      }
    };
    
    fetchOTPExpiration();
  }, [searchParams, router, toast]);

  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = async () => {
      const now = new Date().getTime();
      const expiry = expiresAt.getTime();
      const secondsLeft = Math.max(0, Math.floor((expiry - now) / 1000));
      
      setTimeLeft(secondsLeft);
      
      if (secondsLeft <= 0) {
        // Check if this is the last attempt (resendCount >= 3)
        if (resendCount >= 3 && !isExpired) {
          // Delete OTP record and show expiration message
          setIsExpired(true);
          try {
            await fetch('/api/auth/delete-expired-otp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email }),
            });
          } catch (error) {
            console.error('Failed to delete expired OTP:', error);
          }
        } else if (resendCount < 3) {
          setCanResend(true);
        }
      }
    };

    // Update immediately
    updateTimer();

    // Then update every second
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, resendCount, email, toast, router]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast({
        variant: "destructive",
        title: "Invalid OTP",
        description: "Please enter a 6-digit OTP",
      });
      return;
    }

    setIsVerifying(true);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to verify OTP");
      }

      toast({
        title: "Success!",
        description: "Email verified successfully. Logging you in...",
      });

      // Get password from signup data (we need to store it temporarily)
      const password = searchParams.get("password");
      
      if (password) {
        // Automatically log in the user
        await login({ email, password });
        
        // Redirect to dashboard
        setTimeout(() => {
          router.push("/dashboard");
        }, 1000);
      } else {
        // If no password in URL, redirect to login
        setTimeout(() => {
          router.push("/login");
        }, 1500);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: error.message,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCount >= 3) {
      toast({
        variant: "destructive",
        title: "Maximum Resend Limit Reached",
        description: "Please start the signup process again.",
      });
      setTimeout(() => {
        router.push("/signup");
      }, 2000);
      return;
    }

    setIsResending(true);
    try {
      const response = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to resend OTP");
      }

      toast({
        title: "OTP Resent",
        description: "A new OTP has been sent to your email",
      });

      // Update expiration time from server response
      if (data.expiresAt) {
        setExpiresAt(new Date(data.expiresAt));
      }
      setCanResend(false);
      setResendCount((prev) => prev + 1);
      setOtp(""); // Clear OTP input
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Resend Failed",
        description: error.message,
      });
      
      // If max limit exceeded, redirect to signup
      if (error.message.includes("Maximum OTP resend limit exceeded")) {
        setTimeout(() => {
          router.push("/signup");
        }, 2000);
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleOTPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ""); // Only allow digits
    if (value.length <= 6) {
      setOtp(value);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg shadow-lg p-8">
          <div className="flex flex-col items-center mb-8">
            <Image
              src="/quickdesk_logowithtext_nobg.png"
              alt="Quickdesk Logo"
              width={200}
              height={200}
              unoptimized
            />
          </div>

          {isExpired ? (
            <div className="text-center space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-destructive mb-4">
                  Verification Expired
                </h2>
                <p className="text-muted-foreground mb-2">
                  Verification reaches its limits.
                </p>
                <p className="text-muted-foreground">
                  All the data you filled out were deleted in database.
                </p>
              </div>
              
              <div className="flex justify-center">
                <Button
                  onClick={() => router.push('/signup')}
                  className="w-48 font-bold py-3"
                >
                  Signup Again
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Verify Your Email
                </h2>
                <p className="text-muted-foreground text-sm">
                  We've sent a 6-digit OTP to
                </p>
                <p className="text-foreground font-medium">{email}</p>
              </div>

          <div className="space-y-6">
            <div>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={handleOTPChange}
                placeholder="000000"
                className="text-center text-2xl tracking-widest font-bold"
                disabled={isVerifying}
              />
            </div>

            <div className="text-center">
              {timeLeft > 0 ? (
                <p className="text-sm text-muted-foreground">
                  OTP expires in{" "}
                  <span className="font-bold text-foreground">
                    {formatTime(timeLeft)}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-destructive font-medium">
                  {resendCount >= 3 ? 'Verification expired. Redirecting...' : 'OTP has expired'}
                </p>
              )}
              <div className="flex justify-center gap-4 mt-1">
                <p className="text-xs text-muted-foreground">
                  Attemps: {resendCount}/3
                </p>
              </div>
            </div>

            <div className="flex justify-center">
              {timeLeft > 0 ? (
                <Button
                  onClick={handleVerifyOTP}
                  className="w-48 font-bold py-3"
                  disabled={isVerifying || otp.length !== 6}
                >
                {isVerifying ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify"
                )}
                </Button>
              ) : (
                <Button
                  onClick={handleResendOTP}
                  variant="outline"
                  className="w-48"
                  disabled={isResending || resendCount >= 3}
                >
                {isResending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Resending...
                  </>
                ) : (
                  "Resend OTP"
                )}
                </Button>
              )}
            </div>

              <div className="text-center">
                <Link
                  href="/signup"
                  className="inline-flex items-center text-sm text-primary hover:underline"
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back to Signup
                </Link>
              </div>
            </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          @2025 | All Rights Reserved
        </p>
      </div>
    </div>
  );
}

export default function VerifyOTPPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <VerifyOTPContent />
    </Suspense>
  );
}
