
import { CompanyTicketsView } from "@/components/company-tickets-view";

export default function CompanyTicketsPage({ params }: { params: { id: string } }) {
  return <CompanyTicketsView companyId={params.id} />;
}
