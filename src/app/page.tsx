import { Header } from '@/components/header';
import { Dashboard } from '@/components/dashboard';

export interface Email {
    id: string;
    subject: string;
    sender: string;
}

export interface NewEmail {
    recipient: string;
    subject: string;
    body: string;
}

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <Dashboard />
      </main>
    </div>
  );
}
