
import { AssigneeProfile } from "@/components/assignee-profile";

// This is the main page component.
// It receives the `params` from the URL and passes the email to the client component.
export default function AssigneeProfilePage({ params }: { params: { email: string } }) {
  // The client-side logic is now fully encapsulated in AssigneeProfile.
  return <AssigneeProfile email={decodeURIComponent(params.email)} />;
}

    

    