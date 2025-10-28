"use client";

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { SettingsForm } from './settings-form';
import { SubscriptionView } from './subscription-view';
import { CreditCard, Settings } from 'lucide-react';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            General Settings
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Subscription & Billing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <SettingsForm />
        </TabsContent>

        <TabsContent value="subscription" className="mt-6">
          <SubscriptionView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
