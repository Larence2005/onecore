
import { getDocs, collection, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getLatestEmails, checkTicketDeadlinesAndNotify } from '@/app/actions';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Defaults to auto
// To secure this endpoint, you would typically check for a secret token
// passed in the request headers or use a service that provides authentication.
// For example, in Vercel, you can check for `req.headers.get('x-vercel-cron-secret')`.

export async function GET(request: Request) {
  try {
    const organizationsRef = collection(db, 'organizations');
    const orgsSnapshot = await getDocs(organizationsRef);

    if (orgsSnapshot.empty) {
      console.log("No organizations found to process.");
      return NextResponse.json({ success: true, message: "No organizations to process." });
    }

    const processingPromises = orgsSnapshot.docs.map(async (orgDoc) => {
      const organizationId = orgDoc.id;
      
      console.log(`Processing jobs for organization: ${organizationId}`);
      
      try {
        // Run email sync and deadline checks for each organization
        await getLatestEmails(organizationId);
        await checkTicketDeadlinesAndNotify(organizationId);

        return { organizationId, status: 'success' };
      } catch (error) {
        console.error(`Failed to process jobs for organization ${organizationId}:`, error);
        return { organizationId, status: 'failed', error: (error as Error).message };
      }
    });

    const results = await Promise.all(processingPromises);

    return NextResponse.json({
      success: true,
      message: 'Cron jobs completed for all organizations.',
      results,
    });

  } catch (error) {
    console.error('An unexpected error occurred in the cron job:', error);
    return NextResponse.json(
      { success: false, message: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
