
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { createOrganization, getOrganizationMembers, addMemberToOrganization, updateMemberInOrganization, deleteMemberFromOrganization, updateOrganization, deleteOrganization } from '@/app/actions';
import type { OrganizationMember } from '@/app/actions';
import { RefreshCw, Users, Trash2, Pencil, UserPlus, AlertTriangle, Settings } from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
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


export function OrganizationView() {
    const { user, userProfile, loading, fetchUserProfile, logout } = useAuth();
    const { toast } = useToast();
    const [organizationName, setOrganizationName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    
    const [members, setMembers] = useState<OrganizationMember[]>([]);
    const [isAddingMember, setIsAddingMember] = useState(false);
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberEmail, setNewMemberEmail] = useState('');

    const [editingMember, setEditingMember] = useState<OrganizationMember | null>(null);
    const [updatedName, setUpdatedName] = useState('');
    const [updatedEmail, setUpdatedEmail] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    const [deletingMember, setDeletingMember] = useState<OrganizationMember | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
    
    const [updatedOrganizationName, setUpdatedOrganizationName] = useState(userProfile?.organizationName || '');
    const [isUpdatingOrg, setIsUpdatingOrg] = useState(false);
    const [isDeletingOrg, setIsDeletingOrg] = useState(false);
    const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');


    const fetchMembers = async () => {
        if (userProfile?.organizationId) {
            const orgMembers = await getOrganizationMembers(userProfile.organizationId);
            setMembers(orgMembers);
        }
    };
    
    useEffect(() => {
        if (userProfile?.organizationId) {
            fetchMembers();
            setUpdatedOrganizationName(userProfile.organizationName || '');
        }
    }, [userProfile]);
    
    const resetAddMemberForm = () => {
        setNewMemberName('');
        setNewMemberEmail('');
        setIsAddMemberDialogOpen(false);
    };

    const handleAddMember = async () => {
        if (!userProfile?.organizationId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Organization not found.' });
            return;
        }
        if (!newMemberName.trim() || !newMemberEmail.trim()) {
            toast({ variant: 'destructive', title: 'All fields are required.' });
            return;
        }

        setIsAddingMember(true);
        try {
            await addMemberToOrganization(userProfile.organizationId, newMemberName, newMemberEmail);
            toast({ title: 'Member Added', description: `${newMemberName} has been invited to the organization.` });
            await fetchMembers();
            resetAddMemberForm();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: 'Failed to Add Member', description: errorMessage });
        } finally {
            setIsAddingMember(false);
        }
    };
    
    const handleEditClick = (member: OrganizationMember) => {
        setEditingMember(member);
        setUpdatedName(member.name);
        setUpdatedEmail(member.email);
        setIsEditDialogOpen(true);
    };

    const handleUpdateMember = async () => {
        if (!editingMember || !userProfile?.organizationId) return;
        setIsUpdating(true);
        try {
            await updateMemberInOrganization(userProfile.organizationId, editingMember.email, updatedName, updatedEmail);
            toast({ title: "Member Updated", description: "The member's details have been updated." });
            await fetchMembers();
            setIsEditDialogOpen(false);
            setEditingMember(null);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: "Update Failed", description: errorMessage });
        } finally {
            setIsUpdating(false);
        }
    };
    
    const handleDeleteMember = async () => {
        if (!deletingMember || !userProfile?.organizationId) return;
        setIsDeleting(true);
        try {
            await deleteMemberFromOrganization(userProfile.organizationId, deletingMember.email);
            toast({ title: 'Member Deleted', description: `${deletingMember.name} has been removed from the organization.` });
            await fetchMembers();
            setDeletingMember(null);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            toast({ variant: 'destructive', title: 'Deletion Failed', description: errorMessage });
        } finally {
            setIsDeleting(false);
        }
    };

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

    const handleUpdateOrganization = async () => {
        if (!userProfile?.organizationId || !updatedOrganizationName.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Organization name cannot be empty.' });
            return;
        }
        setIsUpdatingOrg(true);
        try {
            await updateOrganization(userProfile.organizationId, updatedOrganizationName);
            await fetchUserProfile(user!);
            toast({ title: 'Organization Updated', description: `Organization name changed to "${updatedOrganizationName}".` });
            setIsSettingsDialogOpen(false);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            toast({ variant: 'destructive', title: 'Update Failed', description: errorMessage });
        } finally {
            setIsUpdatingOrg(false);
        }
    };
    
    const handleDeleteOrganization = async () => {
        if (!userProfile?.organizationId || !user) return;
        setIsDeletingOrg(true);
        try {
            await deleteOrganization(userProfile.organizationId);
            toast({ title: 'Organization Deleted', description: 'The organization has been permanently deleted.' });
            await fetchUserProfile(user);
            await logout(); // Log out the user as they no longer belong to an org
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            toast({ variant: 'destructive', title: 'Deletion Failed', description: errorMessage });
        } finally {
            setIsDeletingOrg(false);
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
    
    const isOwner = user?.uid === userProfile.organizationOwnerUid;
    const isDeleteConfirmationValid = deleteConfirmationInput === userProfile.organizationName;

    return (
        <div className="space-y-8 max-w-4xl w-full">
            <Card>
                <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2"><Users /> {userProfile.organizationName || 'Your Organization'}</CardTitle>
                        <CardDescription>
                            Invite and manage your organization's members.
                        </CardDescription>
                    </div>
                     {isOwner && (
                        <div className="flex items-center gap-2">
                            <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button>
                                        <UserPlus className="mr-2 h-4 w-4" /> Add Member
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Add New Member</DialogTitle>
                                        <DialogDescription>
                                            Invite a new person to your organization. They will be able to sign up with their email.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="new-member-name">Name</Label>
                                            <Input id="new-member-name" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="John Doe" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="new-member-email">Email</Label>
                                            <Input id="new-member-email" type="email" value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} placeholder="john.d@example.com" />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button type="button" variant="secondary" onClick={resetAddMemberForm}>Cancel</Button>
                                        </DialogClose>
                                        <Button onClick={handleAddMember} disabled={isAddingMember}>
                                            {isAddingMember && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                            Add Member
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                             <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline">
                                        <Settings className="mr-2 h-4 w-4" /> Settings
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Organization Settings</DialogTitle>
                                        <DialogDescription>Manage your organization's name.</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-2 py-4">
                                        <Label htmlFor="org-update-name">Organization Name</Label>
                                        <Input
                                            id="org-update-name"
                                            value={updatedOrganizationName}
                                            onChange={(e) => setUpdatedOrganizationName(e.target.value)}
                                        />
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button type="button" variant="secondary">Cancel</Button>
                                        </DialogClose>
                                        <Button onClick={handleUpdateOrganization} disabled={isUpdatingOrg || updatedOrganizationName === userProfile.organizationName}>
                                            {isUpdatingOrg && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                            Save Changes
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive">
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete your organization, including all tickets, conversations, and member data. To confirm, please type your organization name: <strong className="text-foreground">{userProfile.organizationName}</strong>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <div className="py-4">
                                        <Input
                                            value={deleteConfirmationInput}
                                            onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                                            placeholder="Type organization name to confirm"
                                        />
                                    </div>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setDeleteConfirmationInput('')}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            disabled={!isDeleteConfirmationValid || isDeletingOrg}
                                            onClick={handleDeleteOrganization}
                                            className="bg-destructive hover:bg-destructive/90"
                                        >
                                            {isDeletingOrg && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                            Delete Forever
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                     )}
                </CardHeader>
                <CardContent>
                    <h3 className="font-semibold mb-4">Members ({members.length})</h3>
                    <div className="space-y-2">
                        {members.map((member) => (
                             <div key={member.email} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg transition-colors group">
                                <Link href={`/assignees/${encodeURIComponent(member.email)}`} className="flex-grow flex items-center gap-4">
                                    <div>
                                        <p className="font-medium">{member.name}</p>
                                        <p className="text-sm text-muted-foreground">{member.email}</p>
                                    </div>
                                </Link>
                                 {isOwner && (
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Dialog open={isEditDialogOpen && editingMember?.email === member.email} onOpenChange={(isOpen) => { if (!isOpen) setEditingMember(null); setIsEditDialogOpen(isOpen); }}>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="icon" onClick={() => handleEditClick(member)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Edit Member</DialogTitle>
                                                </DialogHeader>
                                                <div className="space-y-4 py-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="update-name">Name</Label>
                                                        <Input id="update-name" value={updatedName} onChange={(e) => setUpdatedName(e.target.value)} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="update-email">Email</Label>
                                                        <Input id="update-email" type="email" value={updatedEmail} onChange={(e) => setUpdatedEmail(e.target.value)} />
                                                    </div>
                                                </div>
                                                <DialogFooter>
                                                    <DialogClose asChild>
                                                        <Button variant="outline" onClick={() => setEditingMember(null)}>Cancel</Button>
                                                    </DialogClose>
                                                    <Button onClick={handleUpdateMember} disabled={isUpdating}>
                                                        {isUpdating && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                                        Save Changes
                                                    </Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeletingMember(member)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This action will delete {deletingMember?.name} and cannot be undone. This does not delete their user account, only removes them from the organization.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleDeleteMember} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                                                        {isDeleting && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                                        Delete
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                )}
                            </div>
                        ))}
                        {members.length === 0 && <p className="text-sm text-muted-foreground">No members yet. Add one to get started.</p>}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
