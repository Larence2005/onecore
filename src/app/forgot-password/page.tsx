
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
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

const formSchema = z.object({
  email: z.string().email("Invalid email address."),
});

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      await sendPasswordReset(values.email);
      setSubmitted(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send password reset email.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="flex w-full max-w-4xl rounded-lg shadow-lg overflow-hidden bg-card">
        <div className="hidden md:block w-1/2 bg-gradient-to-br from-blue-500 to-blue-700" />
        <div className="w-full md:w-1/2 p-8 sm:p-12">
            <div className="mb-8 text-left">
                <h2 className="text-2xl font-bold text-primary">Forgot Password</h2>
                <p className="text-muted-foreground">
                    {submitted 
                        ? "Check your email for a password reset link." 
                        : "Enter your email to receive a password reset link."
                    }
                </p>
            </div>
            {!submitted ? (
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
                        <Button type="submit" className="w-full font-bold py-3" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                Sending...
                                </>
                            ) : (
                                "SEND RESET LINK"
                            )}
                        </Button>
                    </form>
                </Form>
            ) : (
                <div className="text-center">
                    <p className="text-green-600 font-semibold mb-4">
                        Password reset email has been sent successfully.
                    </p>
                    <p className="text-muted-foreground text-sm">
                        It might take a few minutes to arrive. Please also check your spam folder.
                    </p>
                </div>
            )}
             <div className="mt-8 text-center text-sm">
                <p>
                    <Link href="/" className="font-medium text-primary hover:underline">
                        Back to Login
                    </Link>
                </p>
            </div>
        </div>
      </div>
    </div>
  );
}
