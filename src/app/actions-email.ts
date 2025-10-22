"use server";

// Email-related actions that use Microsoft Graph API
// These functions interact with Microsoft 365 for email operations

import {
    ConfidentialClientApplication,
    Configuration,
    AuthenticationResult,
} from '@azure/msal-node';
import { ClientSecretCredential } from "@azure/identity";
import axios from 'axios';
import type { NewAttachment, Recipient, DetailedEmail } from './actions-types';

interface Settings {
    accessToken: string;
    userId: string;
}

export async function getAPISettings(organizationId: string): Promise<Settings | null> {
    const clientId = process.env.AZURE_CLIENT_ID;
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;

    if (!clientId || !tenantId || !clientSecret) {
        console.log(`[${organizationId}] Missing Azure credentials in environment variables.`);
        return null;
    }

    // Get the organization's verified admin email from database
    const { prisma } = await import('@/lib/prisma');
    const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
    });

    if (!organization) {
        console.error(`Organization with ID ${organizationId} not found.`);
        return null;
    }

    // Get the owner's organization member record to get their verified email
    const ownerMember = await prisma.organizationMember.findFirst({
        where: {
            organizationId,
            userId: organization.ownerId,
        },
    });

    if (!ownerMember || !ownerMember.email) {
        console.error(`Owner member for organization ${organizationId} not found or has no email. Owner ID: ${organization.ownerId}`);
        return null;
    }

    const userId = ownerMember.email;
    console.log(`[${organizationId}] Using email: ${userId} for Microsoft Graph API`);

    const config: Configuration = {
        auth: {
            clientId,
            authority: `https://login.microsoftonline.com/${tenantId}`,
            clientSecret,
        },
    };

    const cca = new ConfidentialClientApplication(config);
    const tokenRequest = {
        scopes: ['https://graph.microsoft.com/.default'],
    };

    try {
        const response: AuthenticationResult | null = await cca.acquireTokenByClientCredential(tokenRequest);
        if (!response || !response.accessToken) {
            console.log(`[${organizationId}] Failed to acquire access token.`);
            return null;
        }

        return {
            accessToken: response.accessToken,
            userId,
        };
    } catch (error) {
        console.error(`[${organizationId}] Error acquiring token:`, error);
        return null;
    }
}

export async function sendEmailAction(
    organizationId: string,
    emailData: { 
        recipient: string, 
        subject: string, 
        body: string, 
        cc?: string, 
        bcc?: string, 
        attachments?: NewAttachment[],
        replyTo?: string 
    }
): Promise<{ success: boolean; error?: string }> {
    const settings = await getAPISettings(organizationId);
    if (!settings) {
        return { success: false, error: 'API credentials not configured.' };
    }

    const toRecipients = emailData.recipient.split(',').map(email => ({
        emailAddress: { address: email.trim() }
    }));

    const ccRecipients = emailData.cc ? emailData.cc.split(',').map(email => ({
        emailAddress: { address: email.trim() }
    })) : undefined;

    const bccRecipients = emailData.bcc ? emailData.bcc.split(',').map(email => ({
        emailAddress: { address: email.trim() }
    })) : undefined;

    const message: any = {
        subject: emailData.subject,
        body: {
            contentType: 'HTML',
            content: emailData.body,
        },
        toRecipients,
    };

    if (ccRecipients && ccRecipients.length > 0) {
        message.ccRecipients = ccRecipients;
    }

    if (bccRecipients && bccRecipients.length > 0) {
        message.bccRecipients = bccRecipients;
    }

    if (emailData.attachments && emailData.attachments.length > 0) {
        message.attachments = emailData.attachments.map(att => ({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: att.name,
            contentType: att.contentType,
            contentBytes: att.contentBytes,
        }));
    }

    const url = `https://graph.microsoft.com/v1.0/users/${settings.userId}/sendMail`;
    const headers = {
        Authorization: `Bearer ${settings.accessToken}`,
        'Content-Type': 'application/json',
    };

    try {
        await axios.post(url, { message, saveToSentItems: true }, { headers });
        return { success: true };
    } catch (error: any) {
        console.error('Error sending email:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

export async function replyToEmailAction(
    organizationId: string,
    ticketId: string,
    messageId: string,
    replyBody: string,
    conversationId: string | null | undefined,
    attachments: NewAttachment[] | undefined,
    sender: { name: string; email: string; isClient: boolean; status: string; isOwner: boolean },
    toRecipient: string,
    ccRecipients: string,
    bccRecipients: string
): Promise<{ success: boolean; error?: string }> {
    const settings = await getAPISettings(organizationId);
    if (!settings) {
        return { success: false, error: 'API credentials not configured.' };
    }

    const url = `https://graph.microsoft.com/v1.0/users/${settings.userId}/messages/${messageId}/reply`;

    const headers = {
        Authorization: `Bearer ${settings.accessToken}`,
        'Content-Type': 'application/json',
    };

    const payload: any = {};

    // Set the reply body as HTML in the message object to preserve quoted text
    payload.message = {
        body: {
            contentType: 'HTML',
            content: replyBody
        }
    };

    // Add To, CC, BCC recipients
    if (toRecipient || ccRecipients || bccRecipients) {
        
        // Admin email should never be in recipients
        const adminEmail = settings.userId.toLowerCase();
        
        if (toRecipient) {
            payload.message.toRecipients = toRecipient
                .split(',')
                .map((email: string) => email.trim())
                .filter((email: string) => email.toLowerCase() !== adminEmail)
                .map((email: string) => ({
                    emailAddress: { address: email }
                }));
        }
        
        if (ccRecipients) {
            payload.message.ccRecipients = ccRecipients
                .split(',')
                .map((email: string) => email.trim())
                .filter((email: string) => email.toLowerCase() !== adminEmail)
                .map((email: string) => ({
                    emailAddress: { address: email }
                }));
        }
        
        if (bccRecipients) {
            payload.message.bccRecipients = bccRecipients
                .split(',')
                .map((email: string) => email.trim())
                .filter((email: string) => email.toLowerCase() !== adminEmail)
                .map((email: string) => ({
                    emailAddress: { address: email }
                }));
        }
    }

    if (attachments && attachments.length > 0) {
        payload.message = payload.message || {};
        payload.message.attachments = attachments.map(att => ({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: att.name,
            contentType: att.contentType,
            contentBytes: att.contentBytes,
        }));
    }

    try {
        // Send the reply via Microsoft Graph API
        const response = await axios.post(url, payload, { headers });
        
        // Store the reply in the database immediately
        const { prisma } = await import('@/lib/prisma');
        
        // Get the ticket to find conversationId
        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            select: { conversationId: true },
        });
        
        if (ticket?.conversationId) {
            // Fetch current conversation
            const conversation = await prisma.conversation.findUnique({
                where: { id: ticket.conversationId },
            });
            
            if (conversation) {
                const messages = (conversation.messages as any[]) || [];
                
                // Create the new reply message object
                const newMessage = {
                    id: `reply-${Date.now()}`, // Temporary ID until email sync updates it
                    subject: `Re: ${(messages[0] as any)?.subject || 'No Subject'}`,
                    sender: sender.name,
                    senderEmail: sender.email,
                    bodyPreview: replyBody.substring(0, 255).replace(/<[^>]*>/g, ''),
                    receivedDateTime: new Date().toISOString(),
                    body: {
                        contentType: 'html',
                        content: replyBody,
                    },
                    attachments: attachments?.map(att => ({
                        id: `att-${Date.now()}-${Math.random()}`,
                        name: att.name,
                        contentType: att.contentType,
                        size: att.contentBytes ? Buffer.from(att.contentBytes, 'base64').length : 0,
                        isInline: false,
                    })) || [],
                    hasAttachments: attachments && attachments.length > 0,
                    toRecipients: toRecipient ? toRecipient.split(',').map((email: string) => ({
                        emailAddress: { address: email.trim() }
                    })) : [],
                    ccRecipients: ccRecipients ? ccRecipients.split(',').map((email: string) => ({
                        emailAddress: { address: email.trim() }
                    })) : [],
                    isReply: true, // Mark this as a reply to show badge
                    repliedBy: sender.name, // Store who replied
                };
                
                // Add the new message to the conversation
                messages.push(newMessage);
                
                // Update the conversation in the database
                await prisma.conversation.update({
                    where: { id: ticket.conversationId },
                    data: { messages: messages as any },
                });
                
                console.log(`Stored reply in database for ticket ${ticketId}`);
            }
        }
        
        return { success: true };
    } catch (error: any) {
        console.error('Error replying to email:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

export async function forwardEmailAction(
    organizationId: string,
    ticketId: string,
    messageId: string,
    toRecipients: string[],
    comment?: string
): Promise<{ success: boolean; error?: string }> {
    const settings = await getAPISettings(organizationId);
    if (!settings) {
        return { success: false, error: 'API credentials not configured.' };
    }

    const url = `https://graph.microsoft.com/v1.0/users/${settings.userId}/messages/${messageId}/forward`;
    const headers = {
        Authorization: `Bearer ${settings.accessToken}`,
        'Content-Type': 'application/json',
    };

    // Filter out admin email from forward recipients
    const adminEmail = settings.userId.toLowerCase();
    const filteredRecipients = toRecipients
        .map(email => email.trim())
        .filter(email => email.toLowerCase() !== adminEmail);

    const payload = {
        comment: comment || '',
        toRecipients: filteredRecipients.map(email => ({
            emailAddress: { address: email }
        })),
    };

    try {
        await axios.post(url, payload, { headers });
        return { success: true };
    } catch (error: any) {
        console.error('Error forwarding email:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

export async function getAttachmentContent(
    organizationId: string,
    messageId: string,
    attachmentId: string
): Promise<{contentBytes: string}> {
    const settings = await getAPISettings(organizationId);
    if (!settings) {
        throw new Error('Failed to get attachment: API credentials not configured.');
    }

    const url = `https://graph.microsoft.com/v1.0/users/${settings.userId}/messages/${messageId}/attachments/${attachmentId}`;
    const headers = {
        Authorization: `Bearer ${settings.accessToken}`,
    };

    try {
        const response = await axios.get(url, { headers });
        return { contentBytes: response.data.contentBytes };
    } catch (error: any) {
        console.error('Error fetching attachment:', error.response?.data || error.message);
        throw new Error('Failed to fetch attachment content.');
    }
}

export async function fetchAndStoreFullConversation(
    organizationId: string,
    conversationId: string
): Promise<DetailedEmail[]> {
    const settings = await getAPISettings(organizationId);
    if (!settings) {
        console.log("Skipping conversation fetch: API credentials not configured.");
        return [];
    }

    // This function would fetch the full conversation from Microsoft Graph
    // For now, returning empty array as it requires database integration
    console.log(`Fetching conversation ${conversationId} for org ${organizationId}`);
    return [];
}

export async function getLatestEmails(organizationId: string, since?: string): Promise<void> {
    const settings = await getAPISettings(organizationId);
    if (!settings) {
        console.log(`[${organizationId}] Skipping email sync: API credentials not configured.`);
        return;
    }

    // This function would sync emails from Microsoft 365
    // Implementation requires database integration
    console.log(`Syncing emails for org ${organizationId} since ${since}`);
}

export async function sendVerificationEmail(
    organizationId: string,
    recipientEmail: string,
    recipientName: string
): Promise<{ success: boolean; error?: string }> {
    const settings = await getAPISettings(organizationId);
    if (!settings) {
        return { success: false, error: 'API credentials not configured.' };
    }

    const parentDomain = process.env.NEXT_PUBLIC_PARENT_DOMAIN;
    const signupUrl = `https://${parentDomain}/member-signup`;

    const subject = "You've been invited to join your organization";
    const body = `
        <p>Hello ${recipientName},</p>
        <p>You have been invited to join your organization's support ticketing system.</p>
        <p>Please complete your registration by visiting the following link:</p>
        <p><a href="${signupUrl}">${signupUrl}</a></p>
        <p>Once registered, you will be able to manage and respond to support tickets.</p>
    `;

    const result = await sendEmailAction(organizationId, {
        recipient: recipientEmail,
        subject: subject,
        body: body,
    });

    // If email sent successfully, update member status to INVITED
    if (result.success) {
        const { prisma } = await import('@/lib/prisma');
        await prisma.organizationMember.updateMany({
            where: {
                organizationId,
                email: recipientEmail,
            },
            data: {
                status: 'INVITED',
            },
        });
        
        // Invalidate members cache so UI gets fresh data
        const { invalidateMembersCache } = await import('@/app/actions-new');
        await invalidateMembersCache(organizationId);
    }

    return result;
}
