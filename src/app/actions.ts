
"use server";

import type { Settings } from '@/providers/settings-provider';
import {
    ConfidentialClientApplication,
    Configuration,
    AuthenticationResult
} from '@azure/msal-node';
import type { NewEmail } from '@/app/page';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, runTransaction, collection, query, where, getDocs } from 'firebase/firestore';


export interface Email {
    id: string;
    subject: string;
    sender: string;
    bodyPreview: string;
    receivedDateTime: string;
    ticketNumber?: number;
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

async function getNextTicketNumber(): Promise<number> {
    const counterRef = doc(db, 'counters', 'ticketCounter');
    try {
        const ticketNumber = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists()) {
                transaction.set(counterRef, { currentNumber: 1 });
                return 1;
            }
            const newNumber = counterDoc.data().currentNumber + 1;
            transaction.update(counterRef, { currentNumber: newNumber });
            return newNumber;
        });
        return ticketNumber;
    } catch (e) {
        console.error("Transaction failed: ", e);
        throw new Error("Could not generate ticket number.");
    }
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

    const emails = data.value.map(email => ({
        id: email.id,
        subject: email.subject || 'No Subject',
        sender: email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unknown Sender',
        bodyPreview: email.bodyPreview,
        receivedDateTime: email.receivedDateTime,
    }));

    const emailsWithTicketNumbers = await Promise.all(emails.map(async (email) => {
        try {
            const ticketsRef = collection(db, 'tickets');
            const q = query(ticketsRef, where("emailId", "==", email.id));
            const querySnapshot = await getDocs(q);

            let ticketNumber: number | undefined;

            if (querySnapshot.empty) {
                // No ticket exists, create one
                const newTicketNumber = await getNextTicketNumber();
                const newTicketRef = doc(db, 'tickets', newTicketNumber.toString());
                await setDoc(newTicketRef, {
                    emailId: email.id,
                    title: email.subject,
                    createdAt: new Date(),
                    ticketNumber: newTicketNumber,
                });
                ticketNumber = newTicketNumber;
            } else {
                // Ticket exists, get its number
                ticketNumber = querySnapshot.docs[0].data().ticketNumber;
            }
            return { ...email, ticketNumber };
        } catch (error) {
            console.error(`Failed to process ticket for email ${email.id}:`, error);
            // Return email without ticket number if there's an error
            return email;
        }
    }));

    return emailsWithTicketNumbers;
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

    const email: { id: string, subject: string, from: { emailAddress: { address: string, name: string } }, body: { contentType: string, content: string }, receivedDateTime: string, bodyPreview: string } = await response.json() as any;

    let ticketNumber: number | undefined;
    try {
        const ticketsRef = collection(db, 'tickets');
        const q = query(ticketsRef, where("emailId", "==", id));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            ticketNumber = querySnapshot.docs[0].data().ticketNumber;
        }
    } catch (error) {
        console.error(`Failed to retrieve ticket number for email ${id}:`, error);
    }

    return {
        id: email.id,
        subject: email.subject || 'No Subject',
        sender: email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unknown Sender',
        body: email.body,
        receivedDateTime: email.receivedDateTime,
        bodyPreview: email.bodyPreview,
        ticketNumber: ticketNumber,
    };
}


export async function sendEmailAction(settings: Settings, emailData: NewEmail): Promise<{ success: boolean }> {
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
