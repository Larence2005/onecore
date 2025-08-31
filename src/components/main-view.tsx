
"use client";

import { Header } from '@/components/header';
import { ReadEmails } from '@/components/read-emails';
import { SettingsForm } from '@/components/settings-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

type MainViewProps = {
    activeView: 'analytics' | 'tickets' | 'clients' | 'organization' | 'settings';
}

export function MainView({ activeView }: MainViewProps) {

    const renderActiveView = () => {
        switch (activeView) {
            case 'analytics':
                return <div className="flex flex-1 items-center justify-center text-muted-foreground w-full h-full"><p>Analytics coming soon.</p></div>;
            case 'tickets':
                return <ReadEmails />;
            case 'clients':
                return <div className="flex flex-1 items-center justify-center text-muted-foreground w-full h-full"><p>Clients coming soon.</p></div>;
            case 'organization':
                return <div className="flex flex-1 items-center justify-center text-muted-foreground w-full h-full"><p>Organization coming soon.</p></div>;
            case 'settings':
                return <SettingsForm />;
            default:
                return <p>Select a view</p>;
        }
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto]">
            <div className="flex flex-col min-w-0">
                <Header />
                <main className="flex-1 flex flex-col overflow-y-auto">
                    <div className="p-4 sm:p-6 lg:p-8 flex-grow">
                        {renderActiveView()}
                    </div>
                </main>
            </div>
            
            {activeView === 'tickets' && (
                <aside className="hidden xl:block w-80 border-l">
                    <div className="sticky top-0 h-screen overflow-y-auto p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold">Filters</h2>
                            <Button variant="link" size="sm">Show applied filters</Button>
                        </div>
                        <div className="space-y-6">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search fields" className="pl-9" />
                            </div>

                            <Card>
                                <CardHeader className="p-4">
                                    <CardTitle className="text-base">Agents Include</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <Select>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Any agent" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="agent1">Agent 1</SelectItem>
                                        <SelectItem value="agent2">Agent 2</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="p-4">
                                    <CardTitle className="text-base">Groups Include</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <Select>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Any group" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="group1">Group 1</SelectItem>
                                        <SelectItem value="group2">Group 2</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="p-4">
                                    <CardTitle className="text-base">Created</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <Select>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Last 30 days" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="30d">Last 30 days</SelectItem>
                                        <SelectItem value="7d">Last 7 days</SelectItem>
                                        <SelectItem value="24h">Last 24 hours</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="p-4">
                                    <CardTitle className="text-base">Closed at</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <Select>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Any time" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="any">Any time</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="p-4">
                                    <CardTitle className="text-base">Resolved at</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <Select>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Any time" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="any">Any time</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </aside>
            )}
        </div>
    );
}
