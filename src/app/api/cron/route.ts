import { syncEmailsToTickets, checkTicketDeadlinesAndNotify } from '@/app/actions-new';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Verify Vercel Cron secret for security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.error('[Cron] Unauthorized access attempt');
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }
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
        // Sync emails to create/update tickets
        const emailSyncResult = await syncEmailsToTickets(org.id);
        console.log(`[${org.id}] Email sync result:`, emailSyncResult);
        
        // Check deadlines and send notifications
        const deadlineCheckResult = await checkTicketDeadlinesAndNotify(org.id);
        console.log(`[${org.id}] Deadline check result:`, deadlineCheckResult);
        
        return { 
          organizationId: org.id, 
          status: 'success',
          emailSync: emailSyncResult,
          deadlineCheck: deadlineCheckResult
        };
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
