
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
import { Separator } from "./ui/separator";


const passwordValidation = z
  .string()
  .min(8, { message: "Password must be at least 8 characters long." })
  .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter." })
  .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter." })
  .regex(/[0-9]/, { message: "Password must contain at least one number." })
  .regex(/[^A-Za-z0-9]/, { message: "Password must contain at least one special character." });

const verificationFormSchema = z.object({
    username: z.string().min(1, "Username is required.").regex(/^[a-zA-Z0-9.-]+$/, "Username can only contain letters, numbers, dots, and hyphens."),
    displayName: z.string().min(1, "Display name is required."),
    password: passwordValidation,
    confirmPassword: z.string().min(1, "Please confirm your password."),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});


function VerificationArea() {
    const { user, userProfile, fetchUserProfile } = useAuth();
    const { toast } = useToast();
    const [isVerifying, setIsVerifying] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [parentDomain, setParentDomain] = useState('');

    useEffect(() => {
        // This will only run on the client-side
        setParentDomain(process.env.NEXT_PUBLIC_PARENT_DOMAIN || '');
    }, []);

    const form = useForm<z.infer<typeof verificationFormSchema>>({
        resolver: zodResolver(verificationFormSchema),
        mode: 'onChange',
        defaultValues: {
            username: "",
            displayName: userProfile?.name || "",
            password: "",
            confirmPassword: "",
        },
    });
    
    const usernameValue = form.watch('username');
    const displayNameValue = form.watch('displayName');
    const passwordValue = form.watch('password');
    const orgDomainName = userProfile?.organizationDomain?.split('.')[0] || '';
    const newDomain = orgDomainName && parentDomain ? `${orgDomainName}.${parentDomain}` : '';
    const newEmailPreview = usernameValue && newDomain ? `${usernameValue}@${newDomain}` : (newDomain ? `username@${newDomain}` : 'Enter username to see preview');
    
    useEffect(() => {
        if(userProfile?.name) {
            form.setValue('displayName', userProfile.name);
        }
    }, [userProfile?.name, form]);


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
            setIsConfirmOpen(false);
        } catch(e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            toast({ variant: 'destructive', title: 'Verification Failed', description: errorMessage });
        } finally {
            setIsVerifying(false);
        }
    };
    
    const handleVerifyClick = async () => {
        const isValid = await form.trigger();
        if (isValid) {
            setIsConfirmOpen(true);
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
                </CardHeader>
                <CardContent>
                    <Alert variant="default" className="border-green-500">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        <AlertTitle>Your account is verified.</AlertTitle>
                        <AlertDescription>
                        Your new email address is now active and ready to use. You can send and receive tickets through <strong className="font-bold">{userProfile.email}</strong>. After verification, log in to Outlook and set up the authenticator to start receiving tickets.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        )
    }

    if(userProfile?.status === 'Not Verified') {
        
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-bold">Verify Your Account</h2>
                    <p className="text-muted-foreground">
                        Create your new email address for the support system. This will be your primary address for sending and receiving support emails.
                    </p>
                </div>
                <Form {...form}>
                    <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                        <div className="text-center text-sm text-muted-foreground my-4">
                            Your new email will be:
                            <p className="font-medium text-foreground text-base">{newEmailPreview}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="username"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Username</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., support" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
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
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
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
                            <FormField
                                control={form.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Confirm New Password</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="********" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="flex justify-end">
                            <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                                <Button onClick={handleVerifyClick} disabled={isVerifying}>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin hidden" />
                                    Verify and Create Email
                                </Button>
                                <AlertDialogContent>
                                    {isVerifying ? (
                                        <div className="flex flex-col items-center justify-center text-center space-y-4 p-8">
                                            <RefreshCw className="h-10 w-10 animate-spin text-primary" />
                                            <h2 className="text-xl font-semibold">Verification in Progress</h2>
                                            <p className="text-muted-foreground">
                                                This process can take several minutes. Please do not close this window.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Confirm New Credentials</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Please review the details below. This will create a new Microsoft 365 email account for receiving tickets. This is a one-time action.
                                                </AlertDialogDescription>
                                                <div className="space-y-2 pt-4 text-foreground text-left text-sm">
                                                    <div><strong className="font-medium">New Email:</strong> {newEmailPreview}</div>
                                                    <div><strong className="font-medium">Username:</strong> {usernameValue}</div>
                                                    <div><strong className="font-medium">Display Name:</strong> {displayNameValue}</div>
                                                    <div><strong className="font-medium">Password:</strong> {passwordValue}</div>
                                                </div>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel disabled={isVerifying}>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={form.handleSubmit(onVerificationSubmit)} disabled={isVerifying}>
                                                    {isVerifying && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                                    Confirm
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </>
                                    )}
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </form>
                </Form>
            </div>
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

  
  return (
    <div className="w-full max-w-2xl space-y-6">
        {isOwner && <VerificationArea />}

        <Separator className="my-6" />
        
        <Card className="border-destructive">
             <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="text-destructive" />
                        Delete Account
                    </CardTitle>
                    <CardDescription>
                        Permanently delete your account and all associated data.
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
            </CardFooter>
        </Card>
    </div>
  );
}
