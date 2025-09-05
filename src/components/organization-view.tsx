
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { createOrganization, addMemberToOrganization, getOrganizationMembers } from '@/app/actions';
import type { OrganizationMember } from '@/app/actions';
import { RefreshCw, UserPlus, Users, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";


export function OrganizationView() {
    const { user, userProfile, loading, fetchUserProfile } = useAuth();
    const { toast } = useToast();
    const [organizationName, setOrganizationName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [members, setMembers] = useState<OrganizationMember[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);


    useEffect(() => {
        const fetchMembers = async () => {
            if (userProfile?.organizationId) {
                const orgMembers = await getOrganizationMembers(userProfile.organizationId);
                setMembers(orgMembers);
            }
        };
        fetchMembers();
    }, [userProfile]);

    const handleCreateOrganization = async () => {
        if (!user || !user.email) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to create an organization.' });
            return;
        }
        if (!organizationName.trim()) {
            toast({ variant: 'destructive', title: 'Organization name is required.' });
            return;
        }
        setIsCreating(true);
        try {
            await createOrganization(organizationName, user.uid, user.email);
            toast({ title: 'Organization Created', description: `The organization "${organizationName}" has been created successfully.` });
            await fetchUserProfile(user);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: 'Creation Failed', description: errorMessage });
        } finally {
            setIsCreating(false);
        }
    };

    const handleAddMember = async () => {
        if (!newMemberName.trim() || !newMemberEmail.trim()) {
            toast({ variant: 'destructive', title: 'Member name and email are required.' });
            return;
        }
        if (!userProfile?.organizationId) {
            toast({ variant: 'destructive', title: 'Cannot add member without an organization.' });
            return;
        }
        setIsAddingMember(true);
        try {
            await addMemberToOrganization(userProfile.organizationId, newMemberName, newMemberEmail);
            toast({ title: 'Member Added', description: `${newMemberName} has been added to the organization.` });
            setMembers([...members, { name: newMemberName, email: newMemberEmail }]);
            setNewMemberName('');
            setNewMemberEmail('');
            setIsDialogOpen(false); // Close dialog on success
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: 'Failed to Add Member', description: errorMessage });
        } finally {
            setIsAddingMember(false);
        }
    };
    
    if(loading) {
        return <p>Loading...</p>;
    }

    if (!userProfile?.organizationId) {
        return (
            <Card className="max-w-2xl w-full">
                <CardHeader>
                    <CardTitle className="font-headline">Create Organization</CardTitle>
                    <CardDescription>
                        You don't belong to an organization yet. Create one to get started.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="org-name">Organization Name</Label>
                        <Input 
                            id="org-name" 
                            placeholder="Your Company, Inc." 
                            value={organizationName}
                            onChange={(e) => setOrganizationName(e.target.value)}
                        />
                    </div>
                </CardContent>
                <CardFooter>
                     <Button onClick={handleCreateOrganization} disabled={isCreating}>
                        {isCreating && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                        Create Organization
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    return (
        <div className="space-y-8 max-w-4xl w-full">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2"><Users /> {userProfile.organizationName || 'Your Organization'}</CardTitle>
                        <CardDescription>
                            Manage your organization's members. Members can be assigned to tickets.
                        </CardDescription>
                    </div>
                     <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                           <Button>
                                <UserPlus className="mr-2 h-4 w-4" />
                                Add New Member
                           </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Add New Member</DialogTitle>
                                <DialogDescription>
                                    Add a new person to your organization. They will be available to be assigned to tickets.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="name" className="text-right">
                                        Name
                                    </Label>
                                    <Input
                                        id="name"
                                        value={newMemberName}
                                        onChange={(e) => setNewMemberName(e.target.value)}
                                        className="col-span-3"
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="email" className="text-right">
                                        Email
                                    </Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={newMemberEmail}
                                        onChange={(e) => setNewMemberEmail(e.target.value)}
                                        className="col-span-3"
                                        placeholder="member@example.com"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="secondary">
                                    Cancel
                                    </Button>
                                </DialogClose>
                                <Button onClick={handleAddMember} disabled={isAddingMember}>
                                    {isAddingMember && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                    Add Member
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <h3 className="font-semibold mb-4">Members ({members.length})</h3>
                    <div className="space-y-2">
                        {members.map((member) => (
                             <Link href={`/clients/${encodeURIComponent(member.email)}`} key={member.email} className="block">
                                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                                    <div>
                                        <p className="font-medium">{member.name}</p>
                                        <p className="text-sm text-muted-foreground">{member.email}</p>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                </div>
                            </Link>
                        ))}
                        {members.length === 0 && <p className="text-sm text-muted-foreground">No members yet. Add one to get started.</p>}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
