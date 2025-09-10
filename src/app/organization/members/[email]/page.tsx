
import { AgentProfile } from "@/components/agent-profile";

export default function AgentProfilePage({ params }: { params: { email: string } }) {
  return <AgentProfile email={decodeURIComponent(params.email)} />;
}
