
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/providers/settings-provider";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "./ui/card";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  clientId: z.string().min(1, "Client ID is required."),
  tenantId: z.string().min(1, "Tenant ID is required."),
  clientSecret: z.string().min(1, "Client Secret is required."),
});

export function SettingsForm() {
  const { settings, saveSettings, isConfigured } = useSettings();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(!isConfigured);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: {
      clientId: settings.clientId,
      tenantId: settings.tenantId,
      clientSecret: settings.clientSecret,
    },
  });

  useEffect(() => {
    // If the component loads and settings are not configured, force editing mode.
    // Otherwise, respect the user's choice to toggle.
    if (!isConfigured) {
      setIsEditing(true);
    }
  }, [isConfigured]);
  
  const handleCancel = () => {
    form.reset({
        clientId: settings.clientId,
        tenantId: settings.tenantId,
        clientSecret: settings.clientSecret,
    });
    setIsEditing(false);
  };

  function onSubmit(values: z.infer<typeof formSchema>) {
    saveSettings(values);
    toast({
      title: "Settings Saved",
      description: "Your Microsoft Graph API credentials have been updated.",
    });
    setIsEditing(false);
  }

  return (
    <Card className="max-w-2xl w-full">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle className="font-headline">API Settings</CardTitle>
                    <CardDescription>
                    Configure your Microsoft Graph API credentials. Your email is automatically set to your login email. These settings are stored securely and associated with your account.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Client ID</FormLabel>
                        <FormControl>
                            <Input placeholder="Enter your Client ID" {...field} disabled={!isEditing} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="tenantId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Tenant ID</FormLabel>
                        <FormControl>
                            <Input placeholder="Enter your Tenant ID" {...field} disabled={!isEditing} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="clientSecret"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Client Secret</FormLabel>
                        <FormControl>
                            <Input type="password" placeholder={field.value ? "**********" : "Enter your Client Secret"} {...field} disabled={!isEditing} />
                        </FormControl>
                        {!isEditing && isConfigured && (
                            <FormDescription>
                                Your client secret is saved. Click Edit to change it.
                            </FormDescription>
                        )}
                         {isEditing && (
                            <FormDescription>
                                Your client secret is sensitive and will be stored securely.
                            </FormDescription>
                        )}
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    {isEditing ? (
                        <>
                           {isConfigured && <Button type="button" variant="ghost" onClick={handleCancel}>Cancel</Button>}
                           <Button type="submit">Save Settings</Button>
                        </>
                    ) : (
                        <Button type="button" onClick={() => setIsEditing(true)}>Edit</Button>
                    )}
                </CardFooter>
            </form>
        </Form>
    </Card>
  );
}
