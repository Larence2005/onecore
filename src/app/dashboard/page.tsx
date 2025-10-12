
"use client";

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter, useSearchParams } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter, SidebarInset, useSidebar } from '@/components/ui/sidebar';
import { MainView } from '@/components/main-view';
import { LayoutDashboard, List, Users, Building2, Settings, LogOut, Search, Pencil, Archive, Building, Calendar as CalendarIcon, PlusCircle } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/header';
import { cn } from '@/lib/utils';
import { TicketsFilter } from '@/components/tickets-filter';
import type { Email, DetailedEmail, Company, OrganizationMember } from '@/app/actions';
import { getCompanies, getLatestEmails, getOrganizationMembers, checkTicketDeadlinesAndNotify } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';


type View = 'tickets' | 'analytics' | 'clients' | 'organization' | 'settings' | 'compose' | 'archive' | 'create-ticket';

function HomePageContent() {
  const { user, userProfile, loading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeView, setActiveView] = useState<View>('analytics');
  const { setOpenMobile } = useSidebar();
  
  const { toast } = useToast();
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    agents: [],
    groups: [],
    statuses: [],
    priorities: [],
    types: [],
    tags: '',
    created: 'any',
  });
  
  // State for dashboard filters
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [dateRangeOption, setDateRangeOption] = useState<string>('all');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);


  useEffect(() => {
    if (!user || !userProfile?.organizationId) return;

    setIsLoading(true);

    const isOwner = user.uid === userProfile.organizationOwnerUid;
    const isClient = userProfile.isClient;
    
    const ticketsCollectionRef = collection(db, 'organizations', userProfile.organizationId, 'tickets');
    let q;

    if (isClient) {
        // Client sees only tickets they created
        q = query(ticketsCollectionRef, where('senderEmail', '==', user.email), where('status', '!=', 'Archived'));
    } else if (isOwner) {
        // Owner sees all non-archived tickets
        q = query(ticketsCollectionRef, where('status', '!=', 'Archived'));
    } else {
        // Member sees only tickets assigned to them
        q = query(ticketsCollectionRef, where('assignee', '==', user.uid), where('status', '!=', 'Archived'));
    }
    
    
    let companyMap = new Map<string, string>();
    let memberMap = new Map<string, string>();
    let memberEmails = new Set<string>();

    const setupListener = async () => {
        try {
            const [fetchedCompanies, members] = await Promise.all([
                getCompanies(userProfile.organizationId!),
                getOrganizationMembers(userProfile.organizationId!)
            ]);
            companyMap = new Map(fetchedCompanies.map(c => [c.id, c.name]));
            setCompanies(fetchedCompanies); // Set companies for the dashboard filter
            memberMap = new Map(members.map(m => [m.uid!, m.name]));
            memberEmails = new Set(members.filter(m => !m.isClient).map(m => m.email.toLowerCase()));

        } catch(e) {
            console.error("Could not fetch companies or members for ticket list", e);
        }

        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            setError(null);
            const ticketsFromDb: Email[] = await Promise.all(querySnapshot.docs.map(async (ticketDoc) => {
                const data = ticketDoc.data();
                let lastReplier: 'agent' | 'client' | undefined = undefined;

                if (data.conversationId && user.email && userProfile.organizationId) {
                    try {
                        const conversationDocRef = doc(db, 'organizations', userProfile.organizationId, 'conversations', data.conversationId);
                        const conversationDoc = await getDoc(conversationDocRef);
                        if (conversationDoc.exists()) {
                            const conversationData = conversationDoc.data();
                            const messages = conversationData.messages as DetailedEmail[];
                            if (messages && messages.length > 0) {
                                const lastMessage = messages[messages.length - 1];
                                if(memberEmails.has(lastMessage.senderEmail?.toLowerCase() || '')) {
                                    lastReplier = 'agent';
                                } else {
                                    lastReplier = 'client';
                                }
                            }
                        } else if (data.senderEmail && !memberEmails.has(data.senderEmail.toLowerCase())) {
                            // Conversation doc doesn't exist yet, this is a new ticket from a client
                            lastReplier = 'client';
                        }
                    } catch (e) {
                        console.error("Could not determine last replier for ticket", ticketDoc.id, e);
                    }
                }
                
                return {
                    id: ticketDoc.id,
                    subject: data.title || 'No Subject',
                    sender: data.sender || 'Unknown Sender',
                    senderEmail: data.senderEmail || 'Unknown Email',
                    bodyPreview: data.bodyPreview || '',
                    receivedDateTime: data.receivedDateTime || new Date().toISOString(),
                    priority: data.priority || 'Low',
                    assignee: data.assignee,
                    assigneeName: data.assignee ? memberMap.get(data.assignee) : 'Unassigned',
                    status: data.status || 'Open',
                    type: data.type || 'Incident',
                    conversationId: data.conversationId,
                    tags: data.tags || [],
                    deadline: data.deadline,
                    closedAt: data.closedAt,
                    lastReplier: lastReplier,
                    ticketNumber: data.ticketNumber,
                    companyId: data.companyId,
                    companyName: data.companyId ? companyMap.get(data.companyId) : undefined,
                };
            }));

            ticketsFromDb.sort((a, b) => new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime());
            setEmails(ticketsFromDb);
            setIsLoading(false);
        }, (err) => {
            const dbErrorMessage = err instanceof Error ? err.message : "An unknown database error occurred.";
            setError(dbErrorMessage);
            setEmails([]);
            setIsLoading(false);
        });

        // Add listeners for all conversation documents to update lastReplier status
        const conversationListeners = new Map<string, () => void>();
        const ticketsSnapshot = await getDocs(q);
        ticketsSnapshot.docs.forEach(ticketDoc => {
            const conversationId = ticketDoc.data().conversationId;
            if(conversationId) {
                const convDocRef = doc(db, 'organizations', userProfile.organizationId!, 'conversations', conversationId);
                const convUnsub = onSnapshot(convDocRef, async (convDoc) => {
                    if (convDoc.exists()) {
                        const messages = convDoc.data()?.messages as DetailedEmail[];
                        if (!messages || messages.length === 0) return;

                        const lastMessage = messages[messages.length - 1];
                        
                        const isAgentReply = memberEmails.has(lastMessage.senderEmail?.toLowerCase() || '');

                         setEmails(prevEmails => {
                            const newEmails = [...prevEmails];
                            const ticketIndex = newEmails.findIndex(e => e.id === ticketDoc.id);
                            if (ticketIndex !== -1) {
                                newEmails[ticketIndex].lastReplier = isAgentReply ? 'agent' : 'client';
                            }
                            return newEmails;
                        });
                    }
                });
                conversationListeners.set(conversationId, convUnsub);
            }
        });


        return () => {
            unsubscribe();
            conversationListeners.forEach(unsub => unsub());
        };
    };
    
    const unsubscribePromise = setupListener();

    return () => {
      unsubscribePromise.then(unsub => unsub && unsub());
    }
  }, [user, userProfile]);


  useEffect(() => {
    const view = searchParams.get('view') as View;
    const validViews: View[] = ['tickets', 'analytics', 'clients', 'organization', 'settings', 'compose', 'archive', 'create-ticket'];
    if (view && validViews.includes(view)) {
      setActiveView(view);
    } else {
      setActiveView(userProfile?.isClient ? 'tickets' : 'analytics');
    }
  }, [searchParams, userProfile]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };
  
  const handleViewChange = (view: View) => {
    setActiveView(view);
    if (view === 'archive') {
      router.push('/archive');
    } else if (view === 'create-ticket') {
        router.push('/create-ticket');
    } else {
      router.push(`/dashboard?view=${view}`, { scroll: false });
    }
    setOpenMobile(false);
  }

  const onApplyFilters = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
          
      </div>
    );
  }
  
  const isClient = userProfile?.isClient === true;

  return (
      <div className={cn(
        "grid min-h-screen w-full",
        activeView === 'tickets' ? "lg:grid-cols-[220px_1fr_288px]" : "lg:grid-cols-[220px_1fr]"
      )}>
        <Sidebar>
            <div className="flex-grow flex flex-col">
                <SidebarHeader className="p-4 flex flex-col gap-4">
                    <div className="flex items-center justify-center">
                        <Image src="/quickdesk_logowithtext_nobg.png" alt="Quickdesk Logo" width="120" height="60" unoptimized />
                    </div>
                    <div className="flex items-center gap-4">
                        <Avatar className="h-9 w-9">
                           <AvatarFallback>{userProfile?.name || user.email}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <span className="font-medium text-sm">{userProfile?.name || user.email}</span>
                            <Button variant="link" size="sm" className="h-auto p-0 justify-start text-xs" onClick={handleLogout}>Log Out</Button>
                        </div>
                    </div>
                </SidebarHeader>
                <SidebarContent className="flex-grow">
                <SidebarMenu className="flex flex-col gap-2 px-4">
                  {!isClient && (
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => handleViewChange('analytics')} isActive={activeView === 'analytics'}>
                        <LayoutDashboard className="text-purple-500" />
                        <span>Dashboard</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => handleViewChange('tickets')} isActive={activeView === 'tickets'}>
                      <List className="text-green-500" />
                      <span>Tickets</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {isClient ? (
                     <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => handleViewChange('create-ticket')} isActive={activeView === 'create-ticket'}>
                            <PlusCircle className="text-blue-500" />
                            <span>Create Ticket</span>
                        </SidebarMenuButton>
                     </SidebarMenuItem>
                  ) : (
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => handleViewChange('compose')} isActive={activeView === 'compose'}>
                        <Pencil className="text-blue-500" />
                        <span>Compose</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {!isClient && (
                    <>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => handleViewChange('archive')} isActive={activeView === 'archive'}>
                                <Archive className="text-orange-500" />
                                <span>Archive</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => handleViewChange('clients')} isActive={activeView === 'clients'}>
                            <Users className="text-pink-500" />
                            <span>Clients</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => handleViewChange('organization')} isActive={activeView === 'organization'}>
                            <Building2 className="text-yellow-500" />
                            <span>Organization</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </>
                  )}
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => handleViewChange('settings')} isActive={activeView === 'settings'}>
                      <Settings className="text-gray-500" />
                      <span>Settings</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarContent>
            </div>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0 bg-muted">
          <Header>
            {activeView === 'analytics' ? (
                <>
                    <div>
                        <h1 className="text-xl font-bold">Dashboard</h1>
                    </div>
                    <div className="hidden flex-1 justify-end items-center gap-4 sm:flex">
                        <div className="grid items-center gap-1.5">
                            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                                <SelectTrigger id="company-filter" className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="Select a company" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        <div className="flex items-center gap-2">
                                            <Building className="h-4 w-4" />
                                            All Companies
                                        </div>
                                    </SelectItem>
                                    {companies.map(company => (
                                        <SelectItem key={company.id} value={company.id}>
                                            {company.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid items-center">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                    id="date"
                                    variant={"outline"}
                                    className={cn(
                                        "w-full sm:w-[240px] justify-start text-left font-normal",
                                        !customDateRange && dateRangeOption === 'all' && "text-muted-foreground"
                                    )}
                                    >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRangeOption === 'custom' && customDateRange?.from ? (
                                        customDateRange.to ? (
                                        <>
                                            {format(customDateRange.from, "LLL dd, y")} -{" "}
                                            {format(customDateRange.to, "LLL dd, y")}
                                        </>
                                        ) : (
                                        format(customDateRange.from, "LLL dd, y")
                                        )
                                    ) : (
                                        {
                                        'all': 'All Time',
                                        '7d': 'Last 7 Days',
                                        '30d': 'Last 30 Days',
                                        '90d': 'Last 90 Days',
                                        'custom': 'Custom Range'
                                        }[dateRangeOption] || 'Select a date range'
                                    )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                    <Select
                                        onValueChange={(value) => {
                                            setDateRangeOption(value);
                                            if (value !== 'custom') {
                                                setCustomDateRange(undefined);
                                            }
                                        }}
                                        value={dateRangeOption}
                                    >
                                        <SelectTrigger className="w-full border-0 rounded-b-none focus:ring-0">
                                            <SelectValue placeholder="Select a range" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Time</SelectItem>
                                            <SelectItem value="7d">Last 7 Days</SelectItem>
                                            <SelectItem value="30d">Last 30 Days</SelectItem>
                                            <SelectItem value="90d">Last 90 Days</SelectItem>
                                            <SelectItem value="custom">Custom Range</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={customDateRange?.from}
                                        selected={customDateRange}
                                        onSelect={(range) => {
                                            setCustomDateRange(range)
                                            if(range) setDateRangeOption('custom')
                                        }}
                                        numberOfMonths={2}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </>
            ) : (
                <div>
                    {activeView === 'tickets' && <h1 className="text-xl font-bold">Tickets</h1>}
                    {activeView === 'compose' && <h1 className="text-xl font-bold">Compose</h1>}
                    {activeView === 'clients' && <h1 className="text-xl font-bold">Clients</h1>}
                    {activeView === 'organization' && <h1 className="text-xl font-bold">Organization</h1>}
                    {activeView === 'settings' && <h1 className="text-xl font-bold">Settings</h1>}
                    {activeView === 'archive' && <h1 className="text-xl font-bold">Archive</h1>}
                    {activeView === 'create-ticket' && <h1 className="text-xl font-bold">Create a New Ticket</h1>}
                </div>
            )}
          </Header>
            {activeView === 'analytics' && (
                 <div className="flex sm:hidden flex-row items-center gap-4 px-4 pt-4">
                    <div className="grid items-center gap-1.5 flex-1">
                        <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                            <SelectTrigger id="company-filter-mobile" className="w-full">
                                <SelectValue placeholder="Select a company" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    <div className="flex items-center gap-2">
                                        <Building className="h-4 w-4" />
                                        All Companies
                                    </div>
                                </SelectItem>
                                {companies.map(company => (
                                    <SelectItem key={company.id} value={company.id}>
                                        {company.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="grid items-center flex-1">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                id="date-mobile"
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !customDateRange && dateRangeOption === 'all' && "text-muted-foreground"
                                )}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRangeOption === 'custom' && customDateRange?.from ? (
                                    customDateRange.to ? (
                                    <>
                                        {format(customDateRange.from, "LLL dd, y")} -{" "}
                                        {format(customDateRange.to, "LLL dd, y")}
                                    </>
                                    ) : (
                                    format(customDateRange.from, "LLL dd, y")
                                    )
                                ) : (
                                    {
                                    'all': 'All Time',
                                    '7d': 'Last 7 Days',
                                    '30d': 'Last 30 Days',
                                    '90d': 'Last 90 Days',
                                    'custom': 'Custom Range'
                                    }[dateRangeOption] || 'Select a date range'
                                )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <Select
                                    onValueChange={(value) => {
                                        setDateRangeOption(value);
                                        if (value !== 'custom') {
                                            setCustomDateRange(undefined);
                                        }
                                    }}
                                    value={dateRangeOption}
                                >
                                    <SelectTrigger className="w-full border-0 rounded-b-none focus:ring-0">
                                        <SelectValue placeholder="Select a range" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Time</SelectItem>
                                        <SelectItem value="7d">Last 7 Days</SelectItem>
                                        <SelectItem value="30d">Last 30 Days</SelectItem>
                                        <SelectItem value="90d">Last 90 Days</SelectItem>
                                        <SelectItem value="custom">Custom Range</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={customDateRange?.from}
                                    selected={customDateRange}
                                    onSelect={(range) => {
                                        setCustomDateRange(range)
                                        if(range) setDateRangeOption('custom')
                                    }}
                                    numberOfMonths={1}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            )}
          <MainView 
              activeView={activeView} 
              emails={emails}
              isLoading={isLoading}
              error={error}
              onRefresh={() => { /* No-op, handled by real-time listener */ }}
              filters={filters}
              dashboardFilters={{
                companies,
                selectedCompanyId,
                dateRangeOption,
                customDateRange
              }}
          />
        </main>
        
        {activeView === 'tickets' && <TicketsFilter onApplyFilters={onApplyFilters} />}
      </div>
  );
}

export default function DashboardPage() {
  return (
      <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"></div>}>
        <SidebarProvider>
            <HomePageContent />
        </SidebarProvider>
      </React.Suspense>
  )
}
