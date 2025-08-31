import { Mail } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-4 flex items-center">
        <Mail className="h-7 w-7 text-primary" />
        <h1 className="ml-3 text-2xl font-headline font-bold text-foreground">
          Mailflow Manager
        </h1>
      </div>
    </header>
  );
}
