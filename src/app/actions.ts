
"use server";

import type { Settings } from '@/providers/settings-provider';
import {
    ConfidentialClientApplication,
    Configuration,
    AuthenticationResult
} from '@azure/msal-node';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc, writeBatch, query, where, runTransaction, increment, arrayUnion, arrayRemove, addDoc, orderBy } from 'firebase/firestore';
import { getAuth } from "firebase-admin/auth";
import { app as adminApp } from '@/lib/firebase-admin';
import { auth as adminAuth } from '@/lib/firebase-admin';
import { isPast, parseISO } from 'date-fns';


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

export interface ActivityLog {
    id: string;
    type: string;
    details: string;
    date: string;
    user: string;
}

export interface Recipient {
    emailAddress: {
        name: string;
        address: string;
    }
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
    toRecipients?: Recipient[];
    ccRecipients?: Recipient[];
    bccRecipients?: Recipient[];
}

export interface OrganizationMember {
    name: string;
    email: string;
}


const getMsalConfig = (settings: Settings): Configuration => ({
    auth: {
        clientId: settings.clientId,
        authority: `https://login.microsoftonline.com/${settings.tenantId}`,
        clientSecret: settings.clientSecret,
    },
});

async function getAccessToken(settings: Settings): Promise<AuthenticationResult | null> {
    if(!settings.clientId || !settings.tenantId || !settings.clientSecret) {
        // Not configured, cannot get token
        return null;
    }
    const msalConfig = getMsalConfig(settings);
    const cca = new ConfidentialClientApplication(msalConfig);
    const tokenRequest = {
        scopes: ['https://graph.microsoft.com/.default'],
    };

    return await cca.acquireTokenByClientCredential(tokenRequest);
}

async function getAndIncrementTicketCounter(organizationId: string): Promise<number> {
    const counterRef = doc(db, 'organizations', organizationId, 'counters', 'tickets');
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


async function getNextTicketNumber(organizationId: string): Promise<number> {
    return getAndIncrementTicketCounter(organizationId);
}


export async function getLatestEmails(settings: Settings, organizationId: string): Promise<void> {
    try {
        const authResponse = await getAccessToken(settings);
        if (!authResponse?.accessToken) {
            // Silently fail if not configured
            console.log("Skipping email sync: API credentials not configured.");
            return;
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

            const ticketsCollectionRef = collection(db, 'organizations', organizationId, 'tickets');
            const q = query(ticketsCollectionRef, where('conversationId', '==', email.conversationId));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                // This is a new conversation thread, create a new ticket
                 const conversationThread = await fetchAndStoreFullConversation(settings, organizationId, email.conversationId);
                 if (conversationThread.length === 0) continue;

                 const firstMessage = conversationThread[0];
                 const ticketDocRef = doc(ticketsCollectionRef); // Create a new document reference to get the ID
                 const ticketId = ticketDocRef.id;
                 const ticketNumber = await getNextTicketNumber(organizationId);

                 const newTicketData = {
                    id: ticketId, // Store the document's own ID
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

                // Add the "Ticket Created" activity log here
                await addActivityLog(organizationId, ticketId, {
                    type: 'Create',
                    details: 'Ticket created',
                    date: firstMessage.receivedDateTime,
                    user: firstMessage.senderEmail || 'System',
                });

            } else {
                 // Existing conversation, just update the cache
                 await fetchAndStoreFullConversation(settings, organizationId, email.conversationId);
            }
        }
    } catch (error) {
        console.error("API call failed, continuing with data from DB:", error);
    }
}


export async function getTicketsFromDB(organizationId: string, options?: { includeArchived?: boolean, fetchAll?: boolean, agentEmail?: string }): Promise<Email[]> {
    if (!organizationId) return [];
    const ticketsCollectionRef = collection(db, 'organizations', organizationId, 'tickets');
    let queries = [];

    if (options?.agentEmail) {
        queries.push(where('assignee', '==', options.agentEmail));
    }
    
    if (options?.includeArchived) {
        // No status filter for archived, we get them all and filter client side
    } else if(!options?.fetchAll) {
        queries.push(where('status', '!=', 'Archived'));
    }

    const q = query(ticketsCollectionRef, ...queries);
    
    const querySnapshot = await getDocs(q);
    
    let emails: Email[] = await Promise.all(querySnapshot.docs.map(async (ticketDoc) => {
        const data = ticketDoc.data();
        
        return {
            id: ticketDoc.id, // Ensure we use the firestore document ID
            subject: data.title || 'No Subject',
            sender: data.sender || 'Unknown Sender',
            senderEmail: data.senderEmail || 'Unknown Email',
            bodyPreview: data.bodyPreview || '',
            receivedDateTime: data.receivedDateTime || new Date().toISOString(),
            priority: data.priority || 'Low',
            assignee: data.assignee || 'Unassigned',
            status: data.status || 'Open',
            type: data.type || 'Incident',
            conversationId: data.conversationId,
            tags: data.tags || [],
            deadline: data.deadline,
            closedAt: data.closedAt,
            ticketNumber: data.ticketNumber,
            statusBeforeArchive: data.statusBeforeArchive
        };
    }));

    if (options?.includeArchived) {
        emails = emails.filter(e => e.status === 'Archived');
    }
    
    emails.sort((a, b) => new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime());
    
    return emails;
}


export async function fetchAndStoreFullConversation(settings: Settings, organizationId: string, conversationId: string): Promise<DetailedEmail[]> {
    const authResponse = await getAccessToken(settings);
    if (!authResponse?.accessToken) {
        // Can't fetch from API, return empty array. The caller should handle this.
        return [];
    }

    const conversationResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${settings.userId}/messages?$filter=conversationId eq '${conversationId}'&$select=id,subject,from,body,receivedDateTime,bodyPreview,conversationId,hasAttachments,toRecipients,ccRecipients,bccRecipients&$expand=attachments`, {
        headers: { Authorization: `Bearer ${authResponse.accessToken}` }
    });

    if (!conversationResponse.ok) {
        const error = await conversationResponse.json();
        throw new Error(`Failed to fetch conversation thread: ${error.error?.message || conversationResponse.statusText}`);
    }

    const conversationData: { value: any[] } = await conversationResponse.json() as any;
    
    // Before storing, let's get the current ticket properties
    const ticketsCollectionRef = collection(db, 'organizations', organizationId, 'tickets');
    const q = query(ticketsCollectionRef, where('conversationId', '==', conversationId));
    const querySnapshot = await getDocs(q);
    
    let ticketProperties = {
        priority: 'Low',
        assignee: 'Unassigned',
        status: 'Open',
        type: 'Incident',
    };

    if (!querySnapshot.empty) {
        const ticketData = querySnapshot.docs[0].data();
        ticketProperties = {
            priority: ticketData.priority || 'Low',
            assignee: ticketData.assignee || 'Unassigned',
            status: ticketData.status || 'Open',
            type: ticketData.type || 'Incident',
        };
    }

    const conversationMessages: DetailedEmail[] = conversationData.value.map(msg => ({
        id: msg.id,
        subject: msg.subject,
        sender: msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || 'Unknown Sender',
        senderEmail: msg.from?.emailAddress?.address,
        body: msg.body,
        receivedDateTime: msg.receivedDateTime,
        bodyPreview: msg.bodyPreview,
        conversationId: msg.conversationId,
        priority: ticketProperties.priority,
        assignee: ticketProperties.assignee,
        status: ticketProperties.status,
        type: ticketProperties.type,
        hasAttachments: msg.hasAttachments,
        attachments: msg.attachments,
        toRecipients: msg.toRecipients,
        ccRecipients: msg.ccRecipients,
        bccRecipients: msg.bccRecipients,
    }));

    // Sort messages by date client-side
    conversationMessages.sort((a, b) => new Date(a.receivedDateTime).getTime() - new Date(b.receivedDateTime).getTime());

    const conversationDocRef = doc(db, 'organizations', organizationId, 'conversations', conversationId);
    await setDoc(conversationDocRef, { messages: conversationMessages });

    // When a conversation is updated, we also need to update the main ticket's bodyPreview
    if (conversationMessages.length > 0) {
        const firstMessage = conversationMessages[0];
        const lastMessage = conversationMessages[conversationMessages.length - 1];

        // Find the corresponding ticket document
        if (!querySnapshot.empty) {
            const ticketDocRef = querySnapshot.docs[0].ref;
            await updateDoc(ticketDocRef, {
                bodyPreview: lastMessage.bodyPreview,
                receivedDateTime: lastMessage.receivedDateTime,
                sender: lastMessage.sender,
                senderEmail: lastMessage.senderEmail,
            });
        }
    }


    return conversationMessages;
}


export async function getEmail(organizationId: string, id: string): Promise<DetailedEmail | null> {
    if (!organizationId || !id) {
        throw new Error("Organization ID and Ticket ID must be provided.");
    }
    
    const ticketDocRef = doc(db, 'organizations', organizationId, 'tickets', id);
    const ticketDocSnap = await getDoc(ticketDocRef);

    if (!ticketDocSnap.exists()) {
        return null;
    }
    const ticketData = ticketDocSnap.data();
    const conversationId = ticketData.conversationId;

    let conversationMessages: DetailedEmail[] = [];
    if (conversationId) {
        const conversationDocRef = doc(db, 'organizations', organizationId, 'conversations', conversationId);
        const conversationDoc = await getDoc(conversationDocRef);

        if (conversationDoc.exists() && conversationDoc.data().messages) {
            conversationMessages = conversationDoc.data().messages as DetailedEmail[];
        }
    }
    
    const originalSender = conversationMessages.length > 0 ? conversationMessages[0].sender : ticketData.sender;
    const originalSenderEmail = conversationMessages.length > 0 ? conversationMessages[0].senderEmail : ticketData.senderEmail;

    if (conversationMessages.length === 0) {
        const placeholderEmail: DetailedEmail = {
            id: ticketData.id || id,
            subject: ticketData.title || 'No Subject',
            sender: ticketData.sender || 'Unknown Sender',
            senderEmail: ticketData.senderEmail || 'Unknown Email',
            bodyPreview: ticketData.bodyPreview || '',
            receivedDateTime: ticketData.receivedDateTime,
            priority: ticketData.priority || 'Low',
            assignee: ticketData.assignee || 'Unassigned',
            status: ticketData.status || 'Open',
            type: ticketData.type || 'Incident',
            conversationId: ticketData.conversationId,
            tags: ticketData.tags || [],
            deadline: ticketData.deadline,
            closedAt: ticketData.closedAt,
            ticketNumber: ticketData.ticketNumber,
            body: { contentType: 'html', content: ticketData.bodyPreview || '<p>Full email content is not available yet.</p>' }
        };
        conversationMessages.push(placeholderEmail);
    }
    
    const firstMessage = conversationMessages[0];

    const mainEmailDetails: DetailedEmail = {
        id: ticketData.id || id,
        subject: ticketData.title || 'No Subject',
        sender: originalSender,
        senderEmail: originalSenderEmail,
        bodyPreview: ticketData.bodyPreview,
        receivedDateTime: ticketData.receivedDateTime,
        priority: ticketData.priority,
        assignee: ticketData.assignee,
        status: ticketData.status,
        type: ticketData.type,
        tags: ticketData.tags,
        deadline: ticketData.deadline,
        closedAt: ticketData.closedAt,
        conversationId: ticketData.conversationId,
        ticketNumber: ticketData.ticketNumber,
        body: firstMessage.body || { contentType: 'html', content: ticketData.bodyPreview || '<p>Full email content is not available yet.</p>' },
        conversation: conversationMessages.map(convMsg => ({
            ...convMsg,
            priority: ticketData.priority || 'Low',
            assignee: ticketData.assignee || 'Unassigned',
            status: ticketData.status || 'Open',
            type: ticketData.type || 'Incident',
        })),
    };

    return mainEmailDetails;
}


const parseRecipients = (recipients: string | undefined): { emailAddress: { address: string } }[] => {
    if (!recipients) return [];
    return recipients.split(/[,; ]+/).filter(email => email.trim() !== '').map(email => ({
        emailAddress: { address: email.trim() }
    }));
};

export async function sendEmailAction(settings: Settings, emailData: {recipient: string, subject: string, body: string, cc?: string, bcc?: string}): Promise<{ success: boolean }> {
    const authResponse = await getAccessToken(settings);
    if (!authResponse?.accessToken) {
        throw new Error('Failed to acquire access token. Check your API settings.');
    }

    const message = {
        message: {
            subject: emailData.subject,
            body: {
                contentType: 'HTML', // Send as HTML
                content: emailData.body,
            },
            toRecipients: [
                {
                    emailAddress: {
                        address: emailData.recipient,
                    },
                },
            ],
            ccRecipients: parseRecipients(emailData.cc),
            bccRecipients: parseRecipients(emailData.bcc),
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
    organizationId: string,
    messageId: string,
    comment: string,
    conversationId: string | undefined,
    attachments: NewAttachment[],
    cc: string | undefined,
    bcc: string | undefined
): Promise<{ success: boolean }> {
    const authResponse = await getAccessToken(settings);
    if (!authResponse?.accessToken) {
        throw new Error('Failed to acquire access token. Check your API settings.');
    }

    let replyPayload: any = {
        comment: comment,
        message: {
            ccRecipients: parseRecipients(cc),
            bccRecipients: parseRecipients(bcc),
        }
    };

    if (attachments && attachments.length > 0) {
        replyPayload.message.attachments = attachments.map(att => ({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: att.name,
            contentBytes: att.contentBytes,
            contentType: att.contentType,
        }));
    }
    
    // Note: The 'reply' endpoint doesn't directly support adding new recipients or attachments in one go.
    // The standard 'reply' action with a simple 'comment' body is simpler.
    // For advanced scenarios like adding attachments or changing recipients, creating a draft reply and then sending it is the robust way.
    // However, for this implementation, we try a more direct approach which might have limitations depending on the exact API version/behavior.
    // The Graph API for `reply` *can* take a `message` object to create a more complex reply draft. Let's build that.

    const finalPayload = {
        comment: comment, // The text part of the reply
        message: { // The message object part of the reply
            // MS Graph automatically adds the original sender to 'toRecipients' when replying.
            // We can add CC and BCC recipients here.
            ccRecipients: parseRecipients(cc),
            bccRecipients: parseRecipients(bcc),
            attachments: attachments.map(att => ({
                '@odata.type': '#microsoft.graph.fileAttachment',
                name: att.name,
                contentBytes: att.contentBytes,
                contentType: att.contentType,
            })),
        }
    };


    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${settings.userId}/messages/${messageId}/reply`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${authResponse.accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalPayload),
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
        const conversationDocRef = doc(db, 'organizations', organizationId, 'conversations', conversationId);
        try {
            await deleteDoc(conversationDocRef);
        } catch (error) {
            console.error("Failed to delete conversation cache:", error);
            // Don't throw, just log. The cache will expire or be overwritten eventually.
        }
    }

    return { success: true };
}


export async function forwardEmailAction(
    settings: Settings,
    organizationId: string,
    messageId: string,
    comment: string,
    to: string,
    cc: string | undefined,
    bcc: string | undefined
): Promise<{ success: boolean }> {
    const authResponse = await getAccessToken(settings);
    if (!authResponse?.accessToken) {
        throw new Error('Failed to acquire access token. Check your API settings.');
    }

    const toRecipients = parseRecipients(to);
    if (toRecipients.length === 0) {
        throw new Error("Forward recipient is required.");
    }

    const forwardPayload = {
        comment: comment,
        toRecipients: toRecipients,
        ccRecipients: parseRecipients(cc),
        bccRecipients: parseRecipients(bcc),
    };

    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${settings.userId}/messages/${messageId}/forward`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${authResponse.accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(forwardPayload),
    });

    if (response.status !== 202) {
        const errorText = await response.text();
        console.error("Failed to forward email. Status:", response.status, "Body:", errorText);
        try {
            const error = JSON.parse(errorText);
            throw new Error(`Failed to forward email: ${error.error?.message || response.statusText}`);
        } catch (e) {
            throw new Error(`Failed to forward email: ${response.statusText} - ${errorText}`);
        }
    }

    return { success: true };
}


export async function updateTicket(organizationId: string, id: string, data: { priority?: string, assignee?: string, status?: string, type?: string, deadline?: string | null, tags?: string[], closedAt?: string | null }) {
    const ticketDocRef = doc(db, 'organizations', organizationId, 'tickets', id);
    try {
        await runTransaction(db, async (transaction) => {
            // --- READS FIRST ---
            const ticketDoc = await transaction.get(ticketDocRef);
            if (!ticketDoc.exists()) {
                throw new Error("Ticket not found!");
            }
            
            const ticketData = ticketDoc.data();
            const conversationId = ticketData.conversationId;
            let conversationDocRef: any, conversationDoc: any;

            if (data.assignee && conversationId) {
                conversationDocRef = doc(db, 'organizations', organizationId, 'conversations', conversationId);
                conversationDoc = await transaction.get(conversationDocRef);
            }

            // --- WRITES AFTER ---
            const updateData: any = { ...data };

            if (data.status && (data.status === 'Resolved' || data.status === 'Closed')) {
                if(ticketData.status !== 'Resolved' && ticketData.status !== 'Closed') {
                    updateData.closedAt = new Date().toISOString();
                }
            }
            
            if (data.status && (data.status === 'Open' || data.status === 'Pending')) {
                updateData.closedAt = null;
            }

            // Update the ticket
            transaction.update(ticketDocRef, updateData);

            // If assignee changed, update the conversation as well
            if (data.assignee && conversationId && conversationDoc?.exists()) {
                const messages = (conversationDoc.data().messages || []).map((msg: DetailedEmail) => ({
                    ...msg,
                    assignee: data.assignee
                }));
                transaction.update(conversationDocRef, { messages });
            }
        });

        return { success: true };
    } catch (error) {
        console.error("Failed to update ticket:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, error: errorMessage };
    }
}


export async function archiveTickets(organizationId: string, ticketIds: string[]) {
    if (!organizationId) {
        return { success: false, error: "Organization ID is required." };
    }
    const batch = writeBatch(db);
    try {
        for (const id of ticketIds) {
            const ticketDocRef = doc(db, 'organizations', organizationId, 'tickets', id);
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


export async function unarchiveTickets(organizationId: string, ticketIds: string[]) {
    if (!organizationId) {
        return { success: false, error: "Organization ID is required." };
    }
    const batch = writeBatch(db);
    try {
        for (const id of ticketIds) {
            const ticketDocRef = doc(db, 'organizations', organizationId, 'tickets', id);
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


export async function addActivityLog(organizationId: string, ticketId: string, logEntry: Omit<ActivityLog, 'id'>) {
    if (!organizationId || !ticketId) {
        throw new Error("Organization ID and Ticket ID are required.");
    }
    try {
        const activityCollectionRef = collection(db, 'organizations', organizationId, 'tickets', ticketId, 'activity');
        await addDoc(activityCollectionRef, logEntry);
        return { success: true };
    } catch (error) {
        console.error("Failed to add activity log:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, error: errorMessage };
    }
}

export async function getActivityLog(organizationId: string, ticketId: string): Promise<ActivityLog[]> {
    if (!organizationId || !ticketId) {
        return [];
    }
    try {
        const activityCollectionRef = collection(db, 'organizations', organizationId, 'tickets', ticketId, 'activity');
        const q = query(activityCollectionRef, orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
    } catch (error) {
        console.error("Failed to get activity log:", error);
        return [];
    }
}


// --- Organization Actions ---

export async function createOrganization(name: string, uid: string, email: string) {
    const organizationRef = doc(collection(db, "organizations"));
    await setDoc(organizationRef, {
        name: name,
        owner: uid,
        members: [{ name: 'Admin', email: email }] // Add owner as first member
    });
    
    return { success: true, organizationId: organizationRef.id };
}


export async function addMemberToOrganization(organizationId: string, name: string, email: string, password?: string) {
    if (!organizationId || !email || !name) {
        throw new Error("Organization ID, member name, and email are required.");
    }

    // Check if the user already exists in ANY organization
    const organizationsRef = collection(db, "organizations");
    const allOrgsSnapshot = await getDocs(organizationsRef);

    for (const orgDoc of allOrgsSnapshot.docs) {
        const members = orgDoc.data().members as {name: string, email: string}[] | undefined;
        if (members && members.some(member => member.email === email)) {
            if (orgDoc.id === organizationId) {
                throw new Error("This member is already in your organization.");
            } else {
                throw new Error("Not allowed to add another member from other organization");
            }
        }
    }
    
    // If the loop completes without throwing an error, the user is not in any organization
    const organizationRef = doc(db, "organizations", organizationId);
    
    // Add the user to the organization's members list in Firestore
    await updateDoc(organizationRef, {
        members: arrayUnion({ name, email })
    });

    return { success: true };
}

export async function getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
    if (!organizationId) return [];
    
    const organizationRef = doc(db, "organizations", organizationId);
    const orgDoc = await getDoc(organizationRef);

    if (orgDoc.exists()) {
        const data = orgDoc.data();
        return (data.members || []) as OrganizationMember[];
    }

    return [];
}


export async function updateMemberInOrganization(organizationId: string, originalEmail: string, newName: string, newEmail: string) {
    if (!organizationId || !originalEmail || !newName || !newEmail) {
        throw new Error("All parameters are required for updating a member.");
    }

    const organizationRef = doc(db, "organizations", organizationId);
    
    await runTransaction(db, async (transaction) => {
        const orgDoc = await transaction.get(organizationRef);
        if (!orgDoc.exists()) {
            throw new Error("Organization not found.");
        }

        const members = (orgDoc.data().members || []) as OrganizationMember[];
        
        const memberToUpdate = members.find(m => m.email === originalEmail);
        if (!memberToUpdate) {
            throw new Error("Member not found.");
        }
        
        // If email is being changed, check if the new email already exists
        if (originalEmail !== newEmail && members.some(m => m.email === newEmail)) {
            throw new Error("Another member with this email already exists.");
        }
        
        const updatedMembers = members.map(m => 
            m.email === originalEmail ? { name: newName, email: newEmail } : m
        );
        
        transaction.update(organizationRef, { members: updatedMembers });
    });

    return { success: true };
}


export async function deleteMemberFromOrganization(organizationId: string, email: string) {
    if (!organizationId || !email) {
        throw new Error("Organization ID and member email are required.");
    }

    const organizationRef = doc(db, "organizations", organizationId);
    
    await runTransaction(db, async (transaction) => {
        const orgDoc = await transaction.get(organizationRef);
        if (!orgDoc.exists()) {
            throw new Error("Organization not found.");
        }

        const members = (orgDoc.data().members || []) as OrganizationMember[];
        const memberToDelete = members.find(m => m.email === email);
        if (!memberToDelete) {
             throw new Error("Member not found to delete.");
        }

        await updateDoc(organizationRef, {
            members: arrayRemove(memberToDelete)
        });
    });

    return { success: true };
}
    