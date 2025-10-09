// This is the Server Component page
import { CompanyTicketsPageContent } from '@/components/company-tickets-view';
import { SidebarProvider } from '@/components/ui/sidebar';

export default function CompanyTicketsPage({ params }: { params: { id: string } }) {
  // Pass the ID as a prop to the Client Component
  return (
    <SidebarProvider>
      <CompanyTicketsPageContent companyId={params.id} />
    </SidebarProvider>
  );
}
