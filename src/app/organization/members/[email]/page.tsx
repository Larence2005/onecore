
"use client";

import { AgentProfile } from "@/components/agent-profile";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function AgentProfilePage({ params }: { params: { email: string } }) {
  return (
    <SidebarProvider>
      <AgentProfile email={decodeURIComponent(params.email)} />
    </SidebarProvider>
  );
}
