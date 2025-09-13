
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
import { Checkbox } from "@/components/ui/checkbox";
import Image from "next/image";

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
      router.push("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Failed",
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
            <h2 className="text-xl font-light">Hello!</h2>
            <p className="text-2xl font-bold text-primary">Login Your Account</p>
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
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        {...field}
                        className="bg-transparent border-0 border-b rounded-none px-0 focus:ring-0"
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
                        className="bg-transparent border-0 border-b rounded-none px-0 focus:ring-0"
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
                <Link href="#" className="font-medium text-primary hover:underline">
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

          <div className="mt-8 text-center text-sm">
            <p>
                <Link href="/signup" className="font-medium text-primary hover:underline">
                    Create Admin Account
                </Link>
            </p>
            <p className="mt-2">
                <Link href="/member-signup" className="font-medium text-primary hover:underline">
                    Invited to an organization? Register here
                </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
