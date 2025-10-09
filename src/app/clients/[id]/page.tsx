
"use client";

import { CompanyTicketsView } from "@/components/company-tickets-view";
import { SidebarProvider } from "@/components/ui/sidebar";


function CompanyTicketsPageContent({ companyId }: { companyId: string }) {
  return (
    <SidebarProvider>
      <CompanyTicketsView companyId={companyId} />
    </SidebarProvider>
  )
}

// The page is now a Server Component that passes params to the Client Component.
export default function CompanyTicketsPage({ params }: { params: { id: string } }) {
  return (
      <CompanyTicketsPageContent companyId={params.id} />
  );
}
