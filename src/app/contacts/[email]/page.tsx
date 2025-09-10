
import { ContactProfile } from "@/components/contact-profile";

export default function ContactProfilePage({ params }: { params: { email: string } }) {
  return <ContactProfile email={decodeURIComponent(params.email)} />;
}
