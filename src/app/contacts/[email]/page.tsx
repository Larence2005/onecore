// This is the Server Component page
import { ContactProfilePageContent } from '@/components/contact-profile';

export default function ContactProfilePage({ params }: { params: { email: string } }) {
  // Decode the email parameter at the server level
  const decodedEmail = decodeURIComponent(params.email);

  // Pass the decoded email as a prop to the Client Component
  return <ContactProfilePageContent email={decodedEmail} />;
}
