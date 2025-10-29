# Vercel Cron Job Setup

## Overview
The application uses Vercel Cron Jobs to automatically:
1. **Sync emails** from Microsoft 365 and create tickets
2. **Check ticket deadlines** and send reminder notifications

## Configuration

### Cron Schedule
The cron job runs **every 1 minute** as configured in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "* * * * *"
    }
  ]
}
```

### Environment Variables Required

Add the following to your Vercel environment variables:

```bash
CRON_SECRET=your-secure-random-string-here
```

**Important:** Generate a secure random string for `CRON_SECRET`. This protects your cron endpoint from unauthorized access.

Example generation:
```bash
openssl rand -base64 32
```

### How It Works

1. **Vercel triggers** the cron job every minute
2. **Authentication**: The endpoint verifies the `CRON_SECRET` from the Authorization header
3. **For each organization**:
   - Syncs latest emails from Microsoft 365 inbox
   - Creates tickets from new emails (only from verified employees)
   - Checks all open tickets with deadlines
   - Sends email notifications for:
     - **Overdue tickets** (past deadline)
     - **Urgent reminders** (within 1 hour)
     - **Regular reminders** (within 24 hours)

### Functions Called

#### `/api/cron/route.ts`
- Main cron endpoint
- Authenticates requests
- Processes all organizations

#### `syncEmailsToTickets(organizationId)`
Located in `src/app/actions-new.ts`
- Fetches latest emails from Microsoft 365
- Filters out system emails and auto-replies
- Creates tickets only for verified employees
- Stores full conversation history

#### `checkTicketDeadlinesAndNotify(organizationId)`
Located in `src/app/actions-new.ts`
- Finds tickets with approaching/overdue deadlines
- Sends email notifications to assignees
- Logs notification activity

### Testing Locally

You can test the cron endpoint locally:

```bash
# Set CRON_SECRET in your .env file
CRON_SECRET=test-secret-123

# Call the endpoint
curl -X GET http://localhost:3000/api/cron \
  -H "Authorization: Bearer test-secret-123"
```

### Deployment

1. Add `CRON_SECRET` to Vercel environment variables
2. Deploy to Vercel
3. Vercel automatically configures the cron job based on `vercel.json`
4. Monitor logs in Vercel dashboard

### Monitoring

Check Vercel logs to see:
- Cron job execution times
- Number of emails synced
- Number of tickets created
- Number of deadline notifications sent
- Any errors during processing

### Notes

- Cron jobs work **without users being logged in**
- Email syncing happens automatically in the background
- Deadline notifications are sent even when admins/agents are offline
- Only tickets assigned to users with email addresses receive notifications
- Only open, in-progress, or pending tickets are checked for deadlines
