
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { addCompany, getCompanyWithTicketCount } from "@/app/actions";
import type { Company } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { PlusCircle, RefreshCw, Building, Ticket } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import Link from "next/link";


export function ClientsView() {
    const { userProfile } = useAuth();
    const { toast } = useToast();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [newCompanyName, setNewCompanyName] = useState("");
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    const fetchCompanies = async () => {
        if (!userProfile?.organizationId) return;
        setIsLoading(true);
        try {
            const fetchedCompanies = await getCompanyWithTicketCount(userProfile.organizationId);
            setCompanies(fetchedCompanies);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error fetching companies' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCompanies();
    }, [userProfile]);

    const handleAddCompany = async () => {
        if (!userProfile?.organizationId || !newCompanyName.trim()) {
            toast({ variant: 'destructive', title: 'Company name is required' });
            return;
        }
        setIsAdding(true);
        try {
            const result = await addCompany(userProfile.organizationId, newCompanyName);
            if (result.success) {
                toast({ title: 'Company Added', description: `"${newCompanyName}" has been created.` });
                setNewCompanyName("");
                setIsAddDialogOpen(false);
                await fetchCompanies();
            } else {
                toast({ variant: 'destructive', title: 'Failed to Add Company', description: result.error });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ variant: 'destructive', title: 'Error', description: errorMessage });
        } finally {
            setIsAdding(false);
        }
    };
    
    const isOwner = userProfile?.uid === userProfile?.organizationOwnerUid;

    if (isLoading) {
        return (
            <div className="w-full max-w-4xl mx-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader>
                                <Skeleton className="h-6 w-3/4" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-4 w-1/2" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }
    

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Companies</h1>
                {isOwner && (
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add Company
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add a new company</DialogTitle>
                                <DialogDescription>
                                    Create a new company record to associate with tickets.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                                <Label htmlFor="company-name">Company Name</Label>
                                <Input
                                    id="company-name"
                                    value={newCompanyName}
                                    onChange={(e) => setNewCompanyName(e.target.value)}
                                    placeholder="e.g., Acme Corporation"
                                />
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="outline">Cancel</Button>
                                </DialogClose>
                                <Button onClick={handleAddCompany} disabled={isAdding}>
                                    {isAdding && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                    Add Company
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {companies.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {companies.map((company) => (
                        <Link key={company.id} href={`/clients/${company.id}`} passHref>
                           <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Building className="h-5 w-5 text-muted-foreground" />
                                        <span className="truncate">{company.name}</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    {/* Additional company details can go here */}
                                </CardContent>
                                <CardFooter>
                                     <div className="flex items-center text-sm text-muted-foreground">
                                        <Ticket className="h-4 w-4 mr-2" />
                                        <span>{company.ticketCount} ticket(s)</span>
                                    </div>
                                </CardFooter>
                           </Card>
                        </Link>
                    ))}
                </div>
            ) : (
                <Alert>
                    <Building className="h-4 w-4" />
                    <AlertTitle>No Companies Found</AlertTitle>
                    <AlertDescription>
                        {isOwner ? "Get started by adding your first company." : "Your organization administrator has not added any companies yet."}
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}

