
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState, useEffect } from "react";

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
import { useSettings } from "@/providers/settings-provider";
import { useToast } from "@/hooks/use-toast";
import { sendEmailAction, getOrganizationMembers } from "@/app/actions";
import type { OrganizationMember } from "@/app/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Terminal, Send, RefreshCw } from "lucide-react";
import RichTextEditor from "./rich-text-editor";
import { AutocompleteInput } from "./autocomplete-input";
import { useAuth } from "@/providers/auth-provider";

const emailListRegex = /^$|^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(, *[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})*$/;

const formSchema = z.object({
  recipient: z.string().email("Invalid email address."),
  cc: z.string().regex(emailListRegex, { message: "Invalid CC email format." }).optional(),
  bcc: z.string().regex(emailListRegex, { message: "Invalid BCC email format." }).optional(),
  subject: z.string().min(1, "Subject is required."),
  body: z.string().min(1, "Email body is required."),
});

export function SendEmailForm() {
  const { settings, isConfigured } = useSettings();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  useEffect(() => {
    async function fetchMembers() {
        if (userProfile?.organizationId) {
            const orgMembers = await getOrganizationMembers(userProfile.organizationId);
            setMembers(orgMembers);
        }
    }
    fetchMembers();
  }, [userProfile]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipient: "",
      cc: "",
      bcc: "",
      subject: "",
      body: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!isConfigured) {
        toast({
            variant: "destructive",
            title: "Configuration Error",
            description: "Please configure your API settings first.",
        });
        return;
    }
    setIsSending(true);
    try {
      await sendEmailAction(settings, values);
      toast({
        title: "Email Sent!",
        description: `Your email to ${values.recipient} has been sent successfully.`,
      });
      form.reset();
      setShowCc(false);
      setShowBcc(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: error instanceof Error ? error.message : "Failed to send email.",
      });
    } finally {
      setIsSending(false);
    }
  }
  
    const isCcVisible = showCc || !!form.watch('cc');
    const isBccVisible = showBcc || !!form.watch('bcc');
  
  if (!isConfigured) {
    return (
        <Alert className="max-w-2xl mx-auto">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Configuration Required</AlertTitle>
            <AlertDescription>
                Please go to the Settings tab to configure your Microsoft Graph API credentials before you can send emails.
            </AlertDescription>
        </Alert>
    );
  }

  return (
    <Card className="max-w-2xl w-full">
      <CardHeader>
        <CardTitle className="font-headline">Compose Email</CardTitle>
        <CardDescription>
          Send an email using the configured Microsoft Graph API account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex items-center gap-2 border-b">
                 <FormLabel className="py-2.5">To</FormLabel>
                 <FormField
                    control={form.control}
                    name="recipient"
                    render={({ field }) => (
                        <FormItem className="flex-1">
                        <FormControl>
                            <Input placeholder="name@example.com" {...field} className="h-auto px-0"/>
                        </FormControl>
                        <FormMessage className="pt-2"/>
                        </FormItem>
                    )}
                 />
                 <div className="flex-shrink-0">
                    {!isCcVisible && <Button variant="link" size="sm" type="button" className="h-auto p-1 text-xs" onClick={() => setShowCc(true)}>Cc</Button>}
                    {!isBccVisible && <Button variant="link" size="sm" type="button" className="h-auto p-1 text-xs" onClick={() => setShowBcc(true)}>Bcc</Button>}
                 </div>
            </div>
            
            {isCcVisible && (
                <div className="flex items-center gap-2 border-b">
                    <FormLabel className="py-2.5">Cc</FormLabel>
                    <FormField
                        control={form.control}
                        name="cc"
                        render={({ field }) => (
                            <FormItem className="flex-1">
                            <FormControl>
                                <AutocompleteInput 
                                {...field}
                                suggestions={members}
                                placeholder="cc@example.com" 
                                className="h-auto px-0"
                                />
                            </FormControl>
                            <FormMessage className="pt-2"/>
                            </FormItem>
                        )}
                    />
                </div>
            )}
            {isBccVisible && (
                <div className="flex items-center gap-2 border-b">
                    <FormLabel className="py-2.5">Bcc</FormLabel>
                    <FormField
                        control={form.control}
                        name="bcc"
                        render={({ field }) => (
                            <FormItem className="flex-1">
                            <FormControl>
                                <AutocompleteInput 
                                {...field}
                                suggestions={members}
                                placeholder="bcc@example.com" 
                                className="h-auto px-0"
                                />
                            </FormControl>
                            <FormMessage className="pt-2"/>
                            </FormItem>
                        )}
                    />
                </div>
            )}
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Your email subject" {...field} />
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
                  <FormLabel>Body</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      value={field.value}
                      onChange={field.onChange}
                      onAttachmentClick={() => {
                        toast({
                          title: "Attachments not supported",
                          description: "This feature is not yet implemented for new emails."
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
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Email
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
