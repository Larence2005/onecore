
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
import { signUpSchema } from "@/lib/types";
import { Separator } from "@/components/ui/separator";


export default function SignupPage() {
  const { signup } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      organizationName: "",
      domain: "",
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: z.infer<typeof signUpSchema>) {
    setIsSubmitting(true);
    try {
      await signup(values);
      router.push("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sign-up Failed",
        description: error.message || "An unknown error occurred.",
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
            <div className="mb-8 text-left">
                <h2 className="text-2xl font-bold text-primary">Create Your Admin Account</h2>
            </div>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                    control={form.control}
                    name="organizationName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="font-semibold">Organization Name</FormLabel>
                        <FormControl>
                            <Input placeholder="Your Company, Inc." {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="domain"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="font-semibold">Domain</FormLabel>
                        <FormControl>
                            <Input placeholder="your-company.com" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                 <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="font-semibold">Email Address</FormLabel>
                    <FormControl>
                        <Input type="email" placeholder="your@email.com" {...field} />
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
                    Creating account...
                    </>
                ) : (
                    "SUBMIT"
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
