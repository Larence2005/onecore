
import { TicketDetailContent } from '@/components/ticket-detail-content';

// This is the main page component, now a true Server Component.
// It fetches data and passes it to the client component.
export default function TicketDetailPage({ params }: { params: { id: string } }) {
    // This component is now a Server Component, so we can access params directly.
    // The client-side logic is encapsulated in TicketDetailContent.
    return <TicketDetailContent id={params.id} />;
}
