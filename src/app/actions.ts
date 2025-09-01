
"use server";

import type { Settings } from '@/providers/settings-provider';
import {
    ConfidentialClientApplication,
    Configuration,
    AuthenticationResult
} from '@azure/msal-node';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';


export interface Email {
    id: string;
    subject: string;
    sender: string;
    bodyPreview: string;
    receivedDateTime: string;
    priority: string;
    assignee: string;
    status: string;
}

export interface DetailedEmail extends Email {
    body: {
        contentType: string;
        content: string;
    };
}

const getMsalConfig = (settings: Settings): Configuration => ({
    auth: {
        clientId: settings.clientId,
        authority: `https://login.microsoftonline.com/${settings.tenantId}`,
        clientSecret: settings.clientSecret,
    },
});

async function getAccessToken(settings: Settings): Promise<AuthenticationResult | null> {
    const msalConfig = getMsalConfig(settings);
    const cca = new ConfidentialClientApplication(msalConfig);
    const tokenRequest = {
        scopes: ['https://graph.microsoft.com/.default'],
    };

    return await cca.acquireTokenByClientCredential(tokenRequest);
}


export async function getLatestEmails(settings: Settings): Promise<Email[]> {
    const authResponse = await getAccessToken(settings);
    if (!authResponse?.accessToken) {
        throw new Error('Failed to acquire access token.');
    }

    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${settings.userId}/mailFolders/inbox/messages?$top=10&$select=id,subject,from,bodyPreview,receivedDateTime&$orderby=receivedDateTime desc`, {
        headers: {
            Authorization: `Bearer ${authResponse.accessToken}`,
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to fetch emails: ${error.error?.message || response.statusText}`);
    }

    const data: { value: { id: string, subject: string, from: { emailAddress: { address: string, name: string } }, bodyPreview: string, receivedDateTime: string }[] } = await response.json() as any;

    const emails = await Promise.all(data.value.map(async (email) => {
        const ticketDocRef = doc(db, 'tickets', email.id);
        const ticketDoc = await getDoc(ticketDocRef);

        let ticketData;

        if (!ticketDoc.exists()) {
            const newTicketData = {
                title: email.subject || 'No Subject',
                priority: 'Low',
                assignee: 'Unassigned',
                status: 'Open',
            };
            await setDoc(ticketDocRef, newTicketData);
            ticketData = newTicketData;
        } else {
            ticketData = ticketDoc.data();
        }

        return {
            id: email.id,
            subject: email.subject || 'No Subject',
            sender: email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unknown Sender',
            bodyPreview: email.bodyPreview,
            receivedDateTime: email.receivedDateTime,
            priority: ticketData?.priority || 'Low',
            assignee: ticketData?.assignee || 'Unassigned',
            status: ticketData?.status || 'Open',
        };
    }));


    return emails;
}


export async function getEmail(settings: Settings, id: string): Promise<DetailedEmail> {
    const authResponse = await getAccessToken(settings);
    if (!authResponse?.accessToken) {
        throw new Error('Failed to acquire access token.');
    }

    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${settings.userId}/messages/${id}?$select=id,subject,from,body,receivedDateTime,bodyPreview`, {
        headers: {
            Authorization: `Bearer ${authResponse.accessToken}`,
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to fetch email: ${error.error?.message || response.statusText}`);
    }

    const emailData: { id: string, subject: string, from: { emailAddress: { address: string, name: string } }, body: { contentType: string, content: string }, receivedDateTime: string, bodyPreview: string } = await response.json() as any;

    const ticketDocRef = doc(db, 'tickets', id);
    const ticketDoc = await getDoc(ticketDocRef);
    const ticketData = ticketDoc.data();

    return {
        id: emailData.id,
        subject: emailData.subject || 'No Subject',
        sender: emailData.from?.emailAddress?.name || emailData.from?.emailAddress?.address || 'Unknown Sender',
        body: emailData.body,
        receivedDateTime: emailData.receivedDateTime,
        bodyPreview: emailData.bodyPreview,
        priority: ticketData?.priority || 'Low',
        assignee: ticketData?.assignee || 'Unassigned',
        status: ticketData?.status || 'Open',
    };
}


export async function sendEmailAction(settings: Settings, emailData: {recipient: string, subject: string, body: string}): Promise<{ success: boolean }> {
    const authResponse = await getAccessToken(settings);
    if (!authResponse?.accessToken) {
        throw new Error('Failed to acquire access token.');
    }

    const message = {
        message: {
            subject: emailData.subject,
            body: {
                contentType: 'Text',
                content: emailData.body,
            },
            toRecipients: [
                {
                    emailAddress: {
                        address: emailData.recipient,
                    },
                },
            ],
        },
        saveToSentItems: 'true',
    };

    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${settings.userId}/sendMail`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${authResponse.accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to send email: ${error.error?.message || response.statusText}`);
    }

    return { success: true };
}
