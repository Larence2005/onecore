
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState, useEffect, useRef } from "react";
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
import { createTicket, getAPISettings, getOrganizationMembers } from "@/app/actions";
import type { OrganizationMember, NewAttachment } from "@/app/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Send, RefreshCw, X, Paperclip } from "lucide-react";
import RichTextEditor from "./rich-text-editor";
import { useAuth } from "@/providers/auth-provider";
import { AutocompleteInput } from "./autocomplete-input";
import { Badge } from "./ui/badge";

const emailListRegex = /^$|^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(, *[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})*$/;

const formSchema = z.object({
  title: z.string().min(1, "Title is required."),
  body: z.string().min(1, "Description is required."),
  cc: z.string().regex(emailListRegex, { message: "Invalid CC email format." }).optional(),
  bcc: z.string().regex(emailListRegex, { message: "Invalid BCC email format." }).optional(),
});

export function CreateTicketForm() {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isSending, setIsSending] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchAdminEmail() {
        if (userProfile?.organizationId) {
            // This is a simplification. In a real app, you might fetch this from a dedicated settings endpoint.
            // For now, we assume the owner's email is the support email.
            const orgMembers = await getOrganizationMembers(userProfile.organizationId);
            const owner = orgMembers.find(m => m.uid === userProfile.organizationOwnerUid);
            if(owner?.email) {
                setAdminEmail(owner.email);
            }
            setMembers(orgMembers);
        }
    }
    fetchAdminEmail();
  }, [userProfile]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      body: "",
      cc: userProfile?.email || "",
      bcc: "",
    },
  });
  
  useEffect(() => {
      if(userProfile?.email && !form.getValues('cc')) {
          form.setValue('cc', userProfile.email);
      }
  }, [userProfile?.email, form]);

  const convertFileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
              const base64String = (reader.result as string).split(',')[1];
              resolve(base64String);
          };
          reader.onerror = error => reject(error);
      });
  };

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
      
      const attachmentPayloads: NewAttachment[] = await Promise.all(
          attachments.map(async (file) => ({
              name: file.name,
              contentType: file.type,
              contentBytes: await convertFileToBase64(file),
          }))
      );

      const result = await createTicket(userProfile.organizationId, author, values.title, values.body, attachmentPayloads, values.cc, values.bcc);
      
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) {
          setAttachments(prev => [...prev, ...Array.from(event.target.files!)]);
      }
  };

  const handleFileDrop = (files: FileList) => {
    setAttachments(prev => [...prev, ...Array.from(files)]);
  }

  const removeAttachment = (fileToRemove: File) => {
      setAttachments(prev => prev.filter(file => file !== fileToRemove));
  };
  
  const isCcVisible = showCc || !!form.watch('cc');
  const isBccVisible = showBcc || !!form.watch('bcc');

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
            <div className="flex items-center gap-2">
                <FormLabel htmlFor="to-address" className="py-2.5 text-sm font-medium">To</FormLabel>
                <Input id="to-address" value={adminEmail} readOnly disabled className="flex-1 h-auto px-0"/>
                 <div className="flex-shrink-0">
                    {!isCcVisible && <Button variant="link" size="sm" type="button" className="h-auto p-1 text-xs" onClick={() => setShowCc(true)}>Cc</Button>}
                    {!isBccVisible && <Button variant="link" size="sm" type="button" className="h-auto p-1 text-xs" onClick={() => setShowBcc(true)}>Bcc</Button>}
                 </div>
            </div>

            {isCcVisible && (
                <div className="flex items-center gap-2">
                    <FormLabel className="py-2.5 text-sm font-medium">Cc</FormLabel>
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
                <div className="flex items-center gap-2">
                    <FormLabel className="py-2.5 text-sm font-medium">Bcc</FormLabel>
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

             <div className="flex items-center gap-2">
                 <FormLabel className="py-2.5 text-sm font-medium">Title</FormLabel>
                 <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem className="flex-1">
                        <FormControl>
                            <Input placeholder="e.g., Cannot access my account" {...field} className="h-auto px-0"/>
                        </FormControl>
                        <FormMessage className="pt-2" />
                        </FormItem>
                    )}
                 />
             </div>

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
                      onAttachmentClick={() => fileInputRef.current?.click()}
                      onFileDrop={handleFileDrop}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <input
                type="file"
                ref={fileInputRef}
                multiple
                onChange={handleFileChange}
                className="hidden"
            />
            {attachments.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-medium">Attachments</h4>
                    <div className="flex flex-wrap gap-2">
                        {attachments.map((file, index) => (
                            <Badge key={index} variant="secondary" className="flex items-center gap-2">
                                <Paperclip className="h-3 w-3" />
                                <span>{file.name}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 rounded-full"
                                    onClick={() => removeAttachment(file)}
                                >
                                    <X className="h-3 w-3" />
                                    <span className="sr-only">Remove attachment</span>
                                </Button>
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

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
