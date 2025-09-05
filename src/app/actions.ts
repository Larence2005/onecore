
"use server";

import type { Settings } from '@/providers/settings-provider';
import {
    ConfidentialClientApplication,
    Configuration,
    AuthenticationResult
} from '@azure/msal-node';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc, writeBatch, query, where, runTransaction, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getAuth } from "firebase-admin/auth";
import { app as adminApp } from '@/lib/firebase-admin';
import { auth as adminAuth } from '@/lib/firebase-admin';


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


export async function getTicketsFromDB(options?: { includeArchived?: boolean, fetchAll?: boolean, agentEmail?: string }): Promise<Email[]> {
    const ticketsCollectionRef = collection(db, 'tickets');
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
            id: ticketDoc.id,
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


export async function fetchAndStoreFullConversation(settings: Settings, conversationId: string): Promise<DetailedEmail[]> {
    const authResponse = await getAccessToken(settings);
    if (!authResponse?.accessToken) {
        // Can't fetch from API, return empty array. The caller should handle this.
        return [];
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
                bodyPreview: lastMessage.bodyPreview,
                receivedDateTime: lastMessage.receivedDateTime,
                sender: lastMessage.sender,
                senderEmail: lastMessage.senderEmail,
            });
        }
    }


    return conversationMessages;
}


export async function getEmail(settings: Settings, id: string): Promise<DetailedEmail> {
    let conversationId: string | undefined;
    let conversationMessages: DetailedEmail[] = [];
    
    const ticketDocRefById = doc(db, 'tickets', id);
    const ticketDocSnap = await getDoc(ticketDocRefById);

    if (ticketDocSnap.exists()) {
        conversationId = ticketDocSnap.data().conversationId;
    } else {
        throw new Error("Ticket not found in the database.");
    }
    
    if (!conversationId) {
        throw new Error("Could not determine the conversation for this ticket.");
    }
    
    // Now we have a conversationId, let's get the conversation
    const conversationDocRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationDocRef);

    if (conversationDoc.exists() && conversationDoc.data().messages) {
        conversationMessages = conversationDoc.data().messages as DetailedEmail[];
    } else {
        // If not in cache, try to fetch from API, but only if settings are configured.
        if (settings.clientId && settings.clientSecret && settings.tenantId) {
            conversationMessages = await fetchAndStoreFullConversation(settings, conversationId);
        } else {
             // We don't throw an error here, as the conversation might just not be cached yet.
             // We can construct the detail view from the ticket data alone if needed.
             console.log("Conversation not cached and API not configured. Some details may be missing.");
        }
    }
    
    // If conversation is still empty, maybe it's a new ticket not yet synced.
    // We can rely on the ticket document itself.
    if (!conversationMessages || conversationMessages.length === 0) {
       if (ticketDocSnap.exists()) {
           const ticketData = ticketDocSnap.data();
           const placeholderEmail: DetailedEmail = {
               id: ticketDocSnap.id,
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
           conversationMessages = [placeholderEmail];
       } else {
            throw new Error('This ticket could not be found in the database.');
       }
    }

    // Now, find the main ticket document for this conversation to get the properties
    const ticketsCollectionRef = collection(db, 'tickets');
    const q = query(ticketsCollectionRef, where('conversationId', '==', conversationId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        throw new Error("Ticket properties not found for this conversation.");
    }
    
    const ticketDoc = querySnapshot.docs[0];
    const ticketData = ticketDoc.data();
    
    const mainEmail = conversationMessages.find(m => m.id === ticketDoc.id) || conversationMessages[0];

    return {
        ...mainEmail,
        id: ticketDoc.id, // Ensure the ID is the ticket ID, not a message ID
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
        throw new Error('Failed to acquire access token. Check your API settings.');
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
        throw new Error('Failed to acquire access token. Check your API settings.');
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
