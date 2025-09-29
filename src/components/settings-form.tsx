
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
import { CheckCircle, AlertTriangle, RefreshCw, Info, Check, ShieldCheck } from "lucide-react";
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
import { deleteOrganization, verifyUserEmail } from "@/app/actions";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, deleteDoc } from 'firebase/firestore';
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";


const verificationFormSchema = z.object({
    username: z.string().min(1, "Username is required.").regex(/^[a-zA-Z0-9]+$/, "Username can only contain letters and numbers."),
    displayName: z.string().min(1, "Display name is required."),
    password: z.string().min(1, "Password is required to create the M365 account."),
});

function VerificationArea() {
    const { user, userProfile, fetchUserProfile } = useAuth();
    const { toast } = useToast();
    const [isVerifying, setIsVerifying] = useState(false);

    const verificationForm = useForm<z.infer<typeof verificationFormSchema>>({
        resolver: zodResolver(verificationFormSchema),
        defaultValues: {
            username: "",
            displayName: userProfile?.name || "",
            password: "",
        },
    });
    
    const usernameValue = verificationForm.watch('username');
    
    useEffect(() => {
        if(userProfile?.name) {
            verificationForm.setValue('displayName', userProfile.name);
        }
    }, [userProfile?.name, verificationForm]);


    const onVerificationSubmit = async (values: z.infer<typeof verificationFormSchema>) => {
        if (!user || !userProfile?.organizationId) {
            toast({ variant: 'destructive', title: 'Error', description: 'User or organization not found.'});
            return;
        }

        setIsVerifying(true);
        try {
            await verifyUserEmail(
                userProfile.organizationId,
                user.uid,
                values.username,
                values.displayName,
                values.password,
            );
            toast({ title: 'Verification Successful!', description: 'Your new email has been created and verified.' });
            await fetchUserProfile(user); // Re-fetch profile to get new status
        } catch(e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            toast({ variant: 'destructive', title: 'Verification Failed', description: errorMessage });
        } finally {
            setIsVerifying(false);
        }
    };
    
    if (userProfile?.status === 'Verified') {
        return (
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="text-green-500" />
                        Account Verified
                    </CardTitle>
                    <CardDescription>
                        Your account has been successfully verified and your new email is active.
                    </CardDescription>
                </CardHeader>
            </Card>
        )
    }

    if(userProfile?.status === 'Not Verified') {
        const newDomain = userProfile?.organizationDomain
            ? `${userProfile.organizationDomain.split('.')[0]}.${process.env.NEXT_PUBLIC_PARENT_DOMAIN}`
            : `your-company.${process.env.NEXT_PUBLIC_PARENT_DOMAIN}`;
        
        const newEmailPreview = usernameValue ? `${usernameValue}@${newDomain}` : `username@${newDomain}`;


        return (
            <Card>
                <Form {...verificationForm}>
                    <form onSubmit={verificationForm.handleSubmit(onVerificationSubmit)}>
                        <CardHeader>
                            <CardTitle>Verify Your Account</CardTitle>
                             <CardDescription>
                                Create your new email address for the support system. This will be your primary address for sending and receiving support emails.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <FormField
                                control={verificationForm.control}
                                name="username"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Username</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., support" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Your new email will be: <span className="font-medium text-foreground">{newEmailPreview}</span>
                                    </FormDescription>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={verificationForm.control}
                                name="displayName"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Display Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., Support Team" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={verificationForm.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>New Microsoft 365 Password</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="********" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={isVerifying}>
                                {isVerifying ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        Verifying...
                                    </>
                                ) : 'Verify and Create Email'}
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </Card>
        )
    }

    return null;
}

export function SettingsForm() {
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
            <VerificationArea />
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
        <VerificationArea />
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
