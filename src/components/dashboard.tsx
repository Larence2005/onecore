"use client";

import { ReadEmails } from '@/components/read-emails';
import { SendEmailForm } from '@/components/send-email-form';
import { SettingsForm } from '@/components/settings-form';

type DashboardProps = {
  activeView: 'inbox' | 'compose' | 'settings';
}

export function Dashboard({ activeView }: DashboardProps) {
  const renderActiveView = () => {
    switch (activeView) {
      case 'inbox':
        return <ReadEmails />;
      case 'compose':
        return <SendEmailForm />;
      case 'settings':
        return <SettingsForm />;
      default:
        return <ReadEmails />;
    }
  };

  return <div className="w-full mt-6">{renderActiveView()}</div>;
}
