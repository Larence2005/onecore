
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState } from "react";
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
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";
import Image from "next/image";
import { memberSignUpSchema } from "@/lib/types";

export default function MemberSignupPage() {
  const { memberSignup } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof memberSignUpSchema>>({
    resolver: zodResolver(memberSignUpSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: z.infer<typeof memberSignUpSchema>) {
    setIsSubmitting(true);
    try {
      await memberSignup(values);
      router.push("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message || "An unknown error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="flex w-full max-w-4xl rounded-lg shadow-lg overflow-hidden bg-card">
        <div className="hidden md:flex flex-col items-center justify-between w-1/2 bg-foreground text-background p-12 text-center">
            <div>
                <h3 className="text-3xl font-bold">Onecore Support</h3>
                <p className="text-lg mt-2">Your unified ticketing system</p>
            </div>
            <Image src="/logo.png" alt="Company Logo" width={200} height={200} />
            <div>
              <p className="text-xs">© 2025 | All Rights Reserved</p>
            </div>
        </div>

        <div className="w-full md:w-1/2 p-8 sm:p-12">
            <div className="mb-8 text-left">
                <h2 className="text-2xl font-bold text-primary">Member Registration</h2>
                <p className="text-muted-foreground">Create your account to join your organization.</p>
            </div>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="font-semibold">Email Address</FormLabel>
                        <FormControl>
                            <Input type="email" placeholder="your-invited-email@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel className="font-semibold">Password</FormLabel>
                      <FormControl>
                          <Input type="password" placeholder="********" {...field} />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
                  />
                  <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel className="font-semibold">Confirm Password</FormLabel>
                      <FormControl>
                          <Input type="password" placeholder="********" {...field} />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
                  />
                </div>
                <Button type="submit" className="w-full font-bold py-3" disabled={isSubmitting}>
                {isSubmitting ? (
                    <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Registering...
                    </>
                ) : (
                    "REGISTER"
                )}
                </Button>
            </form>
            </Form>
            <div className="mt-8 text-center text-sm">
                <p>Already have an account? <Link href="/" className="font-medium text-primary hover:underline">Log in</Link></p>
            </div>
        </div>
      </div>
    </div>
  );
}
