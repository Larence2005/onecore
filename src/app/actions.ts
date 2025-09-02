
"use server";

import type { Settings } from '@/providers/settings-provider';
import {
    ConfidentialClientApplication,
    Configuration,
    AuthenticationResult
} from '@azure/msal-node';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';


export interface Email {
    id: string;
    subject: string;
    sender: string;
    senderEmail?: string;
    bodyPreview: string;
    receivedDateTime: string;
    priority: string;
    assignee: string;
    status: string;
    conversationId?: string;
}

export interface DetailedEmail extends Email {
    body: {
        contentType: string;
        content: string;
    };
    conversation?: DetailedEmail[];
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


export async function getLatestEmails(settings: Settings): Promise<void> {
    try {
        const authResponse = await getAccessToken(settings);
        if (!authResponse?.accessToken) {
            throw new Error('Failed to acquire access token.');
        }

        const response = await fetch(`https://graph.microsoft.com/v1.0/users/${settings.userId}/mailFolders/inbox/messages?$top=50&$select=id,subject,from,bodyPreview,receivedDateTime,conversationId&$orderby=receivedDateTime desc`, {
            headers: {
                Authorization: `Bearer ${authResponse.accessToken}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to fetch emails: ${error.error?.message || response.statusText}`);
        }

        const data: { value: { id: string, subject: string, from: { emailAddress: { address: string, name: string } }, bodyPreview: string, receivedDateTime: string, conversationId: string }[] } = await response.json() as any;
        
        const emailsToProcess = data.value.slice(0, 10);


        for (const email of emailsToProcess) {
            const ticketDocRef = doc(db, 'tickets', email.id);
            const ticketDoc = await getDoc(ticketDocRef);
            
            const defaults = {
                priority: 'Low',
                assignee: 'Unassigned',
                status: 'Open',
            };

            if (ticketDoc.exists()) {
                const existingData = ticketDoc.data();
                // If existing ticket is missing any of the default properties, update it.
                if (!existingData.priority || !existingData.assignee || !existingData.status) {
                    try {
                        await setDoc(ticketDocRef, { ...defaults, ...existingData }, { merge: true });
                    } catch (error) {
                        console.error("Failed to update existing ticket with default properties:", error);
                    }
                }
            } else {
                // Ticket doesn't exist, create it with all necessary data including defaults.
                const newTicketData = {
                    title: email.subject || 'No Subject',
                    sender: email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unknown Sender',
                    senderEmail: email.from?.emailAddress?.address || 'Unknown Email',
                    bodyPreview: email.bodyPreview,
                    receivedDateTime: email.receivedDateTime,
                    conversationId: email.conversationId,
                    ...defaults
                };
                try {
                    await setDoc(ticketDocRef, newTicketData);
                } catch (error) {
                    console.error("Failed to create ticket in Firestore:", error);
                }
            }
        }
    } catch (error) {
        console.error("API call failed, continuing with data from DB:", error);
        // We no longer return from this function, just log the error. The frontend will fetch from DB.
    }
}


export async function getTicketsFromDB(): Promise<Email[]> {
    const ticketsCollectionRef = collection(db, 'tickets');
    const querySnapshot = await getDocs(ticketsCollectionRef);
    
    const emails: Email[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            subject: data.title || 'No Subject',
            sender: data.sender || 'Unknown Sender',
            senderEmail: data.senderEmail || 'Unknown Email',
            bodyPreview: data.bodyPreview || '',
            receivedDateTime: data.receivedDateTime || new Date().toISOString(),
            priority: data.priority || 'Low',
            assignee: data.assignee || 'Unassigned',
            status: data.status || 'Open',
            conversationId: data.conversationId,
        };
    });
    
    emails.sort((a, b) => new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime());
    
    return emails.slice(0, 10);
}


export async function getEmail(settings: Settings, id: string): Promise<DetailedEmail> {
    const authResponse = await getAccessToken(settings);
    if (!authResponse?.accessToken) {
        throw new Error('Failed to acquire access token.');
    }

    // First, get the single message to find its conversationId
    const messageResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${settings.userId}/messages/${id}?$select=id,subject,from,body,receivedDateTime,bodyPreview,conversationId`, {
        headers: { Authorization: `Bearer ${authResponse.accessToken}` }
    });

    if (!messageResponse.ok) {
        const error = await messageResponse.json();
        throw new Error(`Failed to fetch email: ${error.error?.message || messageResponse.statusText}`);
    }
    const mainEmailData: { id: string, subject: string, from: { emailAddress: { address: string, name: string } }, body: { contentType: string, content: string }, receivedDateTime: string, bodyPreview: string, conversationId: string } = await messageResponse.json() as any;

    // Use the first message of the conversation to look up ticket data
    let firstMessageId = mainEmailData.id;
    if (mainEmailData.conversationId) {
        const conversationResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${settings.userId}/messages?$filter=conversationId eq '${mainEmailData.conversationId}'&$select=id&$orderby=receivedDateTime asc&$top=1`, {
            headers: { Authorization: `Bearer ${authResponse.accessToken}` }
        });
        if(conversationResponse.ok) {
            const conversationData: { value: {id: string}[]} = await conversationResponse.json() as any;
            if (conversationData.value.length > 0) {
                firstMessageId = conversationData.value[0].id;
            }
        }
    }
    
    const ticketDocRef = doc(db, 'tickets', firstMessageId);
    const ticketDoc = await getDoc(ticketDocRef);
    const ticketData = ticketDoc.data();
    
    const baseEmail: DetailedEmail = {
        id: mainEmailData.id,
        subject: ticketData?.title || mainEmailData.subject || 'No Subject',
        sender: mainEmailData.from?.emailAddress?.name || mainEmailData.from?.emailAddress?.address || 'Unknown Sender',
        senderEmail: ticketData?.senderEmail || mainEmailData.from?.emailAddress?.address,
        body: mainEmailData.body,
        receivedDateTime: mainEmailData.receivedDateTime,
        bodyPreview: mainEmailData.bodyPreview,
        priority: ticketData?.priority || 'Low',
        assignee: ticketData?.assignee || 'Unassigned',
        status: ticketData?.status || 'Open',
        conversationId: mainEmailData.conversationId
    };

    if (mainEmailData.conversationId) {
        const conversationResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${settings.userId}/messages?$filter=conversationId eq '${mainEmailData.conversationId}'&$select=id,subject,from,body,receivedDateTime,bodyPreview&$orderby=receivedDateTime asc`, {
            headers: { Authorization: `Bearer ${authResponse.accessToken}` }
        });
        if (conversationResponse.ok) {
            const conversationData: { value: any[] } = await conversationResponse.json() as any;
            // Map conversation messages
            baseEmail.conversation = conversationData.value.map((msg: any) => ({
                id: msg.id,
                subject: msg.subject,
                sender: msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || 'Unknown Sender',
                senderEmail: msg.from?.emailAddress?.address,
                body: msg.body,
                receivedDateTime: msg.receivedDateTime,
                bodyPreview: msg.bodyPreview,
                // These properties might not be relevant for each message in a conversation, but we'll include them.
                priority: ticketData?.priority || 'Low', 
                assignee: ticketData?.assignee || 'Unassigned',
                status: ticketData?.status || 'Open'
            }));
        } else {
             console.error("Failed to fetch conversation thread.");
        }
    }
    
    return baseEmail;
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

export async function replyToEmailAction(settings: Settings, messageId: string, comment: string): Promise<{ success: boolean }> {
    const authResponse = await getAccessToken(settings);
    if (!authResponse?.accessToken) {
        throw new Error('Failed to acquire access token.');
    }

    const reply = {
        comment: comment,
    };

    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${settings.userId}/messages/${messageId}/reply`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${authResponse.accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(reply),
    });
    
    if (response.status !== 202) {
        const error = await response.json();
        throw new Error(`Failed to send reply: ${error.error?.message || response.statusText}`);
    }

    return { success: true };
}


export async function updateTicket(id: string, data: { priority?: string, assignee?: string, status?: string }) {
    const ticketDocRef = doc(db, 'tickets', id);
    try {
        await updateDoc(ticketDocRef, data);
        return { success: true };
    } catch (error) {
        console.error("Failed to update ticket:", error);
        return { success: false, error: "Failed to update ticket." };
    }
}
