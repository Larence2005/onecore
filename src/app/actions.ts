
"use server";

import type { Settings } from '@/providers/settings-provider';
import {
    ConfidentialClientApplication,
    Configuration,
    AuthenticationResult
} from '@azure/msal-node';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc, writeBatch, query, where, runTransaction, increment, arrayUnion, arrayRemove, addDoc, orderBy, limit } from 'firebase/firestore';
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
    status: string;
    type: string;
    conversationId?: string;
    deadline?: string;
    tags?: string[];
    closedAt?: string;
    lastReplier?: 'agent' | 'client';
    ticketNumber?: number;
    companyId?: string;
    companyName?: string;
}

export interface Attachment {
    id: string;
    name: string;
    contentType: string;
    size: number;
    contentBytes: string; // Base64 encoded content
    isInline?: boolean;
    contentId?: string;
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
    ticketId?: string;
    ticketSubject?: string;
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
    uid?: string;
    name: string;
    email: string;
    address?: string;
    mobile?: string;
    landline?: string;
}

export interface Company {
    id: string;
    name: string;
    ticketCount?: number;
    address?: string;
    mobile?: string;
    landline?: string;
    website?: string;
}

export interface Employee {
    name: string;
    email: string;
    address?: string;
    mobile?: string;
    landline?: string;
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


export async function getTicketsFromDB(organizationId: string, options?: { includeArchived?: boolean, fetchAll?: boolean, companyId?: string }): Promise<Email[]> {
    if (!organizationId) return [];
    const ticketsCollectionRef = collection(db, 'organizations', organizationId, 'tickets');
    let queries = [];

    if (options?.includeArchived) {
        queries.push(where('status', '==', 'Archived'));
    } else if(!options?.fetchAll) {
        queries.push(where('status', '!=', 'Archived'));
    }

    if (options?.companyId) {
        queries.push(where('companyId', '==', options.companyId));
    }

    const q = query(ticketsCollectionRef, ...queries);
    const querySnapshot = await getDocs(q);

    // Fetch all companies once for efficiency
    const companies = await getCompanies(organizationId);
    const companyMap = new Map(companies.map(c => [c.id, c.name]));
    
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
            status: data.status || 'Open',
            type: data.type || 'Incident',
            conversationId: data.conversationId,
            tags: data.tags || [],
            deadline: data.deadline,
            closedAt: data.closedAt,
            ticketNumber: data.ticketNumber,
            statusBeforeArchive: data.statusBeforeArchive,
            companyId: data.companyId,
            companyName: data.companyId ? companyMap.get(data.companyId) : undefined,
        };
    }));
    
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
        status: 'Open',
        type: 'Incident',
        companyId: null,
    };

    if (!querySnapshot.empty) {
        const ticketData = querySnapshot.docs[0].data();
        ticketProperties = {
            priority: ticketData.priority || 'Low',
            status: ticketData.status || 'Open',
            type: ticketData.type || 'Incident',
            companyId: ticketData.companyId || null,
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
        status: ticketProperties.status,
        type: ticketProperties.type,
        companyId: ticketProperties.companyId,
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

    // When a conversation is updated, we also need to update the main ticket's bodyPreview and received time
    if (conversationMessages.length > 0) {
        const lastMessage = conversationMessages[conversationMessages.length - 1];

        // Find the corresponding ticket document
        if (!querySnapshot.empty) {
            const ticketDocRef = querySnapshot.docs[0].ref;
            await updateDoc(ticketDocRef, {
                bodyPreview: lastMessage.bodyPreview,
                receivedDateTime: lastMessage.receivedDateTime,
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

    if (conversationMessages.length === 0) {
        const placeholderEmail: DetailedEmail = {
            id: ticketData.id || id,
            subject: ticketData.title || 'No Subject',
            sender: ticketData.sender || 'Unknown Sender',
            senderEmail: ticketData.senderEmail || 'Unknown Email',
            bodyPreview: ticketData.bodyPreview || '',
            receivedDateTime: ticketData.receivedDateTime,
            priority: ticketData.priority || 'Low',
            status: ticketData.status || 'Open',
            type: ticketData.type || 'Incident',
            conversationId: ticketData.conversationId,
            tags: ticketData.tags || [],
            deadline: ticketData.deadline,
            closedAt: ticketData.closedAt,
            ticketNumber: ticketData.ticketNumber,
            companyId: ticketData.companyId,
            body: { contentType: 'html', content: ticketData.bodyPreview || '<p>Full email content is not available yet.</p>' }
        };
        conversationMessages.push(placeholderEmail);
    }
    
    // The first message in the sorted conversation is the one we use for body content
    const firstMessage = conversationMessages[0];

    // The main email object uses the ticket's data for core properties
    // and the first message's data for the initial body content.
    const mainEmailDetails: DetailedEmail = {
        id: ticketData.id || id,
        subject: ticketData.title || 'No Subject',
        sender: ticketData.sender || 'Unknown Sender', // Always use the ticket's original sender
        senderEmail: ticketData.senderEmail || 'Unknown Email', // Always use the ticket's original sender email
        bodyPreview: ticketData.bodyPreview,
        receivedDateTime: ticketData.receivedDateTime,
        priority: ticketData.priority,
        status: ticketData.status,
        type: ticketData.type,
        tags: ticketData.tags,
        deadline: ticketData.deadline,
        closedAt: ticketData.closedAt,
        conversationId: ticketData.conversationId,
        ticketNumber: ticketData.ticketNumber,
        companyId: ticketData.companyId,
        body: firstMessage.body || { contentType: 'html', content: ticketData.bodyPreview || '<p>Full email content is not available yet.</p>' },
        // The conversation array is the thread of messages.
        conversation: conversationMessages.map(convMsg => ({
            ...convMsg,
            priority: ticketData.priority || 'Low',
            status: ticketData.status || 'Open',
            type: ticketData.type || 'Incident',
        })),
    };

    return mainEmailDetails;
}



const parseRecipients = (recipients: string | undefined): { emailAddress: { address: string; name?: string } }[] => {
    if (!recipients) return [];
    return recipients.split(/[,;]\s*/).filter(email => email.trim() !== '').map(email => {
        // Basic parsing for "Name <email@example.com>" format
        const match = email.match(/(.*)<(.*)>/);
        if (match) {
            return { emailAddress: { name: match[1].trim(), address: match[2].trim() } };
        }
        return { emailAddress: { address: email.trim() } };
    });
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
            toRecipients: parseRecipients(emailData.recipient),
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

    // After successfully sending a reply, DO NOT invalidate the cache immediately.
    // Let the background sync handle it to prevent race conditions.
    
    return { success: true };
}


export async function forwardEmailAction(
    settings: Settings,
    organizationId: string,
    ticketId: string,
    messageId: string,
    comment: string,
    to: string,
    cc: string | undefined,
    bcc: string | undefined,
    currentUserEmail: string,
    fromName: string,
    ticketNumber: number,
    ticketSubject: string
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

    // Add activity log after successful forward
    await addActivityLog(organizationId, ticketId, {
        type: 'Forward',
        details: `Forwarded to: ${to}`,
        date: new Date().toISOString(),
        user: currentUserEmail,
    });
    
    // Send a notification email to the primary recipients
    const orgMembers = await getOrganizationMembers(organizationId);
    
    for (const recipient of toRecipients) {
        const recipientMember = orgMembers.find(m => m.email.toLowerCase() === recipient.emailAddress.address.toLowerCase());
        const recipientName = recipient.emailAddress.name || recipientMember?.name || 'there';
        const ticketUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/tickets/${ticketId}`;

        const notificationSubject = `Notification: A message was forwarded to you regarding Ticket #${ticketNumber}`;
        const notificationBody = `
            <p>Hello ${recipientName},</p>
            <p>${fromName} has forwarded a message to you:</p>
            <p><b>Ticket #${ticketNumber}: ${ticketSubject}</b></p>
            <p>To view the full ticket, kindly visit the website: <a href="${ticketUrl}">View Ticket</a></p>
            <br>
            <p>This is a notification-only. Please do not reply directly to this message.</p>
        `;

        try {
            await sendEmailAction(settings, {
                recipient: recipient.emailAddress.address,
                subject: notificationSubject,
                body: notificationBody,
            });
        } catch (notificationError) {
            console.error(`Failed to send forward notification email to ${recipient.emailAddress.address}:`, notificationError);
            // Do not throw an error here, as the primary action (forwarding) was successful.
        }
    }

    return { success: true };
}


export async function addEmployeeToCompany(organizationId: string, companyId: string, employee: Employee) {
    if (!organizationId || !companyId || !employee.email) {
        return; // Or throw an error
    }
    const employeeDocRef = doc(db, 'organizations', organizationId, 'companies', companyId, 'employees', employee.email);
    // Use set with merge to create or update, preventing duplicates based on email doc ID
    await setDoc(employeeDocRef, { 
        name: employee.name, 
        email: employee.email,
        address: employee.address || '',
        mobile: employee.mobile || '',
        landline: employee.landline || '',
    }, { merge: true });
}

export async function getCompanyEmployees(organizationId: string, companyId: string): Promise<Employee[]> {
    if (!organizationId || !companyId) return [];
    const employeesCollectionRef = collection(db, 'organizations', organizationId, 'companies', companyId, 'employees');
    const snapshot = await getDocs(query(employeesCollectionRef, orderBy('name')));
    return snapshot.docs.map(doc => ({
        ...doc.data(),
        email: doc.id
    }) as Employee);
}

export async function updateCompanyEmployee(
    organizationId: string,
    companyId: string,
    originalEmail: string,
    employeeData: Employee
) {
    if (!organizationId || !companyId || !originalEmail || !employeeData.email) {
        throw new Error("Missing required parameters to update employee.");
    }
    
    const employeeDocRef = doc(db, 'organizations', organizationId, 'companies', companyId, 'employees', originalEmail);
    
    // If the email is not changing, we can just update the document.
    if (originalEmail === employeeData.email) {
        await updateDoc(employeeDocRef, {
            name: employeeData.name,
            address: employeeData.address || '',
            mobile: employeeData.mobile || '',
            landline: employeeData.landline || '',
        });
    } else {
        // If email (the document ID) is changing, we have to delete the old doc and create a new one.
        // This should be done in a transaction to ensure atomicity.
        await runTransaction(db, async (transaction) => {
            const oldDoc = await transaction.get(employeeDocRef);
            if (!oldDoc.exists()) {
                throw new Error("Original employee record not found.");
            }
            
            const newEmployeeDocRef = doc(db, 'organizations', organizationId, 'companies', companyId, 'employees', employeeData.email);
            
            // Check if the new email already exists to prevent overwriting another employee.
            const newDocCheck = await transaction.get(newEmployeeDocRef);
            if (newDocCheck.exists()) {
                throw new Error("An employee with the new email address already exists.");
            }

            transaction.delete(employeeDocRef);
            transaction.set(newEmployeeDocRef, employeeData);
        });
    }
    
    return { success: true };
}



export async function updateTicket(organizationId: string, id: string, data: { priority?: string; status?: string; type?: string; deadline?: string | null; tags?: string[]; closedAt?: string | null; companyId?: string | null; }, settings: Settings | null) {
    const ticketDocRef = doc(db, 'organizations', organizationId, 'tickets', id);
    try {
        await runTransaction(db, async (transaction) => {
            // --- READS FIRST ---
            const ticketDoc = await transaction.get(ticketDocRef);
            if (!ticketDoc.exists()) {
                throw new Error("Ticket not found!");
            }
            
            const ticketData = ticketDoc.data();
            
            // --- WRITES AFTER ---
            const updateData: any = { ...data };

            // Handle status changes for closing tickets
            if (data.status && (data.status === 'Resolved' || data.status === 'Closed')) {
                if(ticketData.status !== 'Resolved' && ticketData.status !== 'Closed') {
                    updateData.closedAt = new Date().toISOString();
                }
                 // Check for "Resolved Late"
                if (ticketData.deadline && isPast(parseISO(ticketData.deadline))) {
                    updateData.tags = arrayUnion('Resolved Late');
                }
            }
            
            // Handle status changes for reopening tickets
            if (data.status && (data.status === 'Open' || data.status === 'Pending')) {
                updateData.closedAt = null;
                // If reopening, remove the "Resolved Late" tag
                updateData.tags = arrayRemove('Resolved Late');
            }

            // Update the ticket
            transaction.update(ticketDocRef, updateData);
            
            if (data.companyId && ticketData.senderEmail) {
                await addEmployeeToCompany(organizationId, data.companyId, {
                    name: ticketData.sender,
                    email: ticketData.senderEmail,
                });
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

export async function getAllActivityLogs(organizationId: string): Promise<ActivityLog[]> {
    if (!organizationId) {
        return [];
    }

    try {
        const ticketsCollectionRef = collection(db, 'organizations', organizationId, 'tickets');
        const ticketsSnapshot = await getDocs(ticketsCollectionRef);
        let allLogs: ActivityLog[] = [];

        for (const ticketDoc of ticketsSnapshot.docs) {
            const ticketData = ticketDoc.data();
            const activityCollectionRef = collection(ticketDoc.ref, 'activity');
            const activitySnapshot = await getDocs(activityCollectionRef);
            
            const logs = activitySnapshot.docs.map(logDoc => ({
                id: logDoc.id,
                ...(logDoc.data() as Omit<ActivityLog, 'id'>),
                ticketId: ticketDoc.id,
                ticketSubject: ticketData.title || 'No Subject'
            }));
            
            allLogs = allLogs.concat(logs);
        }

        // Sort all logs by date descending and take the most recent ones
        allLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        return allLogs.slice(0, 20); // Limit to the 20 most recent activities
    } catch (error) {
        console.error("Failed to get all activity logs:", error);
        return [];
    }
}

export async function getCompanyActivityLogs(organizationId: string, companyId: string): Promise<ActivityLog[]> {
    if (!organizationId || !companyId) {
        return [];
    }
    try {
        const ticketsCollectionRef = collection(db, 'organizations', organizationId, 'tickets');
        const ticketsQuery = query(ticketsCollectionRef, where('companyId', '==', companyId));
        const ticketsSnapshot = await getDocs(ticketsQuery);
        
        let allLogs: ActivityLog[] = [];

        for (const ticketDoc of ticketsSnapshot.docs) {
            const ticketData = ticketDoc.data();
            const activityCollectionRef = collection(ticketDoc.ref, 'activity');
            const activitySnapshot = await getDocs(activityCollectionRef);
            
            const logs = activitySnapshot.docs.map(logDoc => ({
                id: logDoc.id,
                ...(logDoc.data() as Omit<ActivityLog, 'id'>),
                ticketId: ticketDoc.id,
                ticketSubject: ticketData.title || 'No Subject'
            }));
            
            allLogs = allLogs.concat(logs);
        }

        // Sort all logs by date descending and take the most recent ones
        allLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        return allLogs.slice(0, 20); // Limit to the 20 most recent activities
    } catch (error) {
        console.error("Failed to get company activity logs:", error);
        return [];
    }
}


// --- Organization Actions ---

export async function createOrganization(name: string, uid: string, userName: string, email: string) {
    const organizationRef = doc(collection(db, "organizations"));
    await setDoc(organizationRef, {
        name: name,
        owner: uid,
        members: [{ name: userName, email: email, uid: uid, address: '', mobile: '', landline: '' }],
        address: '',
        mobile: '',
        landline: '',
        website: ''
    });
    
    return { success: true, organizationId: organizationRef.id };
}


export async function addMemberToOrganization(organizationId: string, name: string, email: string, address: string, mobile: string, landline: string) {
    if (!organizationId || !email || !name) {
        throw new Error("Organization ID, member name, and email are required.");
    }
    
    const organizationRef = doc(db, "organizations", organizationId);
    const orgDoc = await getDoc(organizationRef);
    if(orgDoc.exists()){
        const members = orgDoc.data().members as {name: string, email: string}[] | undefined;
        if (members && members.some(member => member.email === email)) {
            throw new Error("A contact with this email already exists in your organization.");
        }
    }
    
    await updateDoc(organizationRef, {
        members: arrayUnion({ name, email, address, mobile, landline })
    });

    return { success: true };
}

export async function getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
    if (!organizationId) return [];

    const organizationRef = doc(db, "organizations", organizationId);
    const orgDoc = await getDoc(organizationRef);

    if (!orgDoc.exists()) {
        return [];
    }
    
    return (orgDoc.data().members || []) as OrganizationMember[];
}



export async function updateMemberInOrganization(organizationId: string, originalEmail: string, newName: string, newEmail: string, newAddress: string, newMobile: string, newLandline: string) {
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
            m.email === originalEmail ? { ...m, name: newName, email: newEmail, address: newAddress, mobile: newMobile, landline: newLandline } : m
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

        const updatedMembers = members.filter(m => m.email !== email);
        transaction.update(organizationRef, { members: updatedMembers });
    });

    return { success: true };
}
    
export async function updateOrganization(
    organizationId: string, 
    data: { name?: string; address?: string; mobile?: string; landline?: string; website?: string }
) {
    if (!organizationId) {
        throw new Error("Organization ID is required.");
    }
    const orgDocRef = doc(db, 'organizations', organizationId);
    await updateDoc(orgDocRef, data);
    return { success: true };
}

export async function deleteOrganization(organizationId: string) {
    if (!organizationId) {
        throw new Error("Organization ID is required.");
    }

    const orgDocRef = doc(db, 'organizations', organizationId);
    
    // Deleting subcollections is a bit more involved.
    // For this app, subcollections are: tickets, conversations, counters
    const ticketsRef = collection(orgDocRef, 'tickets');
    const ticketsSnap = await getDocs(ticketsRef);
    const batch = writeBatch(db);
    ticketsSnap.forEach(ticketDoc => {
        // Here you could also delete sub-sub-collections like 'activity'
        batch.delete(ticketDoc.ref);
    });
    
    const convosRef = collection(orgDocRef, 'conversations');
    const convosSnap = await getDocs(convosRef);
    convosSnap.forEach(convoDoc => {
        batch.delete(convoDoc.ref);
    });

    const countersRef = collection(orgDocRef, 'counters');
    const countersSnap = await getDocs(countersRef);
    countersSnap.forEach(counterDoc => {
        batch.delete(counterDoc.ref);
    });

    // Delete the organization doc itself
    batch.delete(orgDocRef);
    
    await batch.commit();
    
    return { success: true };
}

// --- Company Actions ---

export async function addCompany(organizationId: string, companyName: string): Promise<{success: boolean, id?: string, error?: string}> {
    if (!organizationId || !companyName.trim()) {
        return { success: false, error: 'Organization ID and company name are required.' };
    }
    try {
        const companiesCollectionRef = collection(db, 'organizations', organizationId, 'companies');
        // Check if a company with the same name already exists (case-insensitive)
        const q = query(companiesCollectionRef, where('name_lowercase', '==', companyName.trim().toLowerCase()));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return { success: false, error: 'A company with this name already exists.' };
        }

        const newCompanyRef = await addDoc(companiesCollectionRef, {
            name: companyName.trim(),
            name_lowercase: companyName.trim().toLowerCase(),
            address: '',
            mobile: '',
            landline: '',
            website: ''
        });
        return { success: true, id: newCompanyRef.id };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, error: errorMessage };
    }
}

export async function getCompanies(organizationId: string): Promise<Company[]> {
    if (!organizationId) return [];

    const companiesCollectionRef = collection(db, 'organizations', organizationId, 'companies');
    const companiesSnapshot = await getDocs(query(companiesCollectionRef, orderBy('name')));
    
    const companies = companiesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        address: doc.data().address,
        mobile: doc.data().mobile,
        landline: doc.data().landline,
        website: doc.data().website,
    }));
    
    return companies;
}

export async function getCompanyWithTicketCount(organizationId: string): Promise<Company[]> {
    if (!organizationId) return [];
    
    const companies = await getCompanies(organizationId);
    
    const ticketsCollectionRef = collection(db, 'organizations', organizationId, 'tickets');
    const ticketsSnapshot = await getDocs(ticketsCollectionRef);
    
    const ticketCounts = new Map<string, number>();
    ticketsSnapshot.docs.forEach(doc => {
        const companyId = doc.data().companyId;
        if (companyId) {
            ticketCounts.set(companyId, (ticketCounts.get(companyId) || 0) + 1);
        }
    });

    return companies.map(company => ({
        ...company,
        ticketCount: ticketCounts.get(company.id) || 0,
    }));
}


export async function getCompanyDetails(organizationId: string, companyId: string): Promise<Company | null> {
    if (!organizationId || !companyId) return null;

    const companyDocRef = doc(db, 'organizations', organizationId, 'companies', companyId);
    const companyDoc = await getDoc(companyDocRef);

    if (!companyDoc.exists()) {
        return null;
    }
    const data = companyDoc.data();
    return {
        id: companyDoc.id,
        name: data.name,
        address: data.address,
        mobile: data.mobile,
        landline: data.landline,
        website: data.website,
    };
}

export async function updateCompany(
    organizationId: string, 
    companyId: string,
    data: { name?: string; address?: string; mobile?: string; landline?: string; website?: string }
) {
    if (!organizationId || !companyId) {
        throw new Error("Organization ID and Company ID are required.");
    }
    const companyDocRef = doc(db, 'organizations', organizationId, 'companies', companyId);
    await updateDoc(companyDocRef, data);
    return { success: true };
}
    
    

    

    


    

    

    
