
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState, useEffect } from "react";
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";

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
import { CheckCircle, AlertTriangle, RefreshCw, Info } from "lucide-react";
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
import { useAuth } from "@/providers/auth-provider";
import { deleteOrganization } from "@/app/actions";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, deleteDoc } from 'firebase/firestore';
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";


const formSchema = z.object({
  clientId: z.string().min(1, "Client ID is required."),
  tenantId: z.string().min(1, "Tenant ID is required."),
  clientSecret: z.string().min(1, "Client Secret is required."),
});

export function SettingsForm() {
  const { settings, isConfigured } = useSettings();
  const { user, userProfile, logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  
  const isOwner = user?.uid === userProfile?.organizationOwnerUid;

  const handleDeleteAccount = async () => {
    if (!user || !userProfile || !user.email) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "You must be logged in to delete an account.",
        });
        return;
    }
    
    const password = prompt("For your security, please re-enter your password to delete your account:");
    if (!password) {
        toast({
            title: "Deletion Canceled",
            description: "Password not provided.",
        });
        return;
    }

    setIsDeleting(true);
    try {
        const credential = EmailAuthProvider.credential(user.email, password);
        // Re-authenticate the user
        await reauthenticateWithCredential(user, credential);
        
        // If re-authentication is successful, proceed with deletion
        const isOwner = user.uid === userProfile.organizationOwnerUid;
        if (isOwner && userProfile.organizationId) {
            await deleteOrganization(userProfile.organizationId);
        }

        // Finally, delete the user from Firebase Authentication
        await deleteUser(user);

        toast({
            title: "Account Deleted",
            description: "Your account and all associated data have been successfully deleted.",
        });
        
        // No need to call logout(), deleteUser signs them out.
        router.push('/login'); 

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during account deletion.";
        toast({
            variant: "destructive",
            title: "Deletion Failed",
            description: errorMessage,
        });
    } finally {
        setIsDeleting(false);
    }
  }
  
  if (!isOwner) {
    return (
        <div className="w-full max-w-2xl space-y-6">
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Settings</AlertTitle>
                <AlertDescription>
                    API and organization settings are managed by your administrator.
                </AlertDescription>
            </Alert>
             <Card className="border-destructive">
                <CardHeader className="flex flex-row items-start justify-between">
                    <div className="space-y-1.5">
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="text-destructive" />
                            Delete Account
                        </CardTitle>
                        <CardDescription>
                            Permanently delete your account. This action cannot be undone.
                        </CardDescription>
                    </div>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">Delete</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete your account. You will be removed from your organization.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteAccount}
                                disabled={isDeleting}
                                className={buttonVariants({ variant: "destructive" })}
                            >
                                {isDeleting && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                Continue
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardHeader>
            </Card>
        </div>
    );
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
        <Card className="border-destructive">
            <CardHeader className="flex flex-row items-start justify-between">
                <div className="space-y-1.5">
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="text-destructive" />
                        Delete Account
                    </CardTitle>
                    <CardDescription>
                        Permanently delete your account and all associated data.
                    </CardDescription>
                </div>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive">Delete</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete your account and remove all your data from our servers. If you are the organization owner, this will delete the entire organization.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                         <AlertDialogAction
                            onClick={handleDeleteAccount}
                            disabled={isDeleting}
                            className={buttonVariants({ variant: "destructive" })}
                         >
                            {isDeleting && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                            Continue
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardHeader>
        </Card>
    </div>
  );
}
