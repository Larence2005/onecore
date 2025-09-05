
"use server";

import type { Settings } from '@/providers/settings-provider';
import {
    ConfidentialClientApplication,
    Configuration,
    AuthenticationResult
} from '@azure/msal-node';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc, writeBatch, query, where, runTransaction, increment } from 'firebase/firestore';


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
    type: string;
    conversationId?: string;
    deadline?: string;
    tags?: string[];
    closedAt?: string;
    lastReplier?: 'agent' | 'client';
    ticketNumber?: number;
}

export interface Attachment {
    id: string;
    name: string;
    contentType: string;
    size: number;
    contentBytes: string; // Base64 encoded content
}

export interface NewAttachment {
    name: string;
    contentBytes: string; // Base64 encoded content
    contentType: string;
}


export interface DetailedEmail extends Email {
    body: {
        contentType: string;
        content: string;
    };
    conversation?: DetailedEmail[];
    inReplyToId?: string;
    attachments?: Attachment[];
    hasAttachments?: boolean;
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

async function getAndIncrementTicketCounter(): Promise<number> {
    const counterRef = doc(db, 'counters', 'tickets');
    try {
        const newTicketNumber = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists()) {
                // Initialize the counter if it doesn't exist
                transaction.set(counterRef, { currentNumber: 1 });
                return 1;
            }
            const newNumber = counterDoc.data().currentNumber + 1;
            transaction.update(counterRef, { currentNumber: newNumber });
            return newNumber;
        });
        return newTicketNumber;
    } catch (e) {
        console.error("Transaction failed: ", e);
        // Fallback or error handling
        throw new Error("Could not generate a unique ticket number.");
    }
}


async function getNextTicketNumber(): Promise<number> {
    return getAndIncrementTicketCounter();
}


export async function getLatestEmails(settings: Settings): Promise<void> {
    try {
        const authResponse = await getAccessToken(settings);
        if (!authResponse?.accessToken) {
            throw new Error('Failed to acquire access token.');
        }

        const response = await fetch(`https://graph.microsoft.com/v1.0/users/${settings.userId}/mailFolders/inbox/messages?$top=30&$select=id,subject,from,bodyPreview,receivedDateTime,conversationId&$orderby=receivedDateTime desc`, {
            headers: {
                Authorization: `Bearer ${authResponse.accessToken}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to fetch emails: ${error.error?.message || response.statusText}`);
        }

        const data: { value: { id: string, subject: string, from: { emailAddress: { address: string, name: string } }, bodyPreview: string, receivedDateTime: string, conversationId: string }[] } = await response.json() as any;
        
        const emailsToProcess = data.value;

        for (const email of emailsToProcess) {
            if (!email.conversationId) continue;

            const ticketsCollectionRef = collection(db, 'tickets');
            const q = query(ticketsCollectionRef, where('conversationId', '==', email.conversationId));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                // A ticket with this conversationId already exists.
                // Fetch the entire conversation to get the latest reply.
                await fetchAndStoreFullConversation(settings, email.conversationId);
                continue;
            }

            const conversationThread = await fetchAndStoreFullConversation(settings, email.conversationId);
            if (conversationThread.length === 0) continue;

            const firstMessage = conversationThread[0];
            const ticketId = firstMessage.id;

            const ticketDocRef = doc(db, 'tickets', ticketId);
            const ticketDoc = await getDoc(ticketDocRef);

            if (!ticketDoc.exists()) {
                 const ticketNumber = await getNextTicketNumber();
                 const newTicketData = {
                    title: firstMessage.subject || 'No Subject',
                    sender: firstMessage.sender || 'Unknown Sender',
                    senderEmail: firstMessage.senderEmail || 'Unknown Email',
                    bodyPreview: firstMessage.bodyPreview,
                    receivedDateTime: firstMessage.receivedDateTime,
                    conversationId: firstMessage.conversationId,
                    priority: 'Low',
                    assignee: 'Unassigned',
                    status: 'Open',
                    type: 'Incident',
                    tags: [],
                    deadline: null,
                    closedAt: null,
                    ticketNumber: ticketNumber,
                };
                await setDoc(ticketDocRef, newTicketData);
            }
        }
    } catch (error) {
        console.error("API call failed, continuing with data from DB:", error);
    }
}


export async function getTicketsFromDB(options?: { includeArchived?: boolean, fetchAll?: boolean }): Promise<Email[]> {
    const ticketsCollectionRef = collection(db, 'tickets');
    let q;

    if (options?.fetchAll) {
        // No filter, get all tickets
        q = query(ticketsCollectionRef);
    } else if (options?.includeArchived) {
        q = query(ticketsCollectionRef, where('status', '==', 'Archived'));
    } else {
        q = query(ticketsCollectionRef, where('status', '!=', 'Archived'));
    }
    
    const querySnapshot = await getDocs(q);
    
    const emails: Email[] = await Promise.all(querySnapshot.docs.map(async (ticketDoc) => {
        const data = ticketDoc.data();
        
        // For archived tickets, show their status before archiving.
        const status = (options?.includeArchived && data.statusBeforeArchive) ? data.statusBeforeArchive : data.status;

        return {
            id: ticketDoc.id,
            subject: data.title || 'No Subject',
            sender: data.sender || 'Unknown Sender',
            senderEmail: data.senderEmail || 'Unknown Email',
            bodyPreview: data.bodyPreview || '',
            receivedDateTime: data.receivedDateTime || new Date().toISOString(),
            priority: data.priority || 'Low',
            assignee: data.assignee || 'Unassigned',
            status: status || 'Open',
            type: data.type || 'Incident',
            conversationId: data.conversationId,
            tags: data.tags || [],
            deadline: data.deadline,
            closedAt: data.closedAt,
            ticketNumber: data.ticketNumber
        };
    }));
    
    emails.sort((a, b) => new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime());
    
    return emails;
}


export async function fetchAndStoreFullConversation(settings: Settings, conversationId: string): Promise<DetailedEmail[]> {
    const authResponse = await getAccessToken(settings);
    if (!authResponse?.accessToken) {
        throw new Error('Failed to acquire access token.');
    }

    const conversationResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${settings.userId}/messages?$filter=conversationId eq '${conversationId}'&$select=id,subject,from,body,receivedDateTime,bodyPreview,conversationId,hasAttachments&$expand=attachments`, {
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
        conversationId: msg.conversationId,
        priority: 'Low',
        assignee: 'Unassigned',
        status: 'Open',
        type: 'Incident',
        hasAttachments: msg.hasAttachments,
        attachments: msg.attachments,
    }));

    // Sort messages by date client-side
    conversationMessages.sort((a, b) => new Date(a.receivedDateTime).getTime() - new Date(b.receivedDateTime).getTime());

    const conversationDocRef = doc(db, 'conversations', conversationId);
    await setDoc(conversationDocRef, { messages: conversationMessages });

    // When a conversation is updated, we also need to update the main ticket's bodyPreview
    if (conversationMessages.length > 0) {
        const firstMessage = conversationMessages[0];
        const lastMessage = conversationMessages[conversationMessages.length - 1];
        const ticketDocRef = doc(db, 'tickets', firstMessage.id);
        const ticketDoc = await getDoc(ticketDocRef);
        if (ticketDoc.exists()) {
            await updateDoc(ticketDocRef, {
                bodyPreview: lastMessage.bodyPreview
            });
        }
    }


    return conversationMessages;
}


export async function getEmail(settings: Settings, id: string): Promise<DetailedEmail> {
    const authResponse = await getAccessToken(settings);
    if (!authResponse?.accessToken) {
        throw new Error('Failed to acquire access token.');
    }

    const messageResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${settings.userId}/messages/${id}?$select=id,subject,from,body,receivedDateTime,bodyPreview,conversationId,hasAttachments&$expand=attachments`, {
        headers: { Authorization: `Bearer ${authResponse.accessToken}` }
    });

    if (!messageResponse.ok) {
        const error = await messageResponse.json();
        throw new Error(`Failed to fetch email details: ${error.error?.message || messageResponse.statusText}`);
    }

    const msg = await messageResponse.json();
    const conversationId = msg.conversationId;

    if (!conversationId) {
        // Handle single email not part of a conversation
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
            type: 'Incident',
            hasAttachments: msg.hasAttachments,
            attachments: msg.attachments,
            tags: [],
            deadline: undefined,
         };
         const ticketDocRef = doc(db, 'tickets', msg.id);
         const ticketDoc = await getDoc(ticketDocRef);
         if (ticketDoc.exists()) {
            const ticketData = ticketDoc.data();
            return {...emailDetail, ...ticketData};
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

    // The "main" email is the one the user clicked on.
    const mainEmail = conversationMessages.find(m => m.id === id) || conversationMessages[0];

    return {
        ...mainEmail,
        subject: ticketData?.title || mainEmail.subject || 'No Subject',
        priority: ticketData?.priority || 'Low',
        assignee: ticketData?.assignee || 'Unassigned',
        status: ticketData?.status || 'Open',
        type: ticketData?.type || 'Incident',
        tags: ticketData?.tags || [],
        deadline: ticketData?.deadline,
        closedAt: ticketData?.closedAt,
        conversationId: conversationId,
        ticketNumber: ticketData?.ticketNumber,
        conversation: conversationMessages.map(convMsg => ({
            ...convMsg,
            priority: ticketData?.priority || 'Low',
            assignee: ticketData?.assignee || 'Unassigned',
            status: ticketData?.status || 'Open',
            type: ticketData?.type || 'Incident',
        })),
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

export async function replyToEmailAction(
    settings: Settings,
    messageId: string,
    comment: string,
    conversationId: string | undefined,
    attachments: NewAttachment[]
): Promise<{ success: boolean }> {
    const authResponse = await getAccessToken(settings);
    if (!authResponse?.accessToken) {
        throw new Error('Failed to acquire access token.');
    }

    let replyPayload: any;

    if (attachments && attachments.length > 0) {
        // Use the 'message' object for replies with attachments
        replyPayload = {
            message: {
                body: {
                    contentType: 'HTML',
                    content: comment,
                },
                attachments: attachments.map(att => ({
                    '@odata.type': '#microsoft.graph.fileAttachment',
                    name: att.name,
                    contentBytes: att.contentBytes,
                    contentType: att.contentType,
                })),
            },
        };
    } else {
        // Use the simpler 'comment' for replies without attachments
        replyPayload = {
            comment: comment,
        };
    }


    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${settings.userId}/messages/${messageId}/reply`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${authResponse.accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(replyPayload),
    });
    
    if (response.status !== 202) {
        const errorText = await response.text();
        console.error("Failed to send reply. Status:", response.status, "Body:", errorText);
        try {
            const error = JSON.parse(errorText);
            throw new Error(`Failed to send reply: ${error.error?.message || response.statusText}`);
        } catch (e) {
            throw new Error(`Failed to send reply: ${response.statusText} - ${errorText}`);
        }
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



export async function updateTicket(id: string, data: { priority?: string, assignee?: string, status?: string, type?: string, deadline?: string | null, tags?: string[], closedAt?: string | null }) {
    const ticketDocRef = doc(db, 'tickets', id);
    try {
        const updateData: any = { ...data };

        // If status is being updated to Resolved or Closed, set closedAt
        if (data.status && (data.status === 'Resolved' || data.status === 'Closed')) {
            const docSnap = await getDoc(ticketDocRef);
            if(docSnap.exists() && docSnap.data().status !== 'Resolved' && docSnap.data().status !== 'Closed') {
                updateData.closedAt = new Date().toISOString();
            }
        }
        
        // If status is changed back to Open/Pending, clear closedAt
        if (data.status && (data.status === 'Open' || data.status === 'Pending')) {
            updateData.closedAt = null;
        }

        await updateDoc(ticketDocRef, updateData);
        return { success: true };
    } catch (error) {
        console.error("Failed to update ticket:", error);
        return { success: false, error: "Failed to update ticket." };
    }
}

export async function archiveTickets(ticketIds: string[]) {
    const batch = writeBatch(db);
    try {
        for (const id of ticketIds) {
            const ticketDocRef = doc(db, 'tickets', id);
            const ticketDoc = await getDoc(ticketDocRef);
            if(ticketDoc.exists()){
                const currentStatus = ticketDoc.data().status;
                batch.update(ticketDocRef, {
                    status: 'Archived',
                    statusBeforeArchive: currentStatus
                });
            }
        }
        await batch.commit();
        return { success: true };
    } catch (error) {
        console.error("Failed to archive tickets:", error);
        return { success: false, error: "Failed to archive tickets." };
    }
}


export async function unarchiveTickets(ticketIds: string[]) {
    const batch = writeBatch(db);
    try {
        for (const id of ticketIds) {
            const ticketDocRef = doc(db, 'tickets', id);
            const ticketDoc = await getDoc(ticketDocRef);
            if (ticketDoc.exists()) {
                const data = ticketDoc.data();
                batch.update(ticketDocRef, {
                    status: data.statusBeforeArchive || 'Open',
                    statusBeforeArchive: null
                });
            }
        }
        await batch.commit();
        return { success: true };
    } catch (error) {
        console.error("Failed to unarchive tickets:", error);
        return { success: false, error: "Failed to unarchive tickets." };
    }
}
    

    

    

    







    

    

    

    

    


