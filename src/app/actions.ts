
"use server";

import {
    ConfidentialClientApplication,
    Configuration,
    AuthenticationResult,
} from '@azure/msal-node';
import { ClientSecretCredential } from "@azure/identity";
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc, writeBatch, query, where, runTransaction, increment, arrayUnion, arrayRemove, addDoc, orderBy, limit } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from "firebase-admin/auth";
import { app as adminApp } from '@/lib/firebase-admin';
import { auth as adminAuth } from '@/lib/firebase-admin';
import { isPast, parseISO, isWithinInterval, addHours } from 'date-fns';
import { SimpleCache } from '@/lib/cache';
import { headers } from 'next/headers';
import axios from 'axios';
import dns from "dns";
import { Client } from "@microsoft/microsoft-graph-client";


// Initialize caches for different data types
// Cache TTL: 5 minutes for lists, 2 minutes for individual items
const ticketsCache = new SimpleCache<any>(300);
const companiesCache = new SimpleCache<any>(300);
const membersCache = new SimpleCache<any>(300);
const activityCache = new SimpleCache<any>(120);


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
    assignee?: string; // UID of the assigned user
    assigneeName?: string; // Name of the assigned user
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
    uid: string | null;
    name: string;
    email: string;
    address?: string;
    mobile?: string;
    landline?: string;
    status: 'Uninvited' | 'Invited' | 'Registered' | 'Not Verified' | 'Verified';
    isClient?: boolean;
}

export interface Company {
    id: string;
    name: string;
    ticketCount?: number;
    unresolvedTicketCount?: number;
    employeeCount?: number;
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

export interface Note {
    id: string;
    content: string;
    date: string;
    user: string;
}

interface Settings {
  clientId: string;
  tenantId: string;
  clientSecret: string;
  userId: string;
}

async function getAPISettings(organizationId: string): Promise<Settings | null> {
    const clientId = process.env.AZURE_CLIENT_ID;
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    
    if (!clientId || !tenantId || !clientSecret) {
        console.error("Azure API settings are not fully configured in environment variables.");
        return null;
    }

    // Fetch the organization to find the admin's verified email
    const orgDocRef = doc(db, 'organizations', organizationId);
    const orgDoc = await getDoc(orgDocRef);
    if (!orgDoc.exists()) {
        console.error(`Organization with ID ${organizationId} not found.`);
        return null;
    }

    const orgData = orgDoc.data();
    const ownerUid = orgData.owner;
    const members = orgData.members as OrganizationMember[];
    
    const owner = members.find(m => m.uid === ownerUid);

    if (!owner || !owner.email || owner.status !== 'Verified') {
        console.error(`Verified admin for organization ${organizationId} not found or has no email.`);
        return null;
    }

    const userId = owner.email;

    return {
        clientId,
        tenantId,
        clientSecret,
        userId,
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

export async function createTicket(
    organizationId: string, 
    author: { uid: string, name: string, email: string }, 
    title: string, 
    body: string
): Promise<{ success: boolean, id?: string, error?: string }> {
    if (!organizationId || !author.uid || !title.trim()) {
        return { success: false, error: 'Missing required fields to create a ticket.' };
    }
    
    // Find which company this employee belongs to
    let companyId: string | undefined = undefined;
    const userProfileDocRef = doc(db, 'userProfiles', author.uid);
    const userProfileDoc = await getDoc(userProfileDocRef);
    if(userProfileDoc.exists() && userProfileDoc.data().isClient) {
        // This is a client user, find their company
         const allCompanies = await getCompanies(organizationId);
         for (const company of allCompanies) {
            const employeeDocRef = doc(db, 'organizations', organizationId, 'companies', company.id, 'employees', author.email);
            const employeeDoc = await getDoc(employeeDocRef);
            if (employeeDoc.exists()) {
                companyId = company.id;
                break;
            }
        }
    }


    try {
        const ticketNumber = await getNextTicketNumber(organizationId);
        const ticketsCollectionRef = collection(db, 'organizations', organizationId, 'tickets');
        const newTicketRef = doc(ticketsCollectionRef);
        
        const newTicketData = {
            id: newTicketRef.id,
            title: title,
            sender: author.name,
            senderEmail: author.email,
            bodyPreview: body.substring(0, 255), // Use body as preview
            receivedDateTime: new Date().toISOString(),
            priority: 'Low',
            status: 'Open',
            type: 'Incident',
            tags: [],
            deadline: null,
            closedAt: null,
            ticketNumber: ticketNumber,
            assignee: null,
            companyId: companyId,
        };

        await setDoc(newTicketRef, newTicketData);

        // Store the body content in a conversation document, similar to how emails work
        const conversationId = `manual-${newTicketRef.id}`;
        const conversationDocRef = doc(db, 'organizations', organizationId, 'conversations', conversationId);
        const conversationMessage: DetailedEmail = {
            id: `msg-${Date.now()}`,
            subject: title,
            sender: author.name,
            senderEmail: author.email,
            body: { contentType: 'html', content: body }, // Assuming body is HTML from a rich text editor
            receivedDateTime: newTicketData.receivedDateTime,
            bodyPreview: newTicketData.bodyPreview,
            priority: 'Low',
            status: 'Open',
            type: 'Incident',
            conversationId: conversationId
        };
        await setDoc(conversationDocRef, { messages: [conversationMessage] });

        // Update ticket with conversation ID
        await updateDoc(newTicketRef, { conversationId: conversationId });

        await addActivityLog(organizationId, newTicketRef.id, {
            type: 'Create',
            details: 'Ticket created',
            date: newTicketData.receivedDateTime,
            user: author.email || 'System',
        });
        
        // Send email for the ticket creation
        const settings = await getAPISettings(organizationId);
        if (settings) {
            try {
                const headersList = headers();
                const host = headersList.get('host') || '';
                const protocol = headersList.get('x-forwarded-proto') || 'http';
                const ticketUrl = `${protocol}://${host}/tickets/${newTicketRef.id}`;

                const emailSubject = `[Ticket #${ticketNumber}] ${title}`;
                let emailBody: string;

                // Check if the author is a client
                const isClient = userProfileDoc.exists() && userProfileDoc.data().isClient;

                if (isClient) {
                    // For clients, send the email TO the support inbox and CC the client.
                    // This makes it act like they sent it from their email client.
                    emailBody = `
                        <p>A new ticket has been created by ${author.name} (${author.email}).</p>
                        <hr>
                        ${body}
                    `;
                    await sendEmailAction(organizationId, {
                        recipient: settings.userId, // Send TO the support email
                        cc: author.email, // CC the client
                        subject: emailSubject,
                        body: emailBody,
                    });
                } else {
                    // For agents creating a ticket, send a confirmation notification TO them.
                    emailBody = `
                        <p>Hello ${author.name},</p>
                        <p>Your ticket with the subject "${title}" has been created successfully.</p>
                        <p>Your ticket number is <b>#${ticketNumber}</b>.</p>
                        <p>You can view your ticket and any updates here: <a href="${ticketUrl}">${ticketUrl}</a></p>
                        <br>
                        <p>This is an automated notification. Replies to this email are not monitored.</p>
                    `;
                    await sendEmailAction(organizationId, {
                        recipient: author.email,
                        subject: `Ticket Created: #${ticketNumber} - ${title}`,
                        body: emailBody,
                    });
                }
            } catch(e) {
                console.error("Failed to send ticket creation email for manually created ticket:", e);
                // Don't fail the whole operation if email fails
            }
        }


        // Invalidate caches
        ticketsCache.invalidatePrefix(`tickets:${organizationId}`);
        activityCache.invalidatePrefix(`activity:${organizationId}`);

        return { success: true, id: newTicketRef.id };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, error: errorMessage };
    }
}


export async function getLatestEmails(organizationId: string): Promise<void> {
    const settings = await getAPISettings(organizationId);
    if (!settings) {
        console.log("Skipping email sync: API credentials not configured.");
        return;
    }
    
    try {
        const authResponse = await getAccessToken(settings);
        if (!authResponse?.accessToken) {
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
            
            // Skip notification emails from our own system to prevent loops
            const subjectLower = email.subject.toLowerCase();
            if (subjectLower.includes("notification:") || subjectLower.includes("update on ticket") || subjectLower.includes("you've been assigned") || subjectLower.includes("ticket created:")) {
                continue; 
            }

            const ticketsCollectionRef = collection(db, 'organizations', organizationId, 'tickets');
            const q = query(ticketsCollectionRef, where('conversationId', '==', email.conversationId));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                // This is a new conversation thread, create a ticket.
                const senderEmail = email.from.emailAddress.address.toLowerCase();

                // Do not create tickets from the monitored email address itself
                if (senderEmail === settings.userId.toLowerCase()) {
                    continue;
                }

                // Check if the sender belongs to any company
                let companyId: string | undefined = undefined;
                const allCompanies = await getCompanies(organizationId);
                for (const company of allCompanies) {
                    const employeeDocRef = doc(db, 'organizations', organizationId, 'companies', company.id, 'employees', senderEmail);
                    const employeeDoc = await getDoc(employeeDocRef);
                    if (employeeDoc.exists()) {
                        companyId = company.id;
                        break;
                    }
                }

                const ticketNumber = await getNextTicketNumber(organizationId);
                const ticketDocRef = doc(ticketsCollectionRef); // Create a new document reference to get the ID
                const ticketId = ticketDocRef.id;

                const preliminaryTicketData = {
                    id: ticketId,
                    title: email.subject || 'No Subject',
                    sender: email.from.emailAddress.name || 'Unknown Sender',
                    senderEmail: email.from.emailAddress.address || 'Unknown Email',
                    bodyPreview: email.bodyPreview,
                    receivedDateTime: email.receivedDateTime,
                    conversationId: email.conversationId,
                    priority: 'Low',
                    status: 'Open',
                    type: 'Incident',
                    tags: [],
                    deadline: null,
                    closedAt: null,
                    ticketNumber: ticketNumber,
                    assignee: null,
                    companyId: companyId, // Associate company if found
                };

                try {
                    await setDoc(ticketDocRef, preliminaryTicketData);
                    
                    await addActivityLog(organizationId, ticketId, {
                        type: 'Create',
                        details: 'Ticket created',
                        date: email.receivedDateTime,
                        user: email.from.emailAddress.address || 'System',
                    });

                    // Send notification for email-based tickets
                    try {
                        const headersList = headers();
                        const host = headersList.get('host') || '';
                        const protocol = headersList.get('x-forwarded-proto') || 'http';
                        const ticketUrl = `${protocol}://${host}/tickets/${ticketId}`;
                        
                        const notificationSubject = `Ticket Created: #${ticketNumber} - ${preliminaryTicketData.title}`;
                        const notificationBody = `
                            <p>Hello ${preliminaryTicketData.sender},</p>
                            <p>Your ticket with the subject "${preliminaryTicketData.title}" has been created successfully.</p>
                            <p>Your ticket number is <b>#${ticketNumber}</b>.</p>
                            <p>You can view your ticket and any updates here: <a href="${ticketUrl}">${ticketUrl}</a></p>
                            <br>
                            <p>This is an automated notification. Replies to this email are not monitored.</p>
                        `;

                        await sendEmailAction(organizationId, {
                            recipient: preliminaryTicketData.senderEmail,
                            subject: notificationSubject,
                            body: notificationBody,
                        });
                    } catch (e) {
                        console.error("Failed to send ticket creation notification for email-based ticket:", e);
                    }

                    await fetchAndStoreFullConversation(organizationId, email.conversationId);

                } catch (e) {
                    console.log(`Ticket creation for conversation ${email.conversationId} skipped, likely already exists.`);
                }

            } else {
                // It's a reply to an existing ticket.
                await fetchAndStoreFullConversation(organizationId, email.conversationId);
            }
        }
    } catch (error) {
        console.error("API call failed, continuing with data from DB:", error);
    }
}


export async function getTicketsFromDB(organizationId: string, options?: { includeArchived?: boolean, fetchAll?: boolean, companyId?: string }): Promise<Email[]> {
    if (!organizationId) return [];

    const cacheKey = `tickets:${organizationId}:${JSON.stringify(options || {})}`;
    const cachedTickets = ticketsCache.get(cacheKey);
    if (cachedTickets) return cachedTickets;
    
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
            assignee: data.assignee,
        };
    }));
    
    emails.sort((a, b) => new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime());
    
    ticketsCache.set(cacheKey, emails);
    return emails;
}


export async function fetchAndStoreFullConversation(organizationId: string, conversationId: string): Promise<DetailedEmail[]> {
    const settings = await getAPISettings(organizationId);
    if (!settings) {
        console.log("Skipping conversation fetch: API credentials not configured.");
        return [];
    }

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
        assignee: null,
    };
    let ticketId: string | null = null;

    if (!querySnapshot.empty) {
        const ticketDoc = querySnapshot.docs[0];
        ticketId = ticketDoc.id;
        const ticketData = ticketDoc.data();
        ticketProperties = {
            priority: ticketData.priority || 'Low',
            status: ticketData.status || 'Open',
            type: ticketData.type || 'Incident',
            companyId: ticketData.companyId || null,
            assignee: ticketData.assignee || null,
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
        assignee: ticketProperties.assignee,
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
    if (conversationMessages.length > 0 && !querySnapshot.empty) {
        const lastMessage = conversationMessages[conversationMessages.length - 1];
        const ticketDocRef = querySnapshot.docs[0].ref;
        await updateDoc(ticketDocRef, {
            bodyPreview: lastMessage.bodyPreview,
            receivedDateTime: lastMessage.receivedDateTime,
        });
    }
    
    // Invalidate caches to ensure the UI updates
    if (ticketId) {
        ticketsCache.invalidate(`conversation:${organizationId}:${conversationId}`);
        ticketsCache.invalidate(`ticket:${organizationId}:${ticketId}`);
    }


    return conversationMessages;
}


export async function getEmail(organizationId: string, id: string): Promise<DetailedEmail | null> {
    if (!organizationId || !id) {
        throw new Error("Organization ID and Ticket ID must be provided.");
    }
    
    const cacheKey = `ticket:${organizationId}:${id}`;
    const cachedEmail = ticketsCache.get(cacheKey);
    if (cachedEmail) return cachedEmail;


    const ticketDocRef = doc(db, 'organizations', organizationId, 'tickets', id);
    const ticketDocSnap = await getDoc(ticketDocRef);

    if (!ticketDocSnap.exists()) {
        return null;
    }
    const ticketData = ticketDocSnap.data();
    const conversationId = ticketData.conversationId;

    let conversationMessages: DetailedEmail[] = [];
    if (conversationId) {
        const conversationCacheKey = `conversation:${organizationId}:${conversationId}`;
        const cachedConversation = ticketsCache.get(conversationCacheKey);
        if (cachedConversation) {
            conversationMessages = cachedConversation;
        } else {
            const conversationDocRef = doc(db, 'organizations', organizationId, 'conversations', conversationId);
            const conversationDoc = await getDoc(conversationDocRef);
            if (conversationDoc.exists() && conversationDoc.data().messages) {
                conversationMessages = conversationDoc.data().messages as DetailedEmail[];
                ticketsCache.set(conversationCacheKey, conversationMessages);
            }
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
            assignee: ticketData.assignee,
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
        assignee: ticketData.assignee,
        body: firstMessage.body || { contentType: 'html', content: ticketData.bodyPreview || '<p>Full email content is not available yet.</p>' },
        // The conversation array is the thread of messages.
        conversation: conversationMessages.map(convMsg => ({
            ...convMsg,
            priority: ticketData.priority || 'Low',
            status: ticketData.status || 'Open',
            type: ticketData.type || 'Incident',
        })),
    };
    
    ticketsCache.set(cacheKey, mainEmailDetails);
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

export async function sendEmailAction(organizationId: string, emailData: {recipient: string, subject: string, body: string, cc?: string, bcc?: string}): Promise<{ success: boolean }> {
    const settings = await getAPISettings(organizationId);
    if (!settings) {
        throw new Error('Failed to acquire access token. Check your API settings.');
    }
    
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
    organizationId: string,
    ticketId: string,
    messageId: string,
    comment: string,
    conversationId: string | undefined,
    attachments: NewAttachment[],
    currentUser: { name: string; email: string; isClient: boolean },
    to: string,
    cc: string | undefined,
    bcc: string | undefined
): Promise<{ success: boolean }> {
    const settings = await getAPISettings(organizationId);
    if (!settings) {
        throw new Error('Failed to acquire access token. Check your API settings.');
    }
    
    const authResponse = await getAccessToken(settings);
    if (!authResponse?.accessToken) {
        throw new Error('Failed to acquire access token. Check your API settings.');
    }

    const finalPayload = {
        comment: `Replied by ${currentUser.name}:<br><br>${comment}`,
        message: {
            toRecipients: parseRecipients(to), // 'to' is now part of the payload
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
    
    // Use replyAll endpoint to handle 'to', 'cc', and 'bcc' properly.
    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${settings.userId}/messages/${messageId}/replyAll`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${authResponse.accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalPayload),
    });

    if (response.status !== 202) { // Graph API returns 202 Accepted on success
        const errorText = await response.text();
        console.error("Failed to send reply. Status:", response.status, "Body:", errorText);
        try {
            const error = JSON.parse(errorText);
            throw new Error(`Failed to send reply: ${error.error?.message || response.statusText}`);
        } catch (e) {
            throw new Error(`Failed to send reply: ${response.statusText} - ${errorText}`);
        }
    }

    if (conversationId) {
        // Optimistically add the sent message to the Firestore conversation
        const conversationDocRef = doc(db, 'organizations', organizationId, 'conversations', conversationId);
        const optimisticReply: Partial<DetailedEmail> = {
            id: `optimistic-${Date.now()}`,
            sender: currentUser.name,
            senderEmail: currentUser.email,
            body: { contentType: 'html', content: comment },
            receivedDateTime: new Date().toISOString(),
            bodyPreview: comment.substring(0, 255),
            toRecipients: parseRecipients(to),
            ccRecipients: parseRecipients(cc),
            bccRecipients: parseRecipients(bcc),
            attachments: attachments.map(a => ({...a, id: `optimistic-att-${Date.now()}`, size: 0 })),
        };

        try {
            await updateDoc(conversationDocRef, {
                messages: arrayUnion(optimisticReply)
            });
        } catch (e) {
            console.error("Failed to add optimistic reply to conversation:", e);
        }

        // Schedule a background sync to get the real data from the mail server
        setTimeout(() => {
            fetchAndStoreFullConversation(organizationId, conversationId).catch(console.error);
        }, 10000); // 10-second delay to allow Graph API to process
    }
    
    // Invalidate caches to ensure next hard-refresh gets new data
    ticketsCache.invalidate(`conversation:${organizationId}:${conversationId}`);
    ticketsCache.invalidate(`ticket:${organizationId}:${ticketId}`);

    return { success: true };
}


export async function forwardEmailAction(
    organizationId: string,
    ticketId: string,
    messageId: string,
    comment: string,
    to: string,
    cc: string | undefined,
    bcc: string | undefined,
    currentUser: { name: string; email: string },
    ticketNumber: number,
    ticketSubject: string
): Promise<{ success: boolean }> {
    const settings = await getAPISettings(organizationId);
    if (!settings) {
        throw new Error('Failed to acquire access token. Check your API settings.');
    }
    
    const authResponse = await getAccessToken(settings);
    if (!authResponse?.accessToken) {
        throw new Error('Failed to acquire access token. Check your API settings.');
    }

    const toRecipients = parseRecipients(to);
    if (toRecipients.length === 0) {
        throw new Error("Forward recipient is required.");
    }
    
    const forwardPayload = {
        comment: `Forwarded by ${currentUser.name}:<br><br>${comment}`,
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
        user: currentUser.email,
    });
    
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
    
    // Invalidate company-specific employee cache
    companiesCache.invalidate(`employees:${organizationId}:${companyId}`);
}

export async function getCompanyEmployees(organizationId: string, companyId: string): Promise<Employee[]> {
    if (!organizationId || !companyId) return [];

    const cacheKey = `employees:${organizationId}:${companyId}`;
    const cachedEmployees = companiesCache.get(cacheKey);
    if (cachedEmployees) return cachedEmployees;

    const employeesCollectionRef = collection(db, 'organizations', organizationId, 'companies', companyId, 'employees');
    const snapshot = await getDocs(query(employeesCollectionRef, orderBy('name')));
    const employees = snapshot.docs.map(doc => ({
        ...doc.data(),
        email: doc.id
    }) as Employee);
    
    companiesCache.set(cacheKey, employees);
    return employees;
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

    // Invalidate company-specific employee cache
    companiesCache.invalidate(`employees:${organizationId}:${companyId}`);
    
    return { success: true };
}

export async function deleteCompanyEmployee(organizationId: string, companyId: string, email: string) {
    if (!organizationId || !companyId || !email) {
        throw new Error("Missing required parameters to delete employee.");
    }

    const employeeDocRef = doc(db, 'organizations', organizationId, 'companies', companyId, 'employees', email);
    await deleteDoc(employeeDocRef);

    companiesCache.invalidate(`employees:${organizationId}:${companyId}`);

    return { success: true };
}



export async function updateTicket(
    organizationId: string,
    id: string,
    data: {
        priority?: string;
        status?: string;
        type?: string;
        deadline?: string | null;
        tags?: string[];
        closedAt?: string | null;
        companyId?: string | null;
        assignee?: string | null;
    },
    currentUser: { name: string; email: string }
) {
    const ticketDocRef = doc(db, 'organizations', organizationId, 'tickets', id);
    try {
        let ticketData: any;
        let originalStatus: string;
        let originalAssignee: string | null;
        
        await runTransaction(db, async (transaction) => {
            const ticketDoc = await transaction.get(ticketDocRef);
            if (!ticketDoc.exists()) {
                throw new Error("Ticket not found!");
            }
            
            ticketData = ticketDoc.data();
            originalStatus = ticketData.status;
            originalAssignee = ticketData.assignee || null;

            const updateData: any = { ...data };

            if (data.status && (data.status === 'Resolved' || data.status === 'Closed')) {
                if(originalStatus !== 'Resolved' && originalStatus !== 'Closed') {
                    updateData.closedAt = new Date().toISOString();
                }
                if (ticketData.deadline && isPast(parseISO(ticketData.deadline))) {
                    updateData.tags = arrayUnion('Resolved Late');
                }
            }
            
            if (data.status && (data.status === 'Open' || data.status === 'Pending')) {
                updateData.closedAt = null;
                updateData.tags = arrayRemove('Resolved Late');
            }

            transaction.update(ticketDocRef, updateData);
        });

        // --- Post-transaction actions (like sending emails) ---
        const settings = await getAPISettings(organizationId);
        if (data.status && (data.status === 'Resolved' || data.status === 'Closed') && originalStatus !== data.status) {
            if (settings && ticketData.senderEmail && ticketData.ticketNumber) {
                const members = await getOrganizationMembers(organizationId);
                const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
                const ownerUid = orgDoc.data()?.owner;

                const owner = members.find(m => m.uid === ownerUid);
                const assignedAgent = members.find(m => m.uid === (data.assignee || ticketData.assignee));
                
                const detailedTicket = await getEmail(organizationId, id);
                const emailParticipants = new Set<string>();

                if (detailedTicket?.conversation) {
                    detailedTicket.conversation.forEach(message => {
                        if (message.senderEmail) emailParticipants.add(message.senderEmail.toLowerCase());
                        message.toRecipients?.forEach(r => emailParticipants.add(r.emailAddress.address.toLowerCase()));
                        message.ccRecipients?.forEach(r => emailParticipants.add(r.emailAddress.address.toLowerCase()));
                    });
                }
                
                // Add owner and agent emails to the participants set
                if (owner?.email) emailParticipants.add(owner.email.toLowerCase());
                if (assignedAgent?.email) emailParticipants.add(assignedAgent.email.toLowerCase());

                // Remove the primary client from the participants set to avoid them being in CC
                emailParticipants.delete(ticketData.senderEmail.toLowerCase());
                
                const ccRecipients = Array.from(emailParticipants);

                const notificationSubject = `Update on Ticket #${ticketData.ticketNumber}: ${ticketData.title}`;
                const notificationBody = `
                    <p>Hello,</p>
                    <p>Your ticket #${ticketData.ticketNumber} with the subject "${ticketData.title}" has been marked as <b>${data.status}</b> by ${currentUser.name}.</p>
                    <br>
                    <p>If you have any further questions, please reply to this ticket by responding to any email in this thread.</p>
                    <br>
                    <p>This is a notification-only message.</p>
                `;

                try {
                    await sendEmailAction(organizationId, {
                        recipient: ticketData.senderEmail,
                        cc: ccRecipients.join(','),
                        subject: notificationSubject,
                        body: notificationBody,
                    });
                } catch (e) {
                    console.error(`Failed to send resolution notification for ticket ${id}:`, e);
                }
            }
        }
        
        if (data.assignee && data.assignee !== originalAssignee) {
             if (settings && ticketData.ticketNumber) {
                const members = await getOrganizationMembers(organizationId);
                const newAssignee = members.find(m => m.uid === data.assignee);
                if (newAssignee && newAssignee.email) {
                    
                    const headersList = headers();
                    const host = headersList.get('host') || '';
                    const protocol = headersList.get('x-forwarded-proto') || 'http';
                    const ticketUrl = `${protocol}://${host}/tickets/${id}`;
                    
                    const subject = `You've been assigned Ticket #${ticketData.ticketNumber}: ${ticketData.title}`;
                    const body = `
                        <p>Hello ${newAssignee.name},</p>
                        <p>You have been assigned a new ticket by ${currentUser.name}.</p>
                        <p><b>Ticket #${ticketData.ticketNumber}: ${ticketData.title}</b></p>
                        <p>You can view and respond to the ticket here: <a href="${ticketUrl}">${ticketUrl}</a></p>
                    `;
                    try {
                        await sendEmailAction(organizationId, {
                            recipient: newAssignee.email,
                            subject: subject,
                            body: body,
                        });
                    } catch(e) {
                         console.error(`Failed to send assignment notification to ${newAssignee.email}:`, e);
                    }
                }
             }
        }


        // Invalidate relevant caches
        ticketsCache.invalidate(`ticket:${organizationId}:${id}`);
        ticketsCache.invalidatePrefix(`tickets:${organizationId}`);
        activityCache.invalidatePrefix(`activity:${organizationId}`);

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

        // Invalidate caches
        ticketsCache.invalidatePrefix(`tickets:${organizationId}`);
        ticketIds.forEach(id => ticketsCache.invalidate(`ticket:${organizationId}:${id}`));

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

        // Invalidate caches
        ticketsCache.invalidatePrefix(`tickets:${organizationId}`);
        ticketIds.forEach(id => ticketsCache.invalidate(`ticket:${organizationId}:${id}`));

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

        // Invalidate activity log caches
        activityCache.invalidate(`activity:${organizationId}:${ticketId}`);
        activityCache.invalidate(`all_activity:${organizationId}`);
        
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
    const cacheKey = `activity:${organizationId}:${ticketId}`;
    const cachedLogs = activityCache.get(cacheKey);
    if (cachedLogs) return cachedLogs;

    try {
        const activityCollectionRef = collection(db, 'organizations', organizationId, 'tickets', ticketId, 'activity');
        const q = query(activityCollectionRef, orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);
        const logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));

        activityCache.set(cacheKey, logs);
        return logs;
    } catch (error) {
        console.error("Failed to get activity log:", error);
        return [];
    }
}

export async function addNoteToTicket(organizationId: string, ticketId: string, noteData: Omit<Note, 'id'>) {
    if (!organizationId || !ticketId) {
        throw new Error("Organization ID and Ticket ID are required.");
    }
    try {
        const notesCollectionRef = collection(db, 'organizations', organizationId, 'tickets', ticketId, 'notes');
        await addDoc(notesCollectionRef, noteData);
        
        // Log the action without the content
        await addActivityLog(organizationId, ticketId, {
            type: 'Note',
            details: 'created a note',
            date: noteData.date,
            user: noteData.user
        });

        // Invalidate note-related caches if any
        // For now, timeline is re-fetched on the client, so no server cache invalidation needed for notes.

        return { success: true };
    } catch (error) {
        console.error("Failed to add note:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, error: errorMessage };
    }
}

export async function getTicketNotes(organizationId: string, ticketId: string): Promise<Note[]> {
    if (!organizationId || !ticketId) {
        return [];
    }
    // Caching for notes can be added here if needed in the future
    try {
        const notesCollectionRef = collection(db, 'organizations', organizationId, 'tickets', ticketId, 'notes');
        const q = query(notesCollectionRef, orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
    } catch (error) {
        console.error("Failed to get ticket notes:", error);
        return [];
    }
}

export async function getAllActivityLogs(organizationId: string): Promise<ActivityLog[]> {
    if (!organizationId) {
        return [];
    }

    const cacheKey = `all_activity:${organizationId}`;
    const cachedLogs = activityCache.get(cacheKey);
    if (cachedLogs) return cachedLogs;

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
        
        const recentLogs = allLogs.slice(0, 20); // Limit to the 20 most recent activities
        activityCache.set(cacheKey, recentLogs);
        return recentLogs;
    } catch (error) {
        console.error("Failed to get all activity logs:", error);
        return [];
    }
}

export async function getCompanyActivityLogs(organizationId: string, companyId: string): Promise<ActivityLog[]> {
    if (!organizationId || !companyId) {
        return [];
    }

    const cacheKey = `company_activity:${organizationId}:${companyId}`;
    const cachedLogs = activityCache.get(cacheKey);
    if (cachedLogs) return cachedLogs;

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
        
        const recentLogs = allLogs.slice(0, 20); // Limit to the 20 most recent activities
        activityCache.set(cacheKey, recentLogs);
        return recentLogs;
    } catch (error) {
        console.error("Failed to get company activity logs:", error);
        return [];
    }
}


// --- Organization Actions ---

export async function createOrganization(name: string, domain: string, uid: string, userName: string, email: string) {
    const organizationRef = doc(collection(db, "organizations"));
    await setDoc(organizationRef, {
        name: name,
        domain: domain,
        owner: uid,
        members: [{ 
            name: userName, 
            email: email, 
            uid: uid, 
            address: '', 
            mobile: '', 
            landline: '', 
            status: 'Not Verified' 
        }],
        address: '',
        mobile: '',
        landline: '',
        website: '',
    });
    
    // Invalidate member cache for this new org
    membersCache.invalidate(`members:${organizationRef.id}`);

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
    
    const newMember: OrganizationMember = { 
        uid: null,
        name, 
        email, 
        address, 
        mobile, 
        landline,
        status: 'Uninvited'
    };

    await updateDoc(organizationRef, {
        members: arrayUnion(newMember)
    });
    
    // Invalidate members cache
    membersCache.invalidate(`members:${organizationId}`);

    return { success: true };
}

export async function getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
    if (!organizationId) return [];

    const cacheKey = `members:${organizationId}`;
    const cachedMembers = membersCache.get(cacheKey);
    if (cachedMembers) return cachedMembers;

    const organizationRef = doc(db, "organizations", organizationId);
    const orgDoc = await getDoc(organizationRef);

    if (!orgDoc.exists()) {
        return [];
    }
    
    const members = (orgDoc.data().members || []).map((m: any) => ({
        ...m,
        uid: m.uid || null, // Explicitly handle missing UID
    })) as OrganizationMember[];
    
    membersCache.set(cacheKey, members);
    return members;
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

    // Invalidate members cache
    membersCache.invalidate(`members:${organizationId}`);

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

    // Invalidate members cache
    membersCache.invalidate(`members:${organizationId}`);

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
    
    // Invalidate org-level caches
    membersCache.invalidate(`members:${organizationId}`);
    
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

    // Clear all caches related to this organization
    ticketsCache.invalidatePrefix(`tickets:${organizationId}`);
    companiesCache.invalidatePrefix(`companies:${organizationId}`);
    membersCache.invalidatePrefix(`members:${organizationId}`);
    activityCache.invalidatePrefix(`activity:${organizationId}`);
    
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

        // Invalidate company list caches
        companiesCache.invalidate(`companies:${organizationId}`);
        companiesCache.invalidate(`companies_with_counts:${organizationId}`);

        return { success: true, id: newCompanyRef.id };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, error: errorMessage };
    }
}

export async function getCompanies(organizationId: string): Promise<Company[]> {
    if (!organizationId) return [];

    const cacheKey = `companies:${organizationId}`;
    const cachedCompanies = companiesCache.get(cacheKey);
    if (cachedCompanies) return cachedCompanies;

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
    
    companiesCache.set(cacheKey, companies);
    return companies;
}

export async function getCompanyWithTicketAndEmployeeCount(organizationId: string): Promise<Company[]> {
    if (!organizationId) return [];

    const cacheKey = `companies_with_counts:${organizationId}`;
    const cachedData = companiesCache.get(cacheKey);
    if(cachedData) return cachedData;
    
    const companies = await getCompanies(organizationId);
    
    // Get ticket counts
    const ticketsCollectionRef = collection(db, 'organizations', organizationId, 'tickets');
    const ticketsSnapshot = await getDocs(ticketsCollectionRef);
    const ticketCounts = new Map<string, number>();
    const unresolvedTicketCounts = new Map<string, number>();

    ticketsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const companyId = data.companyId;
        const status = data.status;

        if (companyId) {
            ticketCounts.set(companyId, (ticketCounts.get(companyId) || 0) + 1);
            if (status === 'Open' || status === 'Pending') {
                unresolvedTicketCounts.set(companyId, (unresolvedTicketCounts.get(companyId) || 0) + 1);
            }
        }
    });

    // Get employee counts
    const companiesWithCounts = await Promise.all(companies.map(async (company) => {
        const employeesCollectionRef = collection(db, 'organizations', organizationId, 'companies', company.id, 'employees');
        const employeesSnapshot = await getDocs(employeesCollectionRef);
        return {
            ...company,
            ticketCount: ticketCounts.get(company.id) || 0,
            unresolvedTicketCount: unresolvedTicketCounts.get(company.id) || 0,
            employeeCount: employeesSnapshot.size,
        };
    }));

    companiesCache.set(cacheKey, companiesWithCounts);
    return companiesWithCounts;
}


export async function getCompanyDetails(organizationId: string, companyId: string): Promise<Company | null> {
    if (!organizationId || !companyId) return null;

    const cacheKey = `company_details:${organizationId}:${companyId}`;
    const cachedCompany = companiesCache.get(cacheKey);
    if(cachedCompany) return cachedCompany;

    const companyDocRef = doc(db, 'organizations', organizationId, 'companies', companyId);
    const companyDoc = await getDoc(companyDocRef);

    if (!companyDoc.exists()) {
        return null;
    }
    const data = companyDoc.data();
    const companyDetails = {
        id: companyDoc.id,
        name: data.name,
        address: data.address,
        mobile: data.mobile,
        landline: data.landline,
        website: data.website,
    };

    companiesCache.set(cacheKey, companyDetails);
    return companyDetails;
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

    // Invalidate company caches
    companiesCache.invalidate(`company_details:${organizationId}:${companyId}`);
    companiesCache.invalidate(`companies:${organizationId}`);
    companiesCache.invalidate(`companies_with_counts:${organizationId}`);

    return { success: true };
}
    
    
export async function checkTicketDeadlinesAndNotify(organizationId: string) {
    if (!organizationId) return;

    const settings = await getAPISettings(organizationId);
    if (!settings) {
        console.log("Skipping deadline checks: API credentials not configured.");
        return;
    }

    try {
        const now = new Date();
        const reminderTimeFrame = addHours(now, 24);

        const ticketsRef = collection(db, 'organizations', organizationId, 'tickets');
        const q = query(ticketsRef, 
            where('status', 'in', ['Open', 'Pending']),
            where('deadline', '!=', null)
        );

        const querySnapshot = await getDocs(q);
        const members = await getOrganizationMembers(organizationId);

        for (const ticketDoc of querySnapshot.docs) {
            const ticket = ticketDoc.data() as Email;
            const ticketDeadline = parseISO(ticket.deadline!);

            const isApproaching = isWithinInterval(ticketDeadline, { start: now, end: reminderTimeFrame });
            const hasBeenNotified = ticket.tags?.includes('deadline-reminder-sent');

            if (isApproaching && !hasBeenNotified && ticket.assignee) {
                const assignee = members.find(m => m.uid === ticket.assignee);
                if (assignee?.email) {
                    const headersList = headers();
                    const host = headersList.get('host') || '';
                    const protocol = headersList.get('x-forwarded-proto') || 'http';
                    const ticketUrl = `${protocol}://${host}/tickets/${ticket.id}`;
                    
                    const subject = `Reminder: Ticket #${ticket.ticketNumber} is due soon`;
                    const body = `
                        <p>Hello ${assignee.name},</p>
                        <p>This is a reminder that the following ticket is approaching its deadline:</p>
                        <p><b>Ticket #${ticket.ticketNumber}: ${ticket.subject}</b></p>
                        <p><b>Deadline:</b> ${new Date(ticket.deadline!).toLocaleString()}</p>
                        <p>You can view and respond to the ticket here: <a href="${ticketUrl}">${ticketUrl}</a></p>
                    `;

                    try {
                        await sendEmailAction(organizationId, {
                            recipient: assignee.email,
                            subject: subject,
                            body: body,
                        });

                        // Add a tag to prevent re-sending notifications
                        await updateDoc(ticketDoc.ref, {
                            tags: arrayUnion('deadline-reminder-sent')
                        });
                    } catch (e) {
                        console.error(`Failed to send deadline reminder for ticket ${ticket.id}:`, e);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Failed to check ticket deadlines:", error);
    }
}
    
export async function sendVerificationEmail(organizationId: string, recipientEmail: string, recipientName: string) {
    const settings = await getAPISettings(organizationId);
    if (!settings) {
        throw new Error("API settings are not configured to send emails.");
    }
    
    // --- Update the member's status to 'Invited' ---
    const organizationRef = doc(db, "organizations", organizationId);
    await runTransaction(db, async (transaction) => {
        const orgDoc = await transaction.get(organizationRef);
        if (!orgDoc.exists()) {
            throw new Error("Organization not found.");
        }

        const members = (orgDoc.data().members || []) as OrganizationMember[];
        const memberIndex = members.findIndex(m => m.email.toLowerCase() === recipientEmail.toLowerCase());

        if (memberIndex === -1) {
            throw new Error("Member not found in the organization.");
        }
        
        // Update the status for the specific member
        members[memberIndex].status = 'Invited';

        transaction.update(organizationRef, { members: members });
    });

    // Invalidate cache to reflect the change immediately in the UI
    membersCache.invalidate(`members:${organizationId}`);
    // --- End of update logic ---


    const headersList = headers();
    const host = headersList.get('host') || '';
    const protocol = headersList.get('x-forwarded-proto') || 'http';
    const signupUrl = `${protocol}://${host}/member-signup`;

    const subject = "You've been invited to join your team's ticketing system";
    const body = `
        <p>Hello ${recipientName},</p>
        <p>You have been invited to join your organization's support ticketing system.</p>
        <p>Please complete your registration by visiting the following link:</p>
        <p><a href="${signupUrl}">${signupUrl}</a></p>
        <p>Once registered, you will be able to access and manage support tickets.</p>
    `;

    await sendEmailAction(organizationId, {
        recipient: recipientEmail,
        subject: subject,
        body: body,
    });

    return { success: true };
}
    
// --- Verification and Domain Creation ---

// 1. Authenticate Graph Client
function getGraphClient() {
    const credential = new ClientSecretCredential(
        process.env.AZURE_TENANT_ID!,
        process.env.AZURE_CLIENT_ID!,
        process.env.AZURE_CLIENT_SECRET!
    );

    return Client.initWithMiddleware({
        authProvider: {
            getAccessToken: async () => {
                const token = await credential.getToken("https://graph.microsoft.com/.default");
                return token!.token;
            },
        },
    });
}

// 2. Azure AD Domain Functions
async function addDomain(client: Client, domain: string) {
  console.log(`Adding domain ${domain}...`);
  const result = await client.api("/domains").post({ id: domain });
  await new Promise(r => setTimeout(r, 5000));
  return result;
}

async function getDomain(client: Client, domain: string) {
  const result = await client.api(`/domains/${domain}`).get();
  await new Promise(r => setTimeout(r, 3000));
  return result;
}

async function getDomainVerificationRecords(client: Client, domain: string) {
  const result = await client.api(`/domains/${domain}/verificationDnsRecords`).get();
  await new Promise(r => setTimeout(r, 3000));
  return result.value;
}

async function getDomainServiceRecords(client: Client, domain: string) {
  const result = await client.api(`/domains/${domain}/serviceConfigurationRecords`).get();
  await new Promise(r => setTimeout(r, 3000));
  return result.value;
}

async function verifyDomain(client: Client, domain: string) {
  console.log(`Verifying domain ${domain}...`);
  const result = await client.api(`/domains/${domain}/verify`).post({});
  await new Promise(r => setTimeout(r, 3000));
  return result;
}


async function createGraphUser(client: Client, displayName: string, username: string, newDomain: string, password: string): Promise<any> {
    console.log(`Creating user ${username}@${newDomain} in Microsoft 365...`);
    const user = {
        accountEnabled: true,
        displayName: displayName,
        mailNickname: username,
        usageLocation: 'US',
        userPrincipalName: `${username}@${newDomain}`,
        passwordProfile: {
            forceChangePasswordNextSignIn: false,
            password: password,
        },
    };
    return client.api('/users').post(user);
}

async function assignLicenseToUser(client: Client, userId: string): Promise<any> {
    console.log(`Assigning license to user ${userId}...`);

    // First, find an available SKU (license plan)
    const subscribedSkus = await client.api('/subscribedSkus').get();
    const businessBasicSku = subscribedSkus.value.find((sku: any) => sku.skuPartNumber === 'O365_BUSINESS_ESSENTIALS');
    
    if (!businessBasicSku || !businessBasicSku.skuId) {
        throw new Error("Could not find a suitable Microsoft 365 Business Basic license (SKU) to assign.");
    }
    
    const license = {
        addLicenses: [
            {
                skuId: businessBasicSku.skuId,
                disabledPlans: [],
            },
        ],
        removeLicenses: [],
    };
    
    return client.api(`/users/${userId}/assignLicense`).post(license);
}

async function addUserToSecurityGroup(client: Client, userId: string, groupId: string): Promise<void> {
    console.log(`Adding user ${userId} to security group ${groupId}...`);
    
    const member = {
        '@odata.id': `https://graph.microsoft.com/v1.0/directoryObjects/${userId}`
    };

    await client.api(`/groups/${groupId}/members/$ref`).post(member);
}


// 3. Cloudflare DNS Functions
async function recordExistsInCloudflare(type: string, name: string) {
    const url = `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/dns_records?type=${type}&name=${name}`;
    const headers = {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
    };
    const response = await axios.get(url, { headers });
    return response.data.result.length > 0;
}

async function addDnsRecordToCloudflare(
  type: string,
  cfName: string,
  content?: string,
  priority?: number,
  data?: any
) {
  if (await recordExistsInCloudflare(type, cfName)) {
    console.log(`⚠️ Record already exists: [${type}] ${cfName}. Skipping.`);
    return;
  }

  const url = `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/dns_records`;
  const payload: any = { type, name: cfName, ttl: 3600 };
  if (data) {
    payload.data = data;
  } else {
    payload.content = content;
  }
  if (priority !== undefined) {
    payload.priority = priority;
  }

  const headers = {
    Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
    "Content-Type": "application/json",
  };

  console.log(`➡️ Adding DNS record to Cloudflare: [${type}] ${cfName} = ${content || JSON.stringify(data)}`);

  try {
    const response = await axios.post(url, payload, { headers });
    console.log("✅ Cloudflare response:", response.data);
    await new Promise(r => setTimeout(r, 2000));
    return response;
  } catch (err: any) {
    if (err.response) {
      console.error("❌ Cloudflare error:", err.response.status, err.response.data);
    } else if (err.request) {
      console.error("❌ No response from Cloudflare:", err.request);
    } else {
      console.error("❌ Axios error:", err.message);
    }
    throw err;
  }
}

// 4. DNS Propagation Polling
async function pollDnsPropagation(domain: string, expectedTxt: string) {
    dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
    console.log("Using DNS servers for polling:", dns.getServers());

    const maxAttempts = 60;
    let attempt = 0;
    let resolved = false;

    while (!resolved && attempt < maxAttempts) {
        attempt++;
        try {
            const txtRecords = await dns.promises.resolveTxt(domain);
            const flattened = txtRecords.map(rec => rec.join(" ").trim());
            console.log(`Attempt ${attempt}: Current TXT records for ${domain}:`, flattened);
            if (flattened.includes(expectedTxt.trim())) {
                resolved = true;
                console.log("✅ DNS propagated successfully!");
            } else {
                console.log(`⏳ TXT record not found yet. Expected: ${expectedTxt}`);
                await new Promise(r => setTimeout(r, 10000));
            }
        } catch (err: any) {
            console.log(`Attempt ${attempt}: DNS resolution error for ${domain}:`, err.message);
            console.log("⏳ Waiting for DNS propagation...");
            await new Promise(r => setTimeout(r, 10000));
        }
    }

    if (!resolved) {
        throw new Error(`❌ DNS propagation timeout after ${maxAttempts} attempts. Check manually.`);
    }
}


export async function verifyUserEmail(
    organizationId: string,
    userId: string,
    username: string,
    displayName: string,
    password: string
) {
    // 1. Get organization details and check permissions
    const orgRef = doc(db, "organizations", organizationId);
    const orgDoc = await getDoc(orgRef);
    if (!orgDoc.exists()) {
        throw new Error("Organization not found.");
    }
    const orgData = orgDoc.data();
    const isOwner = orgData.owner === userId;

    // 2. Initialize Graph Client
    const client = getGraphClient();
    let newDomain = orgData.newDomain;

    // 3. Create and verify domain (if owner and not already created)
    if (isOwner && !newDomain) {
        const orgDomainName = orgData.domain.split('.')[0];
        newDomain = `${orgDomainName}.${process.env.NEXT_PUBLIC_PARENT_DOMAIN}`;
        
        // Step 1: Add domain in Azure AD
        await addDomain(client, newDomain);

        // Step 2: Check domain status
        const domainInfo = await getDomain(client, newDomain);
        console.log("Domain info:", JSON.stringify(domainInfo, null, 2));
        
        if (domainInfo.isVerified) {
            console.log("✅ Domain is already verified. Skipping verification step.");
        } else {
            // Step 3: Add verification TXT records
            const verificationRecords = await getDomainVerificationRecords(client, newDomain);
            let msTxtValue = "";
            for (const record of verificationRecords) {
                if (record.recordType.toLowerCase() === "txt" && record.text.startsWith("MS=")) {
                    msTxtValue = record.text;
                    await addDnsRecordToCloudflare("TXT", newDomain, `"${record.text}"`);
                    await pollDnsPropagation(newDomain, msTxtValue);
                    break; 
                }
            }

            // Step 4: Verify domain
            let verified = false;
            let verifyAttempts = 0;
            const maxVerifyAttempts = 10;
            while (!verified && verifyAttempts < maxVerifyAttempts) {
                verifyAttempts++;
                try {
                    await verifyDomain(client, newDomain);
                    const updatedDomainInfo = await getDomain(client, newDomain);
                    if (updatedDomainInfo.isVerified) {
                        console.log("✅ Domain verified successfully!");
                        verified = true;
                    } else {
                         throw new Error("Verification API call succeeded but domain is still not verified.");
                    }
                } catch (err: any) {
                    console.error(`Attempt ${verifyAttempts}: Verification failed:`, err.message);
                    console.log("⏳ Waiting for verification...");
                    await new Promise(res => setTimeout(res, 30000));
                }
            }
            if (!verified) {
                throw new Error(`❌ Domain verification timeout after ${maxVerifyAttempts} attempts.`);
            }
        }
        
        // Save the new domain to Firestore right after verification
        await updateDoc(orgRef, { newDomain: newDomain });
        console.log("Domain created and saved to Firestore.");
    }
    
    if (!newDomain) {
        throw new Error("Organization domain has not been created by the admin yet.");
    }
    
    // 4. Create user in Microsoft 365
    const newUser = await createGraphUser(client, displayName, username, newDomain, password);
    
    // 5. Assign a license to the new user
    await assignLicenseToUser(client, newUser.id);
    
    // 6. Add user to security group
    const securityGroupId = process.env.AZURE_SECURITY_OBJECT_ID;
    if (securityGroupId) {
        await addUserToSecurityGroup(client, newUser.id, securityGroupId);
        console.log(`User ${newUser.id} added to security group ${securityGroupId}.`);
    } else {
        console.warn("AZURE_SECURITY_OBJECT_ID environment variable not set. Skipping adding user to security group.");
    }
    
    // 7. Add DNS Records for Email
    console.log("Adding essential DNS records for email...");
    const serviceRecords = await getDomainServiceRecords(client, newDomain);
    for (const rec of serviceRecords) {
        switch (rec.recordType.toLowerCase()) {
            case "mx":
                await addDnsRecordToCloudflare("MX", newDomain, rec.mailExchange, rec.preference);
                break;
            case "cname":
                if (rec.label === 'autodiscover') {
                    await addDnsRecordToCloudflare("CNAME", rec.label, 'autodiscover.outlook.com');
                }
                break;
            case "txt":
                if (rec.text.toLowerCase().startsWith("v=spf")) {
                    await addDnsRecordToCloudflare("TXT", newDomain, `"${rec.text}"`);
                }
                break;
        }
    }


    // 8. Update user status in Firestore
    const members = orgData.members as OrganizationMember[];
    const memberIndex = members.findIndex(m => m.uid === userId);
    if (memberIndex === -1) {
        throw new Error("User not found in organization members list.");
    }
    members[memberIndex].status = 'Verified';
    members[memberIndex].email = `${username}@${newDomain}`; // Update their primary email
    
    await updateDoc(orgRef, { members });
    
    console.log("User status updated to 'Verified' in Firestore.");

    return { success: true };
}
    

    

    










    

    

    

    

    




    

    

      


    

    

    

    

    

    

    

  

    

    

    






    

    

    

    

    

    

    


    

