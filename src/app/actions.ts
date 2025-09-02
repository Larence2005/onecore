
"use server";

import type { Settings } from '@/providers/settings-provider';
import {
    ConfidentialClientApplication,
    Configuration,
    AuthenticationResult
} from '@azure/msal-node';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';


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
    inReplyToId?: string;
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
                if (!existingData.priority || !existingData.assignee || !existingData.status) {
                    try {
                        await setDoc(ticketDocRef, { ...defaults, ...existingData }, { merge: true });
                    } catch (error) {
                        console.error("Failed to update existing ticket with default properties:", error);
                    }
                }
            } else {
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

export async function fetchAndStoreFullConversation(settings: Settings, conversationId: string): Promise<DetailedEmail[]> {
    const authResponse = await getAccessToken(settings);
    if (!authResponse?.accessToken) {
        throw new Error('Failed to acquire access token.');
    }

    const conversationResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${settings.userId}/messages?$filter=conversationId eq '${conversationId}'&$select=id,subject,from,body,receivedDateTime,bodyPreview`, {
        headers: { Authorization: `Bearer ${authResponse.accessToken}` }
    });

    if (!conversationResponse.ok) {
        const error = await conversationResponse.json();
        throw new Error(`Failed to fetch conversation thread: ${error.error?.message || conversationResponse.statusText}`);
    }

    const conversationData: { value: any[] } = await conversationResponse.json() as any;
    
    const conversationMessages: DetailedEmail[] = conversationData.value.map(msg => ({
        id: msg.id,
        subject: msg.subject,
        sender: msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || 'Unknown Sender',
        senderEmail: msg.from?.emailAddress?.address,
        body: msg.body,
        receivedDateTime: msg.receivedDateTime,
        bodyPreview: msg.bodyPreview,
        priority: 'Low',
        assignee: 'Unassigned',
        status: 'Open',
    }));

    // Sort messages by date client-side
    conversationMessages.sort((a, b) => new Date(a.receivedDateTime).getTime() - new Date(b.receivedDateTime).getTime());

    const conversationDocRef = doc(db, 'conversations', conversationId);
    await setDoc(conversationDocRef, { messages: conversationMessages });

    return conversationMessages;
}


export async function getEmail(settings: Settings, id: string): Promise<DetailedEmail> {
    const authResponse = await getAccessToken(settings);
    if (!authResponse?.accessToken) {
        throw new Error('Failed to acquire access token.');
    }

    // Get the initial message to find its conversationId
    const messageResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${settings.userId}/messages/${id}?$select=conversationId`, {
        headers: { Authorization: `Bearer ${authResponse.accessToken}` }
    });
    if (!messageResponse.ok) throw new Error('Failed to fetch initial email to get conversation ID.');
    const { conversationId } = await messageResponse.json();

    if (!conversationId) {
        // Handle single email not part of a conversation
        const singleMessageResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${settings.userId}/messages/${id}?$select=id,subject,from,body,receivedDateTime,bodyPreview`, {
            headers: { Authorization: `Bearer ${authResponse.accessToken}` }
        });
         if (!singleMessageResponse.ok) throw new Error('Failed to fetch single email.');
         const msg = await singleMessageResponse.json();
         const emailDetail: DetailedEmail = {
            id: msg.id,
            subject: msg.subject,
            sender: msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || 'Unknown Sender',
            senderEmail: msg.from?.emailAddress?.address,
            body: msg.body,
            receivedDateTime: msg.receivedDateTime,
            bodyPreview: msg.bodyPreview,
            priority: 'Low',
            assignee: 'Unassigned',
            status: 'Open',
         }
         return emailDetail;
    }

    // Check Firestore cache first
    const conversationDocRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationDocRef);
    let conversationMessages: DetailedEmail[];

    if (conversationDoc.exists()) {
        conversationMessages = conversationDoc.data().messages as DetailedEmail[];
    } else {
        // If not in cache, fetch from API and store it
        conversationMessages = await fetchAndStoreFullConversation(settings, conversationId);
    }
    
    if (!conversationMessages || conversationMessages.length === 0) {
        throw new Error('Conversation could not be found or fetched, even after a fallback attempt.');
    }

    const firstMessageId = conversationMessages[0].id;
    const ticketDocRef = doc(db, 'tickets', firstMessageId);
    const ticketDoc = await getDoc(ticketDocRef);
    const ticketData = ticketDoc.data();

    // The "main" email is the one the user clicked on, which might not be the first one.
    const mainEmail = conversationMessages.find(msg => msg.id === id) || conversationMessages[0];

    const baseEmail: DetailedEmail = {
        ...mainEmail,
        subject: ticketData?.title || mainEmail.subject || 'No Subject',
        priority: ticketData?.priority || 'Low',
        assignee: ticketData?.assignee || 'Unassigned',
        status: ticketData?.status || 'Open',
        conversationId: conversationId,
        conversation: conversationMessages.map(msg => ({
            ...msg,
            priority: ticketData?.priority || 'Low',
            assignee: ticketData?.assignee || 'Unassigned',
            status: ticketData?.status || 'Open',
        })),
    };
    
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

export async function replyToEmailAction(settings: Settings, messageId: string, comment: string, conversationId: string | undefined): Promise<{ success: boolean }> {
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

    // After successfully sending a reply, invalidate the cache
    if (conversationId) {
        const conversationDocRef = doc(db, 'conversations', conversationId);
        try {
            await deleteDoc(conversationDocRef);
        } catch (error) {
            console.error("Failed to delete conversation cache:", error);
            // Don't throw, just log. The cache will expire or be overwritten eventually.
        }
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
