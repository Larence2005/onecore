
import { NextResponse } from 'next/server';
import { checkTicketDeadlinesAndNotify } from '@/app/actions';
import { collection, getDocs } from 'firebase/firestore';
import { db }mport { getEmailsFlow } from '@/ai/get-emails-flow';

// This is a special variable that tells Next.js to not cache this route
// and to treat it as a dynamic function that runs on the server.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Secure the endpoint with a secret key from environment variables
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const organizationsRef = collection(db, 'organizations');
    const querySnapshot = await getDocs(organizationsRef);

    if (querySnapshot.empty) {
      console.log('No organizations found to process.');
      return NextResponse.json({ success: true, message: 'No organizations found.' });
    }

    const jobPromises = querySnapshot.docs.map(doc => {
      const organizationId = doc.id;
      console.log(`Processing jobs for organization: ${organizationId}`);
      
      const emailPromise = getEmailsFlow.run({ organizationId }).catch(error => {
        // Log errors per organization but don't fail the entire job
        console.error(`Failed to process emails for organization ${organizationId}:`, error);
      });

      const deadlinePromise = checkTicketDeadlinesAndNotify(organizationId).catch(error => {
        console.error(`Failed to check deadlines for organization ${organizationId}:`, error);
      });
      
      return Promise.allSettled([emailPromise, deadlinePromise]);
    });

    await Promise.all(jobPromises);

    return NextResponse.json({ success: true, message: 'Cron jobs completed for all organizations.' });
  } catch (error) {
    console.error('Cron job failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new NextResponse(errorMessage, { status: 500 });
  }
}
