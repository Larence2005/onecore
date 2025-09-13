
import { TicketDetailContent } from '@/components/ticket-detail-content';
import { headers } from 'next/headers';

// This is the main page component, now a true Server Component.
// It fetches data and passes it to the client component.
export default function TicketDetailPage({ params }: { params: { id: string } }) {
    // This component is now a Server Component, so we can access params directly.
    // The client-side logic is encapsulated in TicketDetailContent.

    const headersList = headers();
    const host = headersList.get('host');
    const protocol = headersList.get('x-forwarded-proto');

    const baseUrl = (host && protocol) ? `${protocol}://${host}` : undefined;

    return <TicketDetailContent id={params.id} baseUrl={baseUrl} />;
}
