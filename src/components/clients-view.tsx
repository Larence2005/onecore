
"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/providers/auth-provider";
import { addCompany, getCompanyWithTicketAndEmployeeCount } from "@/app/actions";
import type { Company } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { PlusCircle, RefreshCw, Building, ChevronLeft, ChevronRight, Ticket, Users } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useRouter } from "next/navigation";


export function ClientsView() {
    const { userProfile } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [newCompanyName, setNewCompanyName] = useState("");
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [companiesPerPage, setCompaniesPerPage] = useState(10);

    const fetchCompanies = async () => {
        if (!userProfile?.organizationId) return;
        setIsLoading(true);
        try {
            const fetchedCompanies = await getCompanyWithTicketAndEmployeeCount(userProfile.organizationId);
            setCompanies(fetchedCompanies);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error fetching companies' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (userProfile?.organizationId) {
            fetchCompanies();
        }
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
    
    const paginatedCompanies = useMemo(() => {
        const startIndex = (currentPage - 1) * companiesPerPage;
        const endIndex = startIndex + companiesPerPage;
        return companies.slice(startIndex, endIndex);
    }, [companies, currentPage, companiesPerPage]);

    const totalPages = Math.ceil(companies.length / companiesPerPage);
    
    const isOwner = userProfile?.uid === userProfile?.organizationOwnerUid;

    const renderSkeleton = () => (
        <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-2">
                        <Skeleton className="h-6 flex-1" />
                        <Skeleton className="h-6 w-24" />
                    </div>
                ))}
            </div>
        </div>
    );

    if (isLoading) {
        return <div className="w-full max-w-4xl mx-auto">{renderSkeleton()}</div>
    }

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Companies</h1>
                    <p className="text-muted-foreground">A list of all companies in your organization.</p>
                </div>
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
            
            <div className="space-y-4">
                {companies.length > 0 ? (
                    <>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Company Name</TableHead>
                                    <TableHead className="text-right">Employees</TableHead>
                                    <TableHead className="text-right">Unresolved Tickets</TableHead>
                                    <TableHead className="text-right">Total Tickets</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedCompanies.map((company) => (
                                     <TableRow key={company.id} className="cursor-pointer" onClick={() => router.push(`/clients/${company.id}`)}>
                                        <TableCell className="font-medium">{company.name}</TableCell>
                                        <TableCell className="text-right">{company.employeeCount}</TableCell>
                                        <TableCell className="text-right">{company.unresolvedTicketCount}</TableCell>
                                        <TableCell className="text-right">{company.ticketCount}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-4">
                                <div className="text-sm text-muted-foreground">
                                    Showing {Math.min(companiesPerPage * currentPage, companies.length)} of {companies.length} companies.
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">Rows per page</span>
                                        <Select value={String(companiesPerPage)} onValueChange={(value) => { setCompaniesPerPage(Number(value)); setCurrentPage(1); }}>
                                            <SelectTrigger className="h-8 w-[70px]">
                                                <SelectValue placeholder={String(companiesPerPage)} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="25">25</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        Page {currentPage} of {totalPages}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
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
        </div>
    );
}
