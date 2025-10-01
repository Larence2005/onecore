
'use server';

import { ai } from './genkit';
import { getLatestEmails } from '@/app/actions';
import { z } from 'zod';

export const getEmailsFlow = ai.defineFlow(
  {
    name: 'getEmailsFlow',
    inputSchema: z.object({ organizationId: z.string() }),
    outputSchema: z.void(),
  },
  async ({ organizationId }) => {
    await getLatestEmails(organizationId);
  }
);
