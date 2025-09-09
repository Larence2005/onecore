
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState, useEffect } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
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
import { CheckCircle, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

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
  
  const handleDeleteAccount = () => {
    // Placeholder for account deletion logic
    toast({
        variant: "destructive",
        title: "Account Deletion Requested",
        description: "This feature is not yet implemented.",
    });
  }

  // If settings are configured and we are not in editing mode, show the success state.
  if (isConfigured && !isEditing) {
    return (
        <div className="w-full max-w-2xl space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle className="h-6 w-6 text-green-500" />
                            API Configured
                        </CardTitle>
                        <CardDescription>
                            Your API credentials are saved and active.
                        </CardDescription>
                    </div>
                    <Button onClick={() => setIsEditing(true)}>Edit Settings</Button>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Your application is connected to the Microsoft Graph API. You can now send and receive emails.
                    </p>
                </CardContent>
            </Card>
             <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="text-destructive" />
                        Delete Account
                    </CardTitle>
                    <CardDescription>
                        Permanently delete your account and all associated data. This action is irreversible and cannot be undone.
                    </CardDescription>
                </CardHeader>
                <CardFooter>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">Delete Account</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteAccount}
                                className={buttonVariants({ variant: "destructive" })}
                            >
                                Continue
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardFooter>
            </Card>
        </div>
    );
  }

  // Otherwise, show the form (either for initial setup or for editing).
  return (
    <div className="w-full max-w-2xl space-y-6">
        <Card>
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
        <Card className="border-destructive">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="text-destructive" />
                    Delete Account
                </CardTitle>
                <CardDescription>
                    Permanently delete your account and all associated data. This action is irreversible and cannot be undone.
                </CardDescription>
            </CardHeader>
            <CardFooter>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive">Delete Account</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                         <AlertDialogAction
                            onClick={handleDeleteAccount}
                            className={buttonVariants({ variant: "destructive" })}
                         >
                            Continue
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardFooter>
        </Card>
    </div>
  );
}
