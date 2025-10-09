
"use client";

import { CompanyTicketsView } from "@/components/company-tickets-view";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function CompanyTicketsPage({ params }: { params: { id: string } }) {
  return (
    <SidebarProvider>
      <CompanyTicketsView companyId={params.id} />
    </SidebarProvider>
  );
}
