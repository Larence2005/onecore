import { getLatestEmails } from '@/app/actions-email';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// To secure this endpoint, check for a secret token in headers
// For example: req.headers.get('x-cron-secret') === process.env.CRON_SECRET

export async function GET(request: Request) {
  try {
    // Get all organizations from PostgreSQL
    const organizations = await prisma.organization.findMany({
      select: { id: true, name: true },
    });

    if (organizations.length === 0) {
      console.log("No organizations found to process.");
      return NextResponse.json({ success: true, message: "No organizations to process." });
    }

    const processingPromises = organizations.map(async (org) => {
      console.log(`Processing jobs for organization: ${org.name} (${org.id})`);
      
      try {
        // Fetch latest emails to create/update tickets
        await getLatestEmails(org.id);
        
        // Note: checkTicketDeadlinesAndNotify would need to be implemented
        // in actions-new.ts to work with PostgreSQL
        
        return { organizationId: org.id, status: 'success' };
      } catch (error) {
        console.error(`Failed to process jobs for organization ${org.id}:`, error);
        return { organizationId: org.id, status: 'failed', error: (error as Error).message };
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
