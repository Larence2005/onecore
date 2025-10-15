
"use client";

import { useEffect, useState, useMemo } from 'react';
import type { Email, ActivityLog, Company } from '@/app/actions';
import { getTicketsFromDB, getAllActivityLogs } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Ticket, Clock, CheckCircle, AlertTriangle, CalendarClock, Activity, Building, Calendar as CalendarIcon, ListChecks, HelpCircle, Archive } from 'lucide-react';
import { Bar, BarChart, Pie, PieChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Cell } from 'recharts';
import { isToday, parseISO, isPast, isFuture, differenceInCalendarDays, subDays, isAfter, format, isBefore } from 'date-fns';
import { Badge } from './ui/badge';
import Link from 'next/link';
import { useAuth } from '@/providers/auth-provider';
import { TimelineItem } from './timeline-item';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';


const StatCard = ({ title, value, icon: Icon, iconClassName }: { title: string, value: string | number, icon: React.ElementType, iconClassName?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className={cn("h-4 w-4 text-muted-foreground", iconClassName)} />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

interface DashboardViewProps {
  companies: Company[];
  selectedCompanyId: string;
  dateRangeOption: string;
  customDateRange?: DateRange;
}

export function DashboardView({ companies, selectedCompanyId, dateRangeOption, customDateRange }: DashboardViewProps) {
    const { user, userProfile } = useAuth();
    const [tickets, setTickets] = useState<Email[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (!userProfile?.organizationId) return;

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Fetch all tickets including archived for historical data
                const [allTickets, allLogs] = await Promise.all([
                    getTicketsFromDB(userProfile.organizationId!, { fetchAll: true }),
                    getAllActivityLogs(userProfile.organizationId!),
                ]);

                setTickets(allTickets);
                setActivityLogs(allLogs);

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
                setError(errorMessage);
                toast({
                    variant: "destructive",
                    title: "Failed to load dashboard data.",
                    description: errorMessage,
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [userProfile, toast]);
    
    const stats = useMemo(() => {
        const isOwner = user?.uid === userProfile?.organizationOwnerUid;

        const agentFilteredTickets = isOwner || !user?.uid 
            ? tickets 
            : tickets.filter(t => t.assignee === user.uid);

        const companyFilteredTickets = selectedCompanyId === 'all'
            ? agentFilteredTickets
            : agentFilteredTickets.filter(t => t.companyId === selectedCompanyId);

        // This is the total, calculated *before* date filtering.
        const totalTickets = companyFilteredTickets.length;

        const dateFilteredTickets = companyFilteredTickets.filter(t => {
            const ticketDate = parseISO(t.receivedDateTime);
            
            if (dateRangeOption !== 'custom' && dateRangeOption !== 'all') {
                let startDate: Date;
                if (dateRangeOption === '7d') {
                    startDate = subDays(new Date(), 7);
                } else if (dateRangeOption === '30d') {
                    startDate = subDays(new Date(), 30);
                } else if (dateRangeOption === '90d') {
                    startDate = subDays(new Date(), 90);
                } else {
                    return true; // Should not happen
                }
                return isAfter(ticketDate, startDate);
            } else if (dateRangeOption === 'custom' && customDateRange?.from) {
                 const toDate = customDateRange.to || new Date(); // Use today if 'to' is not set
                 return isAfter(ticketDate, customDateRange.from) && isBefore(ticketDate, toDate);
            }
            // If 'all' or custom is not fully selected, include all tickets from company filter
            return true;
        });

        const unresolvedTickets = dateFilteredTickets.filter(t => t.status !== 'Resolved' && t.status !== 'Closed' && t.status !== 'Archived').length;
        const archivedTickets = dateFilteredTickets.filter(t => t.status === 'Archived').length;
        const pendingTickets = dateFilteredTickets.filter(t => t.status === 'Pending').length;
        const resolvedToday = dateFilteredTickets.filter(t => t.closedAt && isToday(parseISO(t.closedAt))).length;
        const overdueTickets = dateFilteredTickets.filter(t => t.deadline && isPast(parseISO(t.deadline)) && t.status !== 'Resolved' && t.status !== 'Closed').length;

        const ticketsByStatus = dateFilteredTickets.reduce((acc, ticket) => {
            const status = ticket.status;
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        const statusData = Object.keys(ticketsByStatus).map(status => ({
            name: status,
            value: ticketsByStatus[status]
        }));
        
        const ticketsByPriority = dateFilteredTickets.reduce((acc, ticket) => {
            const priority = ticket.priority;
            acc[priority] = (acc[priority] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const priorityData = Object.keys(ticketsByPriority).map(priority => ({
            name: priority,
            value: ticketsByPriority[priority]
        }));
        
        const ticketsByType = dateFilteredTickets.reduce((acc, ticket) => {
            const type = ticket.type || 'Incident'; // Default to Incident if type is not set
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const typeData = Object.keys(ticketsByType).map(type => ({
            name: type,
            value: ticketsByType[type]
        }));

        const upcomingDeadlines = dateFilteredTickets
            .filter(t => t.ticketNumber && t.deadline && isFuture(parseISO(t.deadline)) && t.status !== 'Resolved' && t.status !== 'Closed')
            .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
            .slice(0, 5);
        
        return { totalTickets, unresolvedTickets, archivedTickets, pendingTickets, resolvedToday, overdueTickets, statusData, priorityData, typeData, upcomingDeadlines };
    }, [tickets, selectedCompanyId, dateRangeOption, customDateRange, user, userProfile]);

    const PRIORITY_COLORS: {[key: string]: string} = {
        'None': '#9ca3af',
        'Low': '#22c55e',
        'Medium': '#3b82f6',
        'High': '#f97316',
        'Urgent': '#ef4444',
    };
    
    const STATUS_COLORS: {[key: string]: string} = {
        'Open': '#3b82f6',
        'Pending': '#f97316',
        'Resolved': '#22c55e',
        'Closed': '#ef4444',
        'Archived': '#6b7280',
    };

    const TYPE_COLORS: {[key: string]: string} = {
        'Questions': '#3b82f6',
        'Incident': '#f97316',
        'Problem': '#ef4444',
        'Feature Request': '#8b5cf6',
    };

    const getDaysLeftBadge = (deadline: string) => {
        const days = differenceInCalendarDays(parseISO(deadline), new Date());
        if (days < 0) return null; // Should be filtered out already
        if (days === 0) return <Badge variant="destructive">Today</Badge>;
        if (days <= 3) return <Badge variant="destructive">{days}d left</Badge>;
        if (days <= 7) return <Badge variant="secondary" className="bg-yellow-500 text-white">{days}d left</Badge>;
        return <Badge variant="outline">{days}d left</Badge>;
    };


    if (isLoading) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                    <Skeleton className="h-[108px] w-full" />
                    <Skeleton className="h-[108px] w-full" />
                    <Skeleton className="h-[108px] w-full" />
                    <Skeleton className="h-[108px] w-full" />
                    <Skeleton className="h-[108px] w-full" />
                    <Skeleton className="h-[108px] w-full" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                    <Skeleton className="h-[300px] w-full" />
                    <Skeleton className="h-[300px] w-full" />
                </div>
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                    <Skeleton className="h-[300px] w-full" />
                    <Skeleton className="h-[300px] w-full" />
                </div>
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="flex h-full items-center justify-center p-4">
                <Alert variant="destructive" className="max-w-2xl">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Error Loading Dashboard</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
                <StatCard title="Total Tickets" value={stats.totalTickets} icon={Ticket} iconClassName="text-blue-500" />
                <StatCard title="Unresolved" value={stats.unresolvedTickets} icon={HelpCircle} iconClassName="text-yellow-500" />
                <StatCard title="Archived" value={stats.archivedTickets} icon={Archive} iconClassName="text-gray-500" />
                <StatCard title="Pending" value={stats.pendingTickets} icon={Clock} iconClassName="text-orange-500" />
                <StatCard title="Resolved Today" value={stats.resolvedToday} icon={CheckCircle} iconClassName="text-green-500" />
                <StatCard title="Overdue" value={stats.overdueTickets} icon={AlertTriangle} iconClassName="text-red-500" />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Tickets by Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                             <PieChart>
                                <Pie
                                    data={stats.statusData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                    nameKey="name"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {stats.statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#8884d8'} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Tickets by Priority</CardTitle>
                    </CardHeader>
                    <CardContent>
                         <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={stats.priorityData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                    nameKey="name"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {stats.priorityData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.name] || '#8884d8'} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Tickets by Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                           <BarChart layout="vertical" data={stats.typeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tickLine={false} axisLine={false} />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="value" layout="vertical" radius={[0, 4, 4, 0]}>
                                    {stats.typeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={TYPE_COLORS[entry.name] || '#8884d8'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CalendarClock className="h-5 w-5" />
                            Upcoming Deadlines
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {stats.upcomingDeadlines.length > 0 ? (
                            <div className="space-y-4">
                                {stats.upcomingDeadlines.map(ticket => (
                                    <div key={ticket.id} className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <Link href={`/tickets/${ticket.id}`} className="font-medium text-sm truncate block hover:underline" title={ticket.subject}>
                                                {ticket.ticketNumber && <span className="text-muted-foreground">#{ticket.ticketNumber}</span>} {ticket.subject}
                                            </Link>
                                            <p className="text-xs text-muted-foreground">
                                                {ticket.sender}
                                            </p>
                                        </div>
                                        {ticket.deadline && getDaysLeftBadge(ticket.deadline)}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-sm text-muted-foreground py-8">
                                <p>No upcoming deadlines.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        All Activity
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 max-h-96 overflow-y-auto">
                    {activityLogs.length > 0 ? (
                        activityLogs.map((log) => (
                            <TimelineItem key={log.id} type={log.type} date={log.date} user={log.user}>
                                <div className="flex flex-wrap items-center gap-x-2">
                                   <span>{log.details} on ticket</span> 
                                   <Link href={`/tickets/${log.ticketId}`} className="font-semibold hover:underline truncate" title={log.ticketSubject}>
                                        {log.ticketSubject}
                                   </Link>
                                </div>
                            </TimelineItem>
                        ))
                    ) : (
                        <div className="text-center text-sm text-muted-foreground py-8">
                             <p>No recent activity across all tickets.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
