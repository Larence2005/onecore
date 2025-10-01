# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Cron Job Setup (Vercel)

This project uses a cron job to automatically fetch new emails from the server. To secure this, you need to set an environment variable in your Vercel project:

1.  **Generate a Secret**: Create a long, random, and secure string. You can use a password generator for this.
2.  **Set Environment Variable**: In your Vercel project settings, go to **Settings > Environment Variables** and add a new variable:
    -   **Name**: `CRON_SECRET`
    -   **Value**: The secret string you generated.

The cron job is configured in `vercel.json` to run every 5 minutes.
