
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider-new';
import { getOrganizationMembers } from '@/app/actions-new';
import type { OrganizationMember } from '@/app/actions-new';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';

export interface FilterState {
  search: string;
  agents: string[];
  statuses: string[];
  priorities: string[];
  types: string[];
  tags: string;
  created: string;
  dateRange?: DateRange;
}

interface TicketsFilterProps {
  onApplyFilters: (filters: FilterState) => void;
}

const statusOptions = ['Open', 'Pending', 'Resolved', 'Closed'];
const priorityOptions = ['None', 'Low', 'Medium', 'High', 'Urgent'];
const typeOptions = ['Questions', 'Incident', 'Problem', 'Feature Request'];

export function TicketsFilter({ onApplyFilters }: TicketsFilterProps) {
  const { user, userProfile } = useAuth();
  const [search, setSearch] = useState('');
  const [agents, setAgents] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [tags, setTags] = useState('');
  const [created, setCreated] = useState('any');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [agentOptions, setAgentOptions] = useState<OrganizationMember[]>([]);

  const isOwner = user?.uid === userProfile?.organizationOwnerUid;

  useEffect(() => {
    if (isOwner && userProfile?.organizationId) {
      getOrganizationMembers(userProfile.organizationId).then(setAgentOptions);
    }
  }, [isOwner, userProfile]);

  const handleCheckboxChange = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  };

  const handleApply = useCallback(() => {
    onApplyFilters({ search, agents, statuses, priorities, types, tags, created, dateRange });
  }, [search, agents, statuses, priorities, types, tags, created, dateRange, onApplyFilters]);


  const clearFilters = () => {
    setSearch('');
    setAgents([]);
    setStatuses([]);
    setPriorities([]);
    setTypes([]);
    setTags('');
    setCreated('any');
    setDateRange(undefined);
  };
  
  useEffect(() => {
    handleApply();
  }, [handleApply]);


  const appliedFiltersCount = [search, tags, ...agents, ...statuses, ...priorities, ...types, created !== 'any' ? created : null, dateRange].filter(Boolean).length;

  return (
    <aside className="hidden lg:block w-72 border-l">
      <div className="sticky top-0 h-screen flex flex-col">
        <div className="flex-shrink-0 p-4 border-b">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Filters</h2>
            {appliedFiltersCount > 0 && (
                <Button variant="link" size="sm" onClick={clearFilters}>
                    Clear ({appliedFiltersCount})
                </Button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search tickets..." 
                className="pl-9" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-grow overflow-y-auto no-scrollbar">
          <Accordion type="multiple" defaultValue={['status', 'priority', 'type', 'agents', 'tags', 'created']} className="w-full">
            {isOwner && (
              <AccordionItem value="agents">
                <AccordionTrigger className="px-4 text-base font-semibold">Agents</AccordionTrigger>
                <AccordionContent className="px-4">
                  <div className="space-y-2">
                    {agentOptions.filter(agent => agent.uid).map(agent => (
                      <div key={agent.uid} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`agent-${agent.uid}`} 
                          checked={agents.includes(agent.uid!)} 
                          onCheckedChange={() => handleCheckboxChange(setAgents, agent.uid!)}
                        />
                        <Label htmlFor={`agent-${agent.uid}`} className="font-normal">{agent.name}</Label>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
            <AccordionItem value="status">
              <AccordionTrigger className="px-4 text-base font-semibold">Status</AccordionTrigger>
              <AccordionContent className="px-4">
                <div className="space-y-2">
                  {statusOptions.map(status => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`status-${status}`} 
                        checked={statuses.includes(status)} 
                        onCheckedChange={() => handleCheckboxChange(setStatuses, status)}
                      />
                      <Label htmlFor={`status-${status}`} className="font-normal">{status}</Label>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="priority">
              <AccordionTrigger className="px-4 text-base font-semibold">Priority</AccordionTrigger>
              <AccordionContent className="px-4">
                <div className="space-y-2">
                  {priorityOptions.map(priority => (
                    <div key={priority} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`priority-${priority}`} 
                        checked={priorities.includes(priority)} 
                        onCheckedChange={() => handleCheckboxChange(setPriorities, priority)}
                      />
                      <Label htmlFor={`priority-${priority}`} className="font-normal">{priority}</Label>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
             <AccordionItem value="type">
              <AccordionTrigger className="px-4 text-base font-semibold">Type</AccordionTrigger>
              <AccordionContent className="px-4">
                <div className="space-y-2">
                  {typeOptions.map(type => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`type-${type}`} 
                        checked={types.includes(type)} 
                        onCheckedChange={() => handleCheckboxChange(setTypes, type)}
                      />
                      <Label htmlFor={`type-${type}`} className="font-normal">{type}</Label>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
             <AccordionItem value="tags">
              <AccordionTrigger className="px-4 text-base font-semibold">Tags / Company</AccordionTrigger>
              <AccordionContent className="px-4">
                <Input 
                    placeholder="Filter by tags or company" 
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="created">
              <AccordionTrigger className="px-4 text-base font-semibold">Date Created</AccordionTrigger>
              <AccordionContent className="px-4 space-y-2">
                <Select value={created} onValueChange={(value) => {
                    setCreated(value);
                    if (value !== 'custom') {
                        setDateRange(undefined);
                    }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-full justify-start text-left font-normal",
                            !dateRange && "text-muted-foreground",
                            created !== 'custom' && "hidden"
                        )}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                            dateRange.to ? (
                            <>
                                {format(dateRange.from, "LLL dd, y")} -{" "}
                                {format(dateRange.to, "LLL dd, y")}
                            </>
                            ) : (
                            format(dateRange.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Pick a date</span>
                        )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={(range) => {
                            setDateRange(range);
                            if (range) setCreated('custom');
                        }}
                        numberOfMonths={1}
                        />
                    </PopoverContent>
                </Popover>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </aside>
  );
}
