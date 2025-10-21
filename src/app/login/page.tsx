
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';

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
import { useAuth } from "@/providers/auth-provider-new";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import Image from "next/image";
import { LockoutError } from "@/providers/auth-provider-new";
import { Separator } from "@/components/ui/separator";

const formSchema = z.object({
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  remember: z.boolean().optional(),
});

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockoutEndTime) {
      const updateTimer = () => {
        const remaining = Math.ceil((lockoutEndTime - Date.now()) / 1000);
        if (remaining > 0) {
          setTimeRemaining(remaining);
        } else {
          setLockoutEndTime(null);
          setTimeRemaining(0);
        }
      };
      updateTimer();
      timer = setInterval(updateTimer, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutEndTime]);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: false,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      await login(values);
      router.push("/dashboard");
    } catch (error: any) {
       if (error instanceof LockoutError) {
        setLockoutEndTime(error.lockoutUntil);
      } else {
        toast({
            variant: "destructive",
            title: "Login Failed",
            description: error.message || "An unknown error occurred.",
        });
      }
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
            <h2 className="text-xl font-light">Hello!</h2>
            <p className="text-2xl font-bold text-primary">Login Your Account</p>
          </div>

          {lockoutEndTime ? (
            <div className="space-y-4 text-center">
                <p className="font-semibold text-destructive">Too many failed login attempts.</p>
                <p className="text-muted-foreground">For your security, your account has been temporarily locked.</p>
                <p>Please try again in:</p>
                <div className="text-4xl font-bold text-primary">{timeRemaining}s</div>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
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
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="********"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-between text-sm">
                  <FormField
                    control={form.control}
                    name="remember"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">Remember me</FormLabel>
                      </FormItem>
                    )}
                  />
                  <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                    Forgot Password?
                  </Link>
                </div>

                <Button type="submit" className="w-full font-bold py-3" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Please wait
                    </>
                  ) : (
                    "SUBMIT"
                  )}
                </Button>
              </form>
            </Form>
          )}

          <div className="mt-8 text-center text-sm">
            <p>
                <Link href="/signup" className="font-medium text-primary hover:underline">
                    Create Admin Account
                </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
