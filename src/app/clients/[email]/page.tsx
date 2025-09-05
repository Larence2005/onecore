"use client";

import { ClientProfile } from "@/components/client-profile";

// This is the main page component.
// It receives the `params` from the URL and passes the email to the client component.
export default function ClientProfilePage({ params }: { params: { email: string } }) {
  // The client-side logic is now fully encapsulated in ClientProfile.
  return <ClientProfile email={decodeURIComponent(params.email)} />;
}
