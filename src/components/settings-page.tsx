"use client";

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { SettingsForm } from './settings-form';
import { SubscriptionView } from './subscription-view';
import { CreditCard, Settings } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider-new';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const { user, userProfile } = useAuth();
  
  // Check if current user is the organization owner
  const isOwner = user?.id === userProfile?.organizationOwnerUid;

  return (
    <div className="w-full max-w-7xl mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full max-w-md ${isOwner ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            General Settings
          </TabsTrigger>
          {isOwner && (
            <TabsTrigger value="subscription" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Subscription & Billing
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <SettingsForm />
        </TabsContent>

        {isOwner && (
          <TabsContent value="subscription" className="mt-4">
            <SubscriptionView />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
