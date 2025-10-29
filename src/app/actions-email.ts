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

    // Check if this is a portal-created ticket (conversationId starts with "manual-")
    const isPortalTicket = conversationId?.startsWith('manual-');
    
    // For portal tickets, we need to send as a new email (not a reply) since there's no original email to reply to
    if (isPortalTicket) {
        const { prisma } = await import('@/lib/prisma');
        
        // Get the ticket to find the subject
        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            select: { subject: true, conversationId: true },
        });
        
        if (!ticket) {
            return { success: false, error: 'Ticket not found.' };
        }
        
        // Send as a new email with "Re:" prefix
        const subject = `Re: ${ticket.subject}`;
        
        try {
            // Send the email using sendMail endpoint instead of reply
            const url = `https://graph.microsoft.com/v1.0/users/${settings.userId}/sendMail`;
            const headers = {
                Authorization: `Bearer ${settings.accessToken}`,
                'Content-Type': 'application/json',
            };
            
            const adminEmail = settings.userId.toLowerCase();
            
            const message: any = {
                subject: subject,
                body: {
                    contentType: 'HTML',
                    content: replyBody,
                },
                toRecipients: toRecipient
                    .split(',')
                    .map((email: string) => email.trim())
                    .filter((email: string) => email && email.toLowerCase() !== adminEmail)
                    .map((email: string) => ({
                        emailAddress: { address: email }
                    })),
            };
            
            if (ccRecipients) {
                message.ccRecipients = ccRecipients
                    .split(',')
                    .map((email: string) => email.trim())
                    .filter((email: string) => email && email.toLowerCase() !== adminEmail)
                    .map((email: string) => ({
                        emailAddress: { address: email }
                    }));
            }
            
            if (bccRecipients) {
                message.bccRecipients = bccRecipients
                    .split(',')
                    .map((email: string) => email.trim())
                    .filter((email: string) => email && email.toLowerCase() !== adminEmail)
                    .map((email: string) => ({
                        emailAddress: { address: email }
                    }));
            }
            
            if (attachments && attachments.length > 0) {
                message.attachments = attachments.map(att => ({
                    '@odata.type': '#microsoft.graph.fileAttachment',
                    name: att.name,
                    contentType: att.contentType,
                    contentBytes: att.contentBytes,
                }));
            }
            
            await axios.post(url, { message, saveToSentItems: true }, { headers });
            
            // Wait longer for email to be processed
            console.log(`[Portal Ticket Reply] Waiting 5 seconds for email to be processed...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Fetch the reply back from Sent Items to get real message ID and attachment IDs
            let realMessageId = `reply-${Date.now()}`;
            let realAttachments: any[] = [];
            
            try {
                const { Client } = await import('@microsoft/microsoft-graph-client');
                const client = Client.init({
                    authProvider: (done: any) => {
                        done(null, settings.accessToken);
                    },
                });
                
                console.log(`[Portal Ticket Reply] Searching for reply with subject: "${subject}"`);
                const response = await client
                    .api(`/users/${settings.userId}/mailFolders/SentItems/messages`)
                    .filter(`sentDateTime ge ${new Date(Date.now() - 15000).toISOString()}`)
                    .top(10)
                    .select('id,subject,sentDateTime')
                    .orderby('sentDateTime desc')
                    .get();
                
                console.log(`[Portal Ticket Reply] Found ${response.value?.length || 0} recent emails in Sent Items`);
                if (response.value && response.value.length > 0) {
                    console.log(`[Portal Ticket Reply] Recent email subjects:`, response.value.map((m: any) => m.subject));
                }
                
                const matchingReply = response.value?.find((msg: any) => msg.subject === subject);
                
                if (matchingReply) {
                    realMessageId = matchingReply.id;
                    console.log(`[Portal Ticket Reply] Found reply - Message ID: ${realMessageId}`);
                    
                    // Fetch full message with attachments
                    const fullMessage = await client
                        .api(`/users/${settings.userId}/messages/${realMessageId}`)
                        .expand('attachments')
                        .get();
                    
                    if (fullMessage.attachments && fullMessage.attachments.length > 0) {
                        console.log(`[Portal Ticket Reply] Fetched ${fullMessage.attachments.length} real attachments from Microsoft Graph`);
                        realAttachments = fullMessage.attachments.map((att: any) => {
                            console.log(`[Portal Ticket Reply] Real attachment - ID: ${att.id}, Name: ${att.name}`);
                            return {
                                id: att.id,
                                name: att.name,
                                contentType: att.contentType,
                                size: att.size,
                                isInline: att.isInline || false,
                                contentId: att.contentId || null,
                            };
                        });
                        console.log(`[Portal Ticket Reply] ✓ Successfully mapped ${realAttachments.length} attachments with real IDs`);
                    } else {
                        console.log(`[Portal Ticket Reply] No attachments found in Microsoft Graph`);
                    }
                }
            } catch (fetchError) {
                console.error('[Portal Ticket] Failed to fetch reply from Sent Items:', fetchError);
                // Continue with temporary IDs if fetch fails
            }
            
            // Store the reply in the conversation
            if (ticket.conversationId) {
                const conversation = await prisma.conversation.findUnique({
                    where: { id: ticket.conversationId },
                });
                
                if (conversation) {
                    const messages = (conversation.messages as any[]) || [];
                    
                    // Use real attachments if we fetched them, otherwise use temp IDs as fallback
                    const finalAttachments = realAttachments.length > 0 ? realAttachments : (attachments?.map(att => ({
                        id: `att-${Date.now()}-${Math.random()}`,
                        name: att.name,
                        contentType: att.contentType,
                        size: att.contentBytes ? Buffer.from(att.contentBytes, 'base64').length : 0,
                        isInline: false,
                    })) || []);
                    
                    console.log(`[Portal Ticket Reply] Storing message with ${finalAttachments.length} attachments`);
                    if (finalAttachments.length > 0) {
                        console.log(`[Portal Ticket Reply] First attachment ID: ${finalAttachments[0].id}`);
                    }
                    
                    const newMessage = {
                        id: realMessageId,
                        subject: subject,
                        sender: sender.name,
                        senderEmail: sender.email,
                        bodyPreview: replyBody.substring(0, 255).replace(/<[^>]*>/g, ''),
                        receivedDateTime: new Date().toISOString(),
                        body: {
                            contentType: 'html',
                            content: replyBody,
                        },
                        attachments: finalAttachments,
                        hasAttachments: finalAttachments.length > 0,
                        toRecipients: toRecipient.split(',').map((email: string) => ({
                            emailAddress: { address: email.trim() }
                        })),
                        ccRecipients: ccRecipients ? ccRecipients.split(',').map((email: string) => ({
                            emailAddress: { address: email.trim() }
                        })) : [],
                        isReply: true,
                        repliedBy: sender.name,
                    };
                    
                    messages.push(newMessage);
                    
                    await prisma.conversation.update({
                        where: { id: ticket.conversationId },
                        data: { messages: messages as any },
                    });
                    
                    console.log(`[Portal Ticket Reply] ✓ Stored reply in database with real attachment IDs for ticket ${ticketId}`);
                }
            }
            
            return { success: true };
        } catch (error: any) {
            console.error('[Portal Ticket] Error sending reply email:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    // For email-based tickets, use the normal reply endpoint
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
        
        console.log(`[Email Reply] Reply sent successfully`);
        
        // Wait for email to be processed
        console.log(`[Email Reply] Waiting 5 seconds for email to be processed...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Fetch the reply back from Sent Items to get real message ID and attachment IDs
        let realMessageId = `reply-${Date.now()}`;
        let realAttachments: any[] = [];
        
        try {
            const { Client } = await import('@microsoft/microsoft-graph-client');
            const client = Client.init({
                authProvider: (done: any) => {
                    done(null, settings.accessToken);
                },
            });
            
            const subject = `Re: ${conversationId}`;
            console.log(`[Email Reply] Searching for reply in Sent Items...`);
            const searchResponse = await client
                .api(`/users/${settings.userId}/mailFolders/SentItems/messages`)
                .filter(`sentDateTime ge ${new Date(Date.now() - 15000).toISOString()}`)
                .top(10)
                .select('id,subject,sentDateTime,conversationId')
                .orderby('sentDateTime desc')
                .get();
            
            console.log(`[Email Reply] Found ${searchResponse.value?.length || 0} recent emails in Sent Items`);
            
            // Find the matching reply by conversationId
            const matchingReply = searchResponse.value?.find((msg: any) => 
                msg.conversationId === conversationId
            );
            
            if (matchingReply) {
                realMessageId = matchingReply.id;
                console.log(`[Email Reply] Found reply - Message ID: ${realMessageId}`);
                
                // Fetch full message with attachments
                const fullMessage = await client
                    .api(`/users/${settings.userId}/messages/${realMessageId}`)
                    .expand('attachments')
                    .get();
                
                if (fullMessage.attachments && fullMessage.attachments.length > 0) {
                    console.log(`[Email Reply] Fetched ${fullMessage.attachments.length} real attachments from Microsoft Graph`);
                    realAttachments = fullMessage.attachments.map((att: any) => {
                        console.log(`[Email Reply] Real attachment - ID: ${att.id}, Name: ${att.name}`);
                        return {
                            id: att.id,
                            name: att.name,
                            contentType: att.contentType,
                            size: att.size,
                            isInline: att.isInline || false,
                            contentId: att.contentId || null,
                        };
                    });
                    console.log(`[Email Reply] ✓ Successfully mapped ${realAttachments.length} attachments with real IDs`);
                } else {
                    console.log(`[Email Reply] No attachments found in Microsoft Graph`);
                }
            } else {
                console.warn(`[Email Reply] Could not find reply in Sent Items`);
            }
        } catch (fetchError) {
            console.error('[Email Reply] Failed to fetch reply from Sent Items:', fetchError);
            // Continue with temporary IDs if fetch fails
        }
        
        // Store the reply in the database
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
                
                // Use real attachments if we fetched them, otherwise use temp IDs as fallback
                const finalAttachments = realAttachments.length > 0 ? realAttachments : (attachments?.map(att => ({
                    id: `att-${Date.now()}-${Math.random()}`,
                    name: att.name,
                    contentType: att.contentType,
                    size: att.contentBytes ? Buffer.from(att.contentBytes, 'base64').length : 0,
                    isInline: false,
                })) || []);
                
                console.log(`[Email Reply] Storing message with ${finalAttachments.length} attachments`);
                if (finalAttachments.length > 0) {
                    console.log(`[Email Reply] First attachment ID: ${finalAttachments[0].id}`);
                }
                
                // Create the new reply message object
                const newMessage = {
                    id: realMessageId,
                    subject: `Re: ${(messages[0] as any)?.subject || 'No Subject'}`,
                    sender: sender.name,
                    senderEmail: sender.email,
                    bodyPreview: replyBody.substring(0, 255).replace(/<[^>]*>/g, ''),
                    receivedDateTime: new Date().toISOString(),
                    body: {
                        contentType: 'html',
                        content: replyBody,
                    },
                    attachments: finalAttachments,
                    hasAttachments: finalAttachments.length > 0,
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
                
                console.log(`[Email Reply] ✓ Stored reply in database with real attachment IDs for ticket ${ticketId}`);
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
    comment: string,
    toRecipients: string,
    ccRecipients: string,
    bccRecipients: string,
    sender: { name: string; email: string },
    ticketNumber: number,
    subject: string
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
    
    // Split comma-separated emails and convert to array
    const toRecipientsArray = toRecipients
        .split(',')
        .map(email => email.trim())
        .filter(email => email && email.toLowerCase() !== adminEmail);
    
    const ccRecipientsArray = ccRecipients
        .split(',')
        .map(email => email.trim())
        .filter(email => email && email.toLowerCase() !== adminEmail);
    
    const bccRecipientsArray = bccRecipients
        .split(',')
        .map(email => email.trim())
        .filter(email => email && email.toLowerCase() !== adminEmail);
    
    const filteredRecipients = toRecipientsArray;

    const payload: any = {
        comment: comment || '',
        toRecipients: filteredRecipients.map(email => ({
            emailAddress: { address: email }
        })),
    };
    
    // Add CC recipients if present
    if (ccRecipientsArray.length > 0) {
        payload.ccRecipients = ccRecipientsArray.map(email => ({
            emailAddress: { address: email }
        }));
    }
    
    // Add BCC recipients if present
    if (bccRecipientsArray.length > 0) {
        payload.bccRecipients = bccRecipientsArray.map(email => ({
            emailAddress: { address: email }
        }));
    }

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
    // This function now delegates to syncEmailsToTickets in actions-new.ts
    const { syncEmailsToTickets } = await import('@/app/actions-new');
    await syncEmailsToTickets(organizationId, since);
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
