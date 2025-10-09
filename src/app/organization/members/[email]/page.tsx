// This is the Server Component page
import { AgentProfilePageContent } from '@/components/agent-profile';

export default function AgentProfilePage({ params }: { params: { email: string } }) {
  // Decode the email parameter at the server level
  const decodedEmail = decodeURIComponent(params.email);

  // Pass the decoded email as a prop to the Client Component
  return <AgentProfilePageContent email={decodedEmail} />;
}
