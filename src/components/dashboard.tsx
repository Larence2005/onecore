import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReadEmails } from '@/components/read-emails';
import { SendEmailForm } from '@/components/send-email-form';
import { SettingsForm } from '@/components/settings-form';
import { Inbox, Send, Settings } from 'lucide-react';

export function Dashboard() {
  return (
    <Tabs defaultValue="inbox" className="w-full">
      <TabsList className="grid w-full grid-cols-3 max-w-2xl mx-auto">
        <TabsTrigger value="inbox">
          <Inbox className="mr-2 h-4 w-4" />
          Inbox
        </TabsTrigger>
        <TabsTrigger value="compose">
          <Send className="mr-2 h-4 w-4" />
          Compose
        </TabsTrigger>
        <TabsTrigger value="settings">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </TabsTrigger>
      </TabsList>
      <TabsContent value="inbox" className="mt-6">
        <ReadEmails />
      </TabsContent>
      <TabsContent value="compose" className="mt-6">
        <SendEmailForm />
      </TabsContent>
      <TabsContent value="settings" className="mt-6">
        <SettingsForm />
      </TabsContent>
    </Tabs>
  );
}
