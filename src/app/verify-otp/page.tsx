"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/providers/auth-provider-new";
import { RefreshCw, Mail, ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function VerifyOTPPage() {
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
  const [verifyAttempts, setVerifyAttempts] = useState(0);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (!emailParam) {
      router.push("/signup");
      return;
    }
    setEmail(emailParam);
  }, [searchParams, router]);

  useEffect(() => {
    if (timeLeft <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

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
      // Check if max attempts exceeded
      if (error.message.includes("Maximum verification attempts exceeded")) {
        toast({
          variant: "destructive",
          title: "Too Many Failed Attempts",
          description: "Redirecting to signup page...",
        });
        
        setTimeout(() => {
          router.push("/signup");
        }, 2000);
      } else {
        // Increment local attempt counter
        setVerifyAttempts((prev) => prev + 1);
        
        toast({
          variant: "destructive",
          title: "Verification Failed",
          description: error.message,
        });
      }
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

      setTimeLeft(180); // Reset timer to 3 minutes
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

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
              <Mail className="h-8 w-8 text-primary" />
            </div>
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
              <label className="block text-sm font-medium mb-2">
                Enter OTP
              </label>
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
                  OTP has expired
                </p>
              )}
              <div className="flex justify-center gap-4 mt-1">
                {verifyAttempts < 3 && (
                  <p className="text-xs text-muted-foreground">
                    Verification attempts: {verifyAttempts}/3
                  </p>
                )}
                {resendCount < 3 && (
                  <p className="text-xs text-muted-foreground">
                    Resends: {resendCount}/3
                  </p>
                )}
              </div>
            </div>

            <Button
              onClick={handleVerifyOTP}
              className="w-full font-bold py-3"
              disabled={isVerifying || otp.length !== 6}
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify OTP"
              )}
            </Button>

            <Button
              onClick={handleResendOTP}
              variant="outline"
              className="w-full"
              disabled={!canResend || isResending || resendCount >= 3}
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
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          @2025 | All Rights Reserved
        </p>
      </div>
    </div>
  );
}
