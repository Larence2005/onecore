
import { ContactProfile } from "@/components/contact-profile";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function ContactProfilePage({ params }: { params: { email: string } }) {
  return (
    <SidebarProvider>
      <ContactProfile email={decodeURIComponent(params.email)} />
    </SidebarProvider>
  );
}
