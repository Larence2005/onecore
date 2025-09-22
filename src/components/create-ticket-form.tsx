
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { useToast } from "@/hooks/use-toast";
import { createTicket } from "@/app/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Send, RefreshCw } from "lucide-react";
import RichTextEditor from "./rich-text-editor";
import { useAuth } from "@/providers/auth-provider";
import { useSettings } from "@/providers/settings-provider";

const formSchema = z.object({
  title: z.string().min(1, "Title is required."),
  body: z.string().min(1, "Description is required."),
});

export function CreateTicketForm() {
  const { user, userProfile } = useAuth();
  const { settings, isConfigured } = useSettings();
  const { toast } = useToast();
  const router = useRouter();
  const [isSending, setIsSending] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      body: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!userProfile?.organizationId || !user) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not create ticket. User or organization not found.",
        });
        return;
    }

    setIsSending(true);
    try {
      const author = { uid: user.uid, name: userProfile.name || user.email!, email: user.email! };
      const result = await createTicket(userProfile.organizationId, author, values.title, values.body, isConfigured ? settings : null);
      
      if (result.success && result.id) {
        toast({
          title: "Ticket Created!",
          description: `Your ticket has been submitted successfully.`,
        });
        router.push(`/tickets/${result.id}`);
      } else {
        throw new Error(result.error || "An unknown error occurred.");
      }

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: error instanceof Error ? error.message : "Failed to create ticket.",
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Card className="max-w-2xl w-full">
      <CardHeader>
        <CardTitle>Create a New Ticket</CardTitle>
        <CardDescription>
          Fill out the form below to submit a new support ticket.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Cannot access my account" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Describe your issue</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      value={field.value}
                      onChange={field.onChange}
                      onAttachmentClick={() => {
                        toast({
                          title: "Attachments not supported yet",
                          description: "This feature is not yet implemented.",
                        })
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSending}>
              {isSending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit Ticket
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
