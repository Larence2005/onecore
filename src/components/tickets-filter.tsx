
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';

export interface FilterState {
  search: string;
  agents: string[];
  groups: string[];
  statuses: string[];
  created: string;
}

interface TicketsFilterProps {
  onApplyFilters: (filters: FilterState) => void;
}

const agentOptions = ['John Doe', 'Jane Smith', 'Unassigned'];
const groupOptions = ['Support', 'Sales', 'Engineering'];
const statusOptions = ['Open', 'Pending', 'Resolved', 'Closed'];

export function TicketsFilter({ onApplyFilters }: TicketsFilterProps) {
  const [search, setSearch] = useState('');
  const [agents, setAgents] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [created, setCreated] = useState('any');

  const handleAgentChange = (agent: string) => {
    setAgents(prev => prev.includes(agent) ? prev.filter(a => a !== agent) : [...prev, agent]);
  };

  const handleGroupChange = (group: string) => {
    setGroups(prev => prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]);
  };

  const handleStatusChange = (status: string) => {
    setStatuses(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
  };
  
  const handleApply = () => {
    onApplyFilters({ search, agents, groups, statuses, created });
  };


  const clearFilters = () => {
    setSearch('');
    setAgents([]);
    setGroups([]);
    setStatuses([]);
    setCreated('any');
  };
  
  useEffect(() => {
    // This effect ensures that clearing filters locally also propagates the changes.
    onApplyFilters({ search, agents, groups, statuses, created });
  }, [search, agents, groups, statuses, created, onApplyFilters]);


  const appliedFiltersCount = [search, ...agents, ...groups, ...statuses, created !== 'any' ? created : null].filter(Boolean).length;

  return (
    <aside className="hidden lg:block w-80 border-l bg-card">
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
        <div className="flex-grow overflow-y-auto">
          <Accordion type="multiple" defaultValue={['status', 'agents']} className="w-full">
            <AccordionItem value="status">
              <AccordionTrigger className="px-4 text-base font-semibold">Status</AccordionTrigger>
              <AccordionContent className="px-4">
                <div className="space-y-2">
                  {statusOptions.map(status => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`status-${status}`} 
                        checked={statuses.includes(status)} 
                        onCheckedChange={() => handleStatusChange(status)}
                      />
                      <Label htmlFor={`status-${status}`} className="font-normal">{status}</Label>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="agents">
              <AccordionTrigger className="px-4 text-base font-semibold">Agents</AccordionTrigger>
              <AccordionContent className="px-4">
                <div className="space-y-2">
                  {agentOptions.map(agent => (
                    <div key={agent} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`agent-${agent}`} 
                        checked={agents.includes(agent)}
                        onCheckedChange={() => handleAgentChange(agent)}
                      />
                      <Label htmlFor={`agent-${agent}`} className="font-normal">{agent}</Label>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="groups">
              <AccordionTrigger className="px-4 text-base font-semibold">Groups</AccordionTrigger>
              <AccordionContent className="px-4">
                <div className="space-y-2">
                  {groupOptions.map(group => (
                    <div key={group} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`group-${group}`} 
                        checked={groups.includes(group)}
                        onCheckedChange={() => handleGroupChange(group)}
                       />
                      <Label htmlFor={`group-${group}`} className="font-normal">{group}</Label>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="created">
              <AccordionTrigger className="px-4 text-base font-semibold">Date Created</AccordionTrigger>
              <AccordionContent className="px-4">
                <Select value={created} onValueChange={setCreated}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        <div className="p-4 border-t flex-shrink-0">
            <Button className="w-full" onClick={handleApply}>Apply Filters</Button>
        </div>
      </div>
    </aside>
  );
}
