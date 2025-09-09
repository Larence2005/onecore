
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
import { CheckCircle } from "lucide-react";

const formSchema = z.object({
  clientId: z.string().min(1, "Client ID is required."),
  tenantId: z.string().min(1, "Tenant ID is required."),
  clientSecret: z.string().min(1, "Client Secret is required."),
});

export function SettingsForm() {
  const { settings, saveSettings, isConfigured } = useSettings();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: {
      clientId: settings.clientId,
      tenantId: settings.tenantId,
      clientSecret: settings.clientSecret,
    },
  });

  useEffect(() => {
    // If settings are not configured, always be in editing mode.
    // Otherwise, start in view mode.
    if (!isConfigured) {
      setIsEditing(true);
    } else {
        setIsEditing(false);
    }
  }, [isConfigured]);
  
  const handleCancel = () => {
    form.reset({
        clientId: settings.clientId,
        tenantId: settings.tenantId,
        clientSecret: settings.clientSecret,
    });
    // Only allow canceling back to view mode if settings were already configured.
    if(isConfigured) {
        setIsEditing(false);
    }
  };

  function onSubmit(values: z.infer<typeof formSchema>) {
    saveSettings(values);
    toast({
      title: "Settings Saved",
      description: "Your Microsoft Graph API credentials have been updated.",
    });
    setIsEditing(false);
  }

  // If settings are configured and we are not in editing mode, show the success state.
  if (isConfigured && !isEditing) {
    return (
        <Card className="max-w-md w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-6 w-6 text-green-500" />
                    API Configured
                </CardTitle>
                <CardDescription>
                    Your API credentials are saved and active.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">
                    Your application is connected to the Microsoft Graph API. You can now send and receive emails.
                </p>
            </CardContent>
            <CardFooter>
                 <Button onClick={() => setIsEditing(true)}>Edit Settings</Button>
            </CardFooter>
        </Card>
    );
  }

  // Otherwise, show the form (either for initial setup or for editing).
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
                            <Input placeholder="Enter your Client ID" {...field} />
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
                            <Input placeholder="Enter your Tenant ID" {...field} />
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
                            <Input type="password" placeholder={field.value ? "**********" : "Enter your Client Secret"} {...field} />
                        </FormControl>
                        <FormDescription>
                            Your client secret is sensitive and will be stored securely.
                        </FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                   {isConfigured && <Button type="button" variant="ghost" onClick={handleCancel}>Cancel</Button>}
                   <Button type="submit">Save Settings</Button>
                </CardFooter>
            </form>
        </Form>
    </Card>
  );
}
