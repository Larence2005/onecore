// This is the Server Component page
import { CompanyTicketsPageContent } from '@/components/company-tickets-view';

export default function CompanyTicketsPage({ params }: { params: { id: string } }) {
  // Pass the ID as a prop to the Client Component
  return <CompanyTicketsPageContent companyId={params.id} />;
}
