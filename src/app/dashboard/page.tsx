
"use client";

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { useAuth } from '@/providers/auth-provider-new';
import { useRouter, useSearchParams } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarFooter, SidebarInset, useSidebar } from '@/components/ui/sidebar';
import { MainView } from '@/components/main-view';
import { LayoutDashboard, List, Users, Building2, Settings, LogOut, Search, Pencil, Archive, Building, Calendar as CalendarIcon, PlusCircle } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/header';
import { cn } from '@/lib/utils';
import { TicketsFilter } from '@/components/tickets-filter';
import type { Email, DetailedEmail } from '@/app/actions-types';
import type { Company, OrganizationMember } from '@/app/actions-new';
import { getCompanies, getOrganizationMembers, getTicketsFromDB, syncEmailsToTickets } from '@/app/actions-new';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import Link from 'next/link';


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

    const fetchTickets = async (isInitialLoad = false) => {
      try {
        // Only sync emails on initial load or manual refresh, not on every poll
        if (isInitialLoad) {
          await syncEmailsToTickets(userProfile.organizationId!);
        }
        
        // Fetch all data - no caching
        const [fetchedTickets, fetchedCompanies, members] = await Promise.all([
          getTicketsFromDB(userProfile.organizationId!),
          getCompanies(userProfile.organizationId!),
          getOrganizationMembers(userProfile.organizationId!)
        ]);

        // Filter tickets based on user role
        const isOwner = user.id === userProfile.organizationOwnerUid;
        const isClient = userProfile.isClient === true;
        
        let filteredTickets;
        if (isOwner) {
          filteredTickets = fetchedTickets; // Admin sees all tickets
        } else if (isClient) {
          // Client sees tickets they created (where they are the sender)
          filteredTickets = fetchedTickets.filter(ticket => 
            ticket.senderEmail?.toLowerCase() === userProfile.email?.toLowerCase()
          );
        } else {
          // Agent sees only their assigned tickets
          filteredTickets = fetchedTickets.filter(ticket => ticket.assignee === user.id);
        }

        setEmails(filteredTickets);
        setCompanies(fetchedCompanies);
        if (isInitialLoad) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching tickets:', error);
        setError('Failed to load tickets');
        if (isInitialLoad) {
          setIsLoading(false);
        }
      }
    };

    // Initial fetch
    fetchTickets(true);

    // Smart polling with activity detection
    let pollInterval: NodeJS.Timeout | null = null;
    let lastActivityTime = Date.now();
    let currentInterval = 30000; // Start with 30 seconds

    const ACTIVE_INTERVAL = 30000;    // 30 seconds when active
    const IDLE_INTERVAL = 60000;     // 60 seconds when idle (no activity for 3 minutes)
    const IDLE_THRESHOLD = 180000;   // 3 minutes of inactivity

    const updatePollInterval = () => {
      const timeSinceActivity = Date.now() - lastActivityTime;
      const newInterval = timeSinceActivity > IDLE_THRESHOLD ? IDLE_INTERVAL : ACTIVE_INTERVAL;

      if (newInterval !== currentInterval) {
        currentInterval = newInterval;
        if (pollInterval) {
          clearInterval(pollInterval);
        }
        pollInterval = setInterval(() => {
          if (!document.hidden) {
            fetchTickets(false);
          }
        }, currentInterval);
        console.log(`[Smart Polling] Interval changed to ${currentInterval / 1000}s`);
      }
    };

    const handleActivity = () => {
      lastActivityTime = Date.now();
      updatePollInterval();
    };

    // Track user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Handle visibility change (stop polling when tab is hidden)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab became visible, fetch immediately and reset activity
        lastActivityTime = Date.now();
        fetchTickets(false);
        updatePollInterval();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Start initial polling
    pollInterval = setInterval(() => {
      if (!document.hidden) {
        fetchTickets(false);
        updatePollInterval();
      }
    }, currentInterval);

    // Cleanup
    return () => {
      if (pollInterval) clearInterval(pollInterval);
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
                    {isClient ? (
                        <div className="flex items-center gap-4">
                            <Avatar className="h-9 w-9">
                            <AvatarFallback>{userProfile?.name || user.email}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="font-medium text-sm">{userProfile?.name || user.email}</span>
                            </div>
                        </div>
                    ) : (
                        <Link href={`/organization/members/${encodeURIComponent(userProfile?.email!)}`} className="flex items-center gap-4 group">
                             <Avatar className="h-9 w-9">
                               <AvatarFallback>{userProfile?.name || user.email}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="font-medium text-sm group-hover:underline">{userProfile?.name || user.email}</span>
                            </div>
                        </Link>
                    )}
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
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={handleLogout}>
                        <LogOut className="text-red-500" />
                        <span>Log Out</span>
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

    