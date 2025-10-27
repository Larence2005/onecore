"use server";

import {
    ConfidentialClientApplication,
    Configuration,
    AuthenticationResult,
} from '@azure/msal-node';
import { ClientSecretCredential } from "@azure/identity";
import { prisma } from '@/lib/prisma';
import { isPast, parseISO, isWithinInterval, addHours, differenceInSeconds, addDays, format, add, isAfter } from 'date-fns';
import { formatInTimeZone, toDate } from 'date-fns-tz';
import { headers } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import axios from 'axios';
import dns from "dns";
import { Client } from "@microsoft/microsoft-graph-client";
import { Prisma } from '@prisma/client';
import type { Email, Attachment, NewAttachment, ActivityLog, Recipient, Note, DetailedEmail } from '@/app/actions-types';

// Caches removed to save RAM - all data now fetched directly from database

// Re-export types from actions-types.ts for backward compatibility
export type { Email, Attachment, NewAttachment, ActivityLog, Recipient, Note, DetailedEmail } from '@/app/actions-types';

export interface OrganizationMember {
    uid: string | null;
    name: string;
    email: string;
    address?: string;
    mobile?: string;
    landline?: string;
    status: 'UNINVITED' | 'INVITED' | 'NOT_VERIFIED' | 'VERIFIED';
    isClient?: boolean;
}

export interface Company {
    id: string;
    name: string;
    ticketCount?: number;
    unresolvedTicketCount?: number;
    resolvedTicketCount?: number;
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
    status: 'UNINVITED' | 'INVITED' | 'NOT_VERIFIED' | 'VERIFIED';
    uid?: string;
}

interface Settings {
  clientId: string;
  tenantId: string;
  clientSecret: string;
  userId: string;
}

export interface DeadlineSettings {
    Urgent: number;
    High: number;
    Medium: number;
    Low: number;
}

// ============================================================================
// MIGRATED FUNCTIONS
// ============================================================================

export async function getAPISettings(organizationId: string): Promise<Settings | null> {
    const clientId = process.env.AZURE_CLIENT_ID;
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;
    
    if (!clientId || !tenantId || !clientSecret) {
        console.error("Azure API settings are not fully configured in environment variables.");
        return null;
    }

    // Get the organization
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

export async function getAccessToken(settings: Settings): Promise<string> {
    const msalConfig = getMsalConfig(settings);
    const cca = new ConfidentialClientApplication(msalConfig);

    const tokenRequest = {
        scopes: ['https://graph.microsoft.com/.default'],
    };

    try {
        const response: AuthenticationResult | null = await cca.acquireTokenByClientCredential(tokenRequest);
        if (response && response.accessToken) {
            return response.accessToken;
        } else {
            throw new Error('Failed to acquire access token.');
        }
    } catch (error) {
        console.error('Error acquiring access token:', error);
        throw error;
    }
}

// Email functions remain the same as they use Microsoft Graph API
export async function getLatestEmails(organizationId: string, maxResults: number = 50): Promise<Email[]> {
    const settings = await getAPISettings(organizationId);
    if (!settings) {
        throw new Error("API settings are not configured.");
    }

    const accessToken = await getAccessToken(settings);
    const userId = settings.userId;

    const client = Client.init({
        authProvider: (done: any) => {
            done(null, accessToken);
        },
    });

    try {
        const response = await client
            .api(`/users/${userId}/mailFolders/inbox/messages`)
            .top(maxResults)
            .select('id,subject,from,bodyPreview,receivedDateTime,conversationId')
            .orderby('receivedDateTime DESC')
            .get();

        const emails: Email[] = response.value.map((message: any) => ({
            id: message.id,
            subject: message.subject || '(No Subject)',
            sender: message.from?.emailAddress?.name || 'Unknown',
            senderEmail: message.from?.emailAddress?.address || '',
            bodyPreview: message.bodyPreview || '',
            receivedDateTime: message.receivedDateTime,
            priority: 'Medium',
            status: 'Open',
            type: 'Question',
            conversationId: message.conversationId,
        }));

        return emails;
    } catch (error) {
        console.error('Error fetching emails:', error);
        throw error;
    }
}

export async function getEmailDetails(organizationId: string, emailId: string): Promise<DetailedEmail | null> {
    const settings = await getAPISettings(organizationId);
    if (!settings) {
        throw new Error("API settings are not configured.");
    }

    const accessToken = await getAccessToken(settings);
    const userId = settings.userId;

    const client = Client.init({
        authProvider: (done: any) => {
            done(null, accessToken);
        },
    });

    try {
        const message = await client
            .api(`/users/${userId}/messages/${emailId}`)
            .select('id,subject,from,body,bodyPreview,receivedDateTime,conversationId,hasAttachments,toRecipients,ccRecipients,bccRecipients')
            .get();

        let attachments: Attachment[] = [];
        if (message.hasAttachments) {
            const attachmentsResponse = await client
                .api(`/users/${userId}/messages/${emailId}/attachments`)
                .get();
            attachments = attachmentsResponse.value.map((att: any) => ({
                id: att.id,
                name: att.name,
                contentType: att.contentType,
                size: att.size,
                isInline: att.isInline,
                contentId: att.contentId,
            }));
        }

        const detailedEmail: DetailedEmail = {
            id: message.id,
            subject: message.subject || '(No Subject)',
            sender: message.from?.emailAddress?.name || 'Unknown',
            senderEmail: message.from?.emailAddress?.address || '',
            bodyPreview: message.bodyPreview || '',
            receivedDateTime: message.receivedDateTime,
            priority: 'Medium',
            status: 'Open',
            type: 'Question',
            conversationId: message.conversationId,
            body: {
                contentType: message.body?.contentType || 'text',
                content: message.body?.content || '',
            },
            attachments,
            hasAttachments: message.hasAttachments,
            toRecipients: message.toRecipients,
            ccRecipients: message.ccRecipients,
            bccRecipients: message.bccRecipients,
        };

        return detailedEmail;
    } catch (error) {
        console.error('Error fetching email details:', error);
        return null;
    }
}

export async function sendEmailAction(
    organizationId: string,
    emailData: {
        recipient: string;
        subject: string;
        body: string;
        cc?: string[];
        bcc?: string[];
        attachments?: NewAttachment[];
        inReplyTo?: string;
    }
): Promise<{ success: boolean; error?: string }> {
    const settings = await getAPISettings(organizationId);
    if (!settings) {
        return { success: false, error: "API settings are not configured." };
    }

    const accessToken = await getAccessToken(settings);
    const userId = settings.userId;

    const client = Client.init({
        authProvider: (done: any) => {
            done(null, accessToken);
        },
    });

    const message: any = {
        subject: emailData.subject,
        body: {
            contentType: 'HTML',
            content: emailData.body,
        },
        toRecipients: [
            {
                emailAddress: {
                    address: emailData.recipient,
                },
            },
        ],
    };

    if (emailData.cc && emailData.cc.length > 0) {
        message.ccRecipients = emailData.cc.map(email => ({
            emailAddress: { address: email },
        }));
    }

    if (emailData.bcc && emailData.bcc.length > 0) {
        message.bccRecipients = emailData.bcc.map(email => ({
            emailAddress: { address: email },
        }));
    }

    if (emailData.attachments && emailData.attachments.length > 0) {
        message.attachments = emailData.attachments.map(att => ({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: att.name,
            contentBytes: att.contentBytes,
            contentType: att.contentType,
        }));
    }

    try {
        if (emailData.inReplyTo) {
            await client
                .api(`/users/${userId}/messages/${emailData.inReplyTo}/reply`)
                .post({
                    message,
                });
        } else {
            await client
                .api(`/users/${userId}/sendMail`)
                .post({
                    message,
                    saveToSentItems: true,
                });
        }

        return { success: true };
    } catch (error: any) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
}

// ============================================================================
// ORGANIZATION MANAGEMENT FUNCTIONS
// ============================================================================

export async function getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
    if (!organizationId) return [];

    const members = await prisma.organizationMember.findMany({
        where: { organizationId },
        select: {
            id: true,
            userId: true, // Need this to identify owner
            name: true,
            email: true,
            address: true,
            mobile: true,
            landline: true,
            status: true,
            isClient: true,
            user: {
                select: {
                    id: true,
                },
            },
        },
        orderBy: { name: 'asc' },
    });

    const formattedMembers: OrganizationMember[] = members.map((m: any) => ({
        uid: m.userId,
        name: m.name,
        email: m.email,
        address: m.address || undefined,
        mobile: m.mobile || undefined,
        landline: m.landline || undefined,
        status: m.status,
        isClient: m.isClient,
    }));

    return formattedMembers;
}

export async function addMemberToOrganization(
    organizationId: string,
    name: string,
    email: string,
    address: string,
    mobile: string,
    landline: string
) {
    if (!organizationId || !email || !name) {
        throw new Error("Organization ID, member name, and email are required.");
    }

    // Check if member with this email already exists
    const existingMember = await prisma.organizationMember.findFirst({
        where: {
            organizationId,
            email: email.toLowerCase(),
        },
    });

    if (existingMember) {
        throw new Error("A contact with this email already exists in your organization.");
    }

    await prisma.organizationMember.create({
        data: {
            organizationId,
            name,
            email: email.toLowerCase(),
            address: address || null,
            mobile: mobile || null,
            landline: landline || null,
            status: 'UNINVITED',
            isClient: false,
        },
    });

    return { success: true };
}

// Helper function to invalidate members cache (can be called from other files)
export async function invalidateMembersCache(organizationId: string): Promise<void> {
    // Cache removed - no action needed
}

export async function updateMemberInOrganization(
    organizationId: string,
    originalEmail: string,
    newName: string,
    newEmail: string,
    newAddress: string,
    newMobile: string,
    newLandline: string
) {
    if (!organizationId || !originalEmail || !newName || !newEmail) {
        throw new Error("All parameters are required for updating a member.");
    }

    // Find the member to update
    const memberToUpdate = await prisma.organizationMember.findFirst({
        where: {
            organizationId,
            email: originalEmail.toLowerCase(),
        },
    });

    if (!memberToUpdate) {
        throw new Error("Member not found.");
    }

    // If email is being changed, check if the new email already exists
    if (originalEmail.toLowerCase() !== newEmail.toLowerCase()) {
        const existingMember = await prisma.organizationMember.findFirst({
            where: {
                organizationId,
                email: newEmail.toLowerCase(),
            },
        });

        if (existingMember) {
            throw new Error("Another member with this email already exists.");
        }
    }

    await prisma.organizationMember.update({
        where: { id: memberToUpdate.id },
        data: {
            name: newName,
            email: newEmail.toLowerCase(),
            address: newAddress || null,
            mobile: newMobile || null,
            landline: newLandline || null,
        },
    });

    return { success: true };
}

export async function deleteMemberFromOrganization(organizationId: string, email: string) {
    if (!organizationId || !email) {
        throw new Error("Organization ID and member email are required.");
    }

    const memberToDelete = await prisma.organizationMember.findFirst({
        where: {
            organizationId,
            email: email.toLowerCase(),
        },
    });

    if (!memberToDelete) {
        throw new Error("Member not found to delete.");
    }

    // Delete the member
    await prisma.organizationMember.delete({
        where: { id: memberToDelete.id },
    });

    // If member has a user account, optionally delete it
    if (memberToDelete.userId) {
        try {
            await prisma.user.delete({
                where: { id: memberToDelete.userId },
            });
        } catch (error) {
            console.error(`Failed to delete user with ID: ${memberToDelete.userId}. They may have other associations.`, error);
        }
    }

    return { success: true };
}

export async function updateOrganization(
    organizationId: string,
    data: { name?: string; address?: string; mobile?: string; landline?: string; website?: string; deadlineSettings?: DeadlineSettings }
) {
    if (!organizationId) {
        throw new Error("Organization ID is required.");
    }

    const updateData: Prisma.OrganizationUpdateInput = {};
    if (data.name) updateData.name = data.name;
    if (data.address !== undefined) updateData.address = data.address || null;
    if (data.mobile !== undefined) updateData.mobile = data.mobile || null;
    if (data.landline !== undefined) updateData.landline = data.landline || null;
    if (data.website !== undefined) updateData.website = data.website || null;
    if (data.deadlineSettings) updateData.deadlineSettings = data.deadlineSettings as any;

    await prisma.organization.update({
        where: { id: organizationId },
        data: updateData,
    });

    return { success: true };
}

export async function deleteOrganization(organizationId: string) {
    if (!organizationId) {
        throw new Error("Organization ID is required.");
    }

    // Prisma will handle cascade deletes based on schema
    await prisma.organization.delete({
        where: { id: organizationId },
    });

    return { success: true };
}

export async function deleteUserAccount(userId: string): Promise<{ success: boolean; error?: string }> {
    if (!userId) {
        return { success: false, error: 'User ID is required.' };
    }

    try {
        // Delete the user account - Prisma cascade will handle organizations and all related data
        await prisma.user.delete({
            where: { id: userId },
        });

        return { success: true };
    } catch (error) {
        console.error('Error deleting user account:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to delete user account' };
    }
}

// ============================================================================
// COMPANY MANAGEMENT FUNCTIONS
// ============================================================================

export async function addCompany(organizationId: string, companyName: string): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!organizationId || !companyName.trim()) {
        return { success: false, error: 'Organization ID and company name are required.' };
    }

    try {
        // Check if a company with the same name already exists (case-insensitive)
        const existingCompany = await prisma.company.findFirst({
            where: {
                organizationId,
                name: {
                    equals: companyName.trim(),
                    mode: 'insensitive',
                },
            },
        });

        if (existingCompany) {
            return { success: false, error: 'A company with this name already exists.' };
        }

        const newCompany = await prisma.company.create({
            data: {
                organizationId,
                name: companyName.trim(),
            },
        });

        return { success: true, id: newCompany.id };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, error: errorMessage };
    }
}

export async function getCompanies(organizationId: string): Promise<Company[]> {
    if (!organizationId) return [];

    const companies = await prisma.company.findMany({
        where: { organizationId },
        orderBy: { name: 'asc' },
    });

    const formattedCompanies: Company[] = companies.map(c => ({
        id: c.id,
        name: c.name,
        address: c.address || undefined,
        mobile: c.mobile || undefined,
        landline: c.landline || undefined,
    }));

    return formattedCompanies;
}

export async function getCompanyWithTicketAndEmployeeCount(organizationId: string): Promise<Company[]> {
    if (!organizationId) return [];

    const companies = await prisma.company.findMany({
        where: { organizationId },
        include: {
            _count: {
                select: { employees: true, tickets: true },
            },
            tickets: {
                select: {
                    status: true,
                },
            },
        },
        orderBy: { name: 'asc' },
    });

    const companiesWithCounts: Company[] = companies.map((company: Prisma.CompanyGetPayload<{ include: { _count: { select: { employees: true, tickets: true } }, tickets: { select: { status: true } } } }>) => {
        const unresolvedCount = company.tickets.filter(
            (t: Prisma.TicketGetPayload<{ select: { status: true } }>) => t.status === 'OPEN' || t.status === 'PENDING'
        ).length;
        const resolvedCount = company.tickets.filter(
            (t: Prisma.TicketGetPayload<{ select: { status: true } }>) => t.status === 'CLOSED'
        ).length;

        return {
            id: company.id,
            name: company.name,
            address: company.address || undefined,
            mobile: company.mobile || undefined,
            landline: company.landline || undefined,
            ticketCount: company._count.tickets,
            unresolvedTicketCount: unresolvedCount,
            resolvedTicketCount: resolvedCount,
            employeeCount: company._count.employees,
        };
    });

    return companiesWithCounts;
}

export async function getCompanyDetails(organizationId: string, companyId: string): Promise<Company | null> {
    if (!organizationId || !companyId) return null;

    try {
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            include: {
                _count: {
                    select: { employees: true, tickets: true },
                },
            },
        });

        if (!company) return null;

        return {
            id: company.id,
            name: company.name,
            address: company.address || undefined,
            mobile: company.mobile || undefined,
            landline: company.landline || undefined,
            website: company.website || undefined,
            ticketCount: company._count.tickets,
            employeeCount: company._count.employees,
        };
    } catch (error: any) {
        console.error('Error fetching company details:', error);
        return null;
    }
}

// ...

export async function updateCompany(
    organizationId: string,
    companyId: string,
    data: { name?: string; address?: string; mobile?: string; landline?: string; website?: string }
) {
    if (!organizationId || !companyId) {
        throw new Error("Organization ID and Company ID are required.");
    }

    const updateData: Prisma.CompanyUpdateInput = {};
    if (data.name) updateData.name = data.name.trim();
    if (data.address !== undefined) updateData.address = data.address || null;
    if (data.mobile !== undefined) updateData.mobile = data.mobile || null;
    if (data.landline !== undefined) updateData.landline = data.landline || null;

    await prisma.company.update({
        where: { id: companyId },
        data: updateData,
    });

    return { success: true };
}

export async function deleteCompany(organizationId: string, companyId: string) {
    if (!organizationId || !companyId) {
        throw new Error("Organization ID and Company ID are required.");
    }

    // Prisma will handle cascade deletes
    await prisma.company.delete({
        where: { id: companyId },
    });

    return { success: true };
}

// ============================================================================
// EMPLOYEE MANAGEMENT FUNCTIONS
// ============================================================================

export async function addEmployeeToCompany(organizationId: string, companyId: string, employee: Omit<Employee, 'status' | 'uid'>) {
    if (!organizationId || !companyId || !employee.email) {
        return;
    }

    // Check if employee already exists
    const existingEmployee = await prisma.employee.findFirst({
        where: {
            companyId,
            email: employee.email.toLowerCase(),
        },
    });

    if (existingEmployee) {
        throw new Error("An employee with this email already exists in this company.");
    }

    await prisma.employee.create({
        data: {
            companyId,
            name: employee.name,
            email: employee.email.toLowerCase(),
            address: employee.address || null,
            mobile: employee.mobile || null,
            landline: employee.landline || null,
            status: 'UNINVITED',
        },
    });
}

export async function getCompanyEmployees(organizationId: string, companyId: string): Promise<Employee[]> {
    if (!organizationId || !companyId) return [];

    const employees = await prisma.employee.findMany({
        where: { companyId },
        include: {
            user: {
                select: {
                    id: true,
                },
            },
        },
        orderBy: { createdAt: 'asc' },
    });

    const formattedEmployees: Employee[] = employees.map((e: any) => ({
        name: e.name,
        email: e.email,
        address: e.address || undefined,
        mobile: e.mobile || undefined,
        landline: e.landline || undefined,
        status: e.status as 'UNINVITED' | 'INVITED' | 'NOT_VERIFIED' | 'VERIFIED',
        uid: e.userId || undefined,
    }));

    return formattedEmployees;
}

export async function updateCompanyEmployee(
    organizationId: string,
    companyId: string,
    originalEmail: string,
    newName: string,
    newEmail: string,
    newAddress: string,
    newMobile: string,
    newLandline: string
) {
    if (!organizationId || !companyId || !originalEmail) {
        throw new Error("All parameters are required.");
    }

    const employeeToUpdate = await prisma.employee.findFirst({
        where: {
            companyId,
            email: originalEmail.toLowerCase(),
        },
    });

    if (!employeeToUpdate) {
        throw new Error("Employee not found.");
    }

    // If email is being changed, check if new email already exists
    if (originalEmail.toLowerCase() !== newEmail.toLowerCase()) {
        const existingEmployee = await prisma.employee.findFirst({
            where: {
                companyId,
                email: newEmail.toLowerCase(),
            },
        });

        if (existingEmployee) {
            throw new Error("Another employee with this email already exists.");
        }
    }

    await prisma.employee.update({
        where: { id: employeeToUpdate.id },
        data: {
            name: newName,
            email: newEmail.toLowerCase(),
            address: newAddress || null,
            mobile: newMobile || null,
            landline: newLandline || null,
        },
    });

    return { success: true };
}

export async function deleteCompanyEmployee(organizationId: string, companyId: string, email: string) {
    if (!organizationId || !companyId || !email) {
        throw new Error("Missing required parameters to delete employee.");
    }

    const employeeToDelete = await prisma.employee.findFirst({
        where: {
            companyId,
            email: email.toLowerCase(),
        },
    });

    if (!employeeToDelete) {
        throw new Error("Employee not found.");
    }

    await prisma.employee.delete({
        where: { id: employeeToDelete.id },
    });

    // Optionally delete user account if exists
    if (employeeToDelete.userId) {
        try {
            await prisma.user.delete({
                where: { id: employeeToDelete.userId },
            });
        } catch (error) {
            console.error(`Failed to delete user with ID: ${employeeToDelete.userId}`, error);
        }
    }

    return { success: true };
}

// ============================================================================
// TICKET MANAGEMENT FUNCTIONS
// ============================================================================

// Helper function to get next ticket number
async function getNextTicketNumber(organizationId: string): Promise<number> {
    const lastTicket = await prisma.ticket.findFirst({
        where: { organizationId },
        orderBy: { ticketNumber: 'desc' },
        select: { ticketNumber: true },
    });

    return (lastTicket?.ticketNumber || 0) + 1;
}

// Helper function to map priority strings to enum
function mapPriorityToEnum(priority: string): 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
    const map: Record<string, 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'> = {
        'None': 'NONE',
        'Low': 'LOW',
        'Medium': 'MEDIUM',
        'High': 'HIGH',
        'Urgent': 'URGENT',
    };
    return map[priority] || 'NONE';
}

// Helper function to map status strings to enum
function mapStatusToEnum(status: string): 'OPEN' | 'PENDING' | 'CLOSED' | 'ARCHIVED' {
    const map: Record<string, 'OPEN' | 'PENDING' | 'CLOSED' | 'ARCHIVED'> = {
        'Open': 'OPEN',
        'Pending': 'PENDING',
        'Resolved': 'CLOSED',
        'Closed': 'CLOSED',
        'Archived': 'ARCHIVED',
    };
    return map[status] || 'OPEN';
}

// Helper function to map type strings to enum
function mapTypeToEnum(type: string): 'QUESTION' | 'INCIDENT' | 'PROBLEM' | 'TASK' {
    const map: Record<string, 'QUESTION' | 'INCIDENT' | 'PROBLEM' | 'TASK'> = {
        'Questions': 'QUESTION',
        'Question': 'QUESTION',
        'Incident': 'INCIDENT',
        'Problem': 'PROBLEM',
        'Task': 'TASK',
    };
    return map[type] || 'QUESTION';
}

// Helper function to map enum back to display strings
function mapEnumToPriority(priority: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'): string {
    const map: Record<string, string> = {
        'NONE': 'None',
        'LOW': 'Low',
        'MEDIUM': 'Medium',
        'HIGH': 'High',
        'URGENT': 'Urgent',
    };
    return map[priority] || 'None';
}

function mapEnumToStatus(status: 'OPEN' | 'PENDING' | 'CLOSED' | 'ARCHIVED'): string {
    const map: Record<string, string> = {
        'OPEN': 'Open',
        'PENDING': 'Pending',
        'CLOSED': 'Resolved',
        'ARCHIVED': 'Archived',
    };
    return map[status] || 'Open';
}

function mapEnumToType(type: 'QUESTION' | 'INCIDENT' | 'PROBLEM' | 'TASK'): string {
    const map: Record<string, string> = {
        'QUESTION': 'Questions',
        'INCIDENT': 'Incident',
        'PROBLEM': 'Problem',
        'TASK': 'Task',
    };
    return map[type] || 'Questions';
}

export async function createTicket(
    organizationId: string,
    author: { uid: string; name: string; email: string },
    title: string,
    body: string,
    attachments: NewAttachment[],
    cc?: string,
    bcc?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!organizationId || !author.uid || !title.trim()) {
        return { success: false, error: 'Missing required fields to create a ticket.' };
    }

    try {
        // Find which company this employee belongs to
        const employee = await prisma.employee.findFirst({
            where: {
                email: author.email.toLowerCase(),
                company: {
                    organizationId,
                },
            },
            include: {
                company: true,
            },
        });

        const companyId = employee?.companyId;
        const isClient = !!employee;

        const ticketNumber = await getNextTicketNumber(organizationId);
        
        // Generate a unique conversation ID for portal-created tickets
        const conversationId = `manual-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        // Get admin email for To recipient
        const settings = await getAPISettings(organizationId);
        const adminEmail = settings?.userId || 'support@example.com';

        // Create ticket in database
        const newTicket = await prisma.ticket.create({
            data: {
                organizationId,
                companyId,
                ticketNumber,
                subject: title,
                sender: author.name,
                senderEmail: author.email.toLowerCase(),
                bodyPreview: body.substring(0, 255).replace(/<[^>]*>/g, ''),
                body,
                bodyContentType: 'html',
                receivedDateTime: new Date(),
                priority: 'NONE',
                status: 'OPEN',
                type: 'QUESTION',
                creatorId: author.uid,
                hasAttachments: attachments && attachments.length > 0,
                conversationId,
            },
        });
        
        // Parse CC and BCC recipients
        const ccRecipients = cc ? cc.split(',').map(email => email.trim()).filter(e => e) : [];
        const bccRecipients = bcc ? bcc.split(',').map(email => email.trim()).filter(e => e) : [];
        
        // Store recipients in database
        const recipientData: any[] = [];
        
        // Add To recipient (admin email)
        recipientData.push({
            ticketId: newTicket.id,
            type: 'TO',
            name: 'Support',
            email: adminEmail,
        });
        
        // Add CC recipients
        ccRecipients.forEach(email => {
            recipientData.push({
                ticketId: newTicket.id,
                type: 'CC',
                name: email.split('@')[0],
                email: email,
            });
        });
        
        // Add BCC recipients
        bccRecipients.forEach(email => {
            recipientData.push({
                ticketId: newTicket.id,
                type: 'BCC',
                name: email.split('@')[0],
                email: email,
            });
        });
        
        if (recipientData.length > 0) {
            await prisma.recipient.createMany({
                data: recipientData,
            });
        }
        
        // Create initial conversation message (like email-based tickets)
        const initialMessage: DetailedEmail = {
            id: newTicket.id,
            subject: title,
            sender: author.name,
            senderEmail: author.email.toLowerCase(),
            bodyPreview: body.substring(0, 255).replace(/<[^>]*>/g, ''),
            receivedDateTime: newTicket.receivedDateTime.toISOString(),
            priority: 'NONE',
            status: 'OPEN',
            type: 'QUESTION',
            conversationId,
            body: {
                contentType: 'html',
                content: body,
            },
            attachments: attachments.map((att, index) => ({
                id: `att-${Date.now()}-${index}`,
                name: att.name,
                contentType: att.contentType,
                size: att.contentBytes ? Buffer.from(att.contentBytes, 'base64').length : 0,
                isInline: false,
            })),
            hasAttachments: attachments && attachments.length > 0,
            toRecipients: [{ emailAddress: { name: 'Support', address: adminEmail } }],
            ccRecipients: ccRecipients.map(email => ({ emailAddress: { address: email } })),
        };
        
        // Store conversation in database
        await prisma.conversation.create({
            data: {
                id: conversationId,
                organizationId,
                messages: [initialMessage] as any,
            },
        });
        
        // Store attachments if any
        if (attachments && attachments.length > 0) {
            await prisma.attachment.createMany({
                data: attachments.map(att => ({
                    ticketId: newTicket.id,
                    name: att.name,
                    contentType: att.contentType,
                    size: att.contentBytes ? Buffer.from(att.contentBytes, 'base64').length : 0,
                    isInline: false,
                    contentId: null,
                })),
            });
            console.log(`[createTicket] Stored ${attachments.length} attachments for ticket #${ticketNumber}`);
        }

        // Add activity log
        await addActivityLog(organizationId, newTicket.id, {
            type: 'Create',
            details: 'Ticket created from portal',
            date: newTicket.receivedDateTime.toISOString(),
        });

        // Send email to admin inbox (so portal tickets appear in inbox like email-based tickets)
        if (settings) {
            try {
                // Add "Created by" prefix to email body for inbox visibility
                const emailBody = `<p><strong>Created by ${author.name}:</strong></p>${body}`;
                
                await sendEmailAction(organizationId, {
                    recipient: adminEmail,
                    subject: title,
                    body: emailBody,
                    cc: ccRecipients,
                    bcc: bccRecipients,
                    attachments: attachments,
                });

                console.log(`[createTicket] Sent ticket #${ticketNumber} to admin inbox: ${adminEmail}`);
                
                // Wait longer for the email to be processed by Microsoft Graph
                console.log(`[createTicket] Waiting 5 seconds for email to be processed...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                // Fetch the email back from inbox to get real message ID and conversation ID
                try {
                    const accessToken = await getAccessToken(settings);
                    const { Client } = await import('@microsoft/microsoft-graph-client');
                    
                    const client = Client.init({
                        authProvider: (done: any) => {
                            done(null, accessToken);
                        },
                    });
                    
                    // Search for the email we just sent in Sent Items folder
                    // The email will be in Sent Items since we used sendMail endpoint
                    console.log(`[createTicket] Searching for email with subject: "${title}"`);
                    const response = await client
                        .api(`/users/${settings.userId}/mailFolders/SentItems/messages`)
                        .filter(`sentDateTime ge ${new Date(Date.now() - 15000).toISOString()}`)
                        .top(10)
                        .select('id,conversationId,subject,toRecipients,sentDateTime')
                        .orderby('sentDateTime desc')
                        .get();
                    
                    console.log(`[createTicket] Found ${response.value?.length || 0} recent emails in Sent Items`);
                    if (response.value && response.value.length > 0) {
                        console.log(`[createTicket] Recent email subjects:`, response.value.map((m: any) => m.subject));
                    }
                    
                    // Find the matching email (most recent one with matching subject and recipient)
                    const matchingEmail = response.value?.find((msg: any) => 
                        msg.subject === title && 
                        msg.toRecipients?.some((recipient: any) => 
                            recipient.emailAddress?.address?.toLowerCase() === adminEmail.toLowerCase()
                        )
                    );
                    
                    if (matchingEmail) {
                        const realMessageId = matchingEmail.id;
                        const realConversationId = matchingEmail.conversationId;
                        
                        console.log(`[createTicket] Found email in inbox - Message ID: ${realMessageId}, Conversation ID: ${realConversationId}`);
                        
                        // Fetch full message details including attachments
                        const fullMessage = await client
                            .api(`/users/${settings.userId}/messages/${realMessageId}`)
                            .select('id,conversationId,subject,from,toRecipients,ccRecipients,body,hasAttachments,receivedDateTime')
                            .expand('attachments')
                            .get();
                        
                        console.log(`[createTicket] Fetched full message with ${fullMessage.attachments?.length || 0} attachments`);
                        
                        // Get the old conversation data
                        const oldConversation = await prisma.conversation.findUnique({
                            where: { id: conversationId },
                        });
                        
                        if (oldConversation) {
                            const messages = (oldConversation.messages as any[]) || [];
                            
                            // Update the first message with real message ID and attachment IDs
                            if (messages.length > 0) {
                                console.log(`[createTicket] Old message ID: ${messages[0].id}, New message ID: ${realMessageId}`);
                                messages[0].id = realMessageId;
                                
                                // Completely override attachments with real Microsoft Graph attachment IDs
                                if (fullMessage.attachments && fullMessage.attachments.length > 0) {
                                    console.log(`[createTicket] Overriding ${messages[0].attachments?.length || 0} temp attachments with ${fullMessage.attachments.length} real attachments`);
                                    
                                    // Map real attachments from Microsoft Graph
                                    const realAttachments = fullMessage.attachments.map((att: any) => {
                                        console.log(`[createTicket] Real attachment - ID: ${att.id}, Name: ${att.name}`);
                                        return {
                                            id: att.id,
                                            name: att.name,
                                            contentType: att.contentType,
                                            size: att.size,
                                            isInline: att.isInline || false,
                                            contentId: att.contentId || null,
                                        };
                                    });
                                    
                                    // Completely replace attachments array
                                    messages[0].attachments = realAttachments;
                                    messages[0].hasAttachments = realAttachments.length > 0;
                                    
                                    // Delete old attachment records from database
                                    await prisma.attachment.deleteMany({
                                        where: { ticketId: newTicket.id },
                                    });
                                    
                                    // Create new attachment records with real IDs
                                    await prisma.attachment.createMany({
                                        data: fullMessage.attachments.map((att: any) => ({
                                            ticketId: newTicket.id,
                                            name: att.name,
                                            contentType: att.contentType,
                                            size: att.size,
                                            isInline: att.isInline || false,
                                            contentId: att.contentId || null,
                                        })),
                                    });
                                    
                                    console.log(`[createTicket] ✓ Successfully updated ${fullMessage.attachments.length} attachments with real Microsoft Graph IDs`);
                                } else if (messages[0].attachments && messages[0].attachments.length > 0) {
                                    // No attachments found in Microsoft Graph but we had temp ones - clear them
                                    console.warn(`[createTicket] No attachments found in Microsoft Graph, clearing temp attachments`);
                                    messages[0].attachments = [];
                                    messages[0].hasAttachments = false;
                                }
                            }
                            
                            // Delete the old conversation with manual ID
                            await prisma.conversation.delete({
                                where: { id: conversationId },
                            });
                            
                            // Create new conversation with real Microsoft Graph conversation ID
                            await prisma.conversation.create({
                                data: {
                                    id: realConversationId,
                                    organizationId,
                                    messages: messages as any,
                                },
                            });
                            
                            // Update the ticket with real conversation ID
                            await prisma.ticket.update({
                                where: { id: newTicket.id },
                                data: {
                                    conversationId: realConversationId,
                                },
                            });
                        }
                        
                        console.log(`[createTicket] Updated ticket #${ticketNumber} with real Microsoft Graph IDs and attachments`);
                    } else {
                        console.warn(`[createTicket] Could not find email in inbox for ticket #${ticketNumber}`);
                    }
                } catch (fetchError) {
                    console.error(`[createTicket] Failed to fetch email from inbox:`, fetchError);
                    // Don't fail the ticket creation if fetching fails
                }
            } catch (emailError) {
                console.error(`[createTicket] Failed to send ticket to inbox:`, emailError);
                // Don't fail the ticket creation if email sending fails
            }
        }

        // Send ticket creation notification to client
        if (isClient) {
            await sendTicketCreationNotification(
                organizationId,
                newTicket,
                author.email,
                author.name
            );
        }

        return { success: true, id: newTicket.id };
    } catch (error) {
        console.error('Error creating ticket:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { success: false, error: errorMessage };
    }
}

export async function getTicketsFromDB(
    organizationId: string,
    options?: { includeArchived?: boolean; onlyArchived?: boolean; fetchAll?: boolean; companyId?: string }
): Promise<Email[]> {
    if (!organizationId) return [];

    const whereClause: Prisma.TicketWhereInput = {
        organizationId,
    };

    // Handle archived ticket filtering
    if (options?.onlyArchived) {
        // Show ONLY archived tickets
        whereClause.AND = [
            { status: 'ARCHIVED' },
            { archivedAt: { not: null } }
        ];
    } else if (!options?.includeArchived) {
        // Filter out archived tickets using both status and archivedAt for extra safety
        whereClause.AND = [
            { status: { not: 'ARCHIVED' } },
            { archivedAt: null }
        ];
    }
    // If includeArchived is true and onlyArchived is false, show all tickets

    if (options?.companyId) {
        whereClause.companyId = options.companyId;
    }

    const tickets = await prisma.ticket.findMany({
        where: whereClause,
        select: {
            id: true,
            ticketNumber: true,
            subject: true,
            sender: true,
            senderEmail: true,
            bodyPreview: true,
            receivedDateTime: true,
            priority: true,
            status: true,
            type: true,
            conversationId: true,
            deadline: true,
            closedAt: true,
            lastReplier: true,
            companyId: true,
            assigneeId: true,
            archivedAt: true,
            creatorId: true,
            company: {
                select: {
                    name: true,
                },
            },
            assignee: {
                select: {
                    id: true,
                    name: true,
                },
            },
            tags: {
                select: {
                    tag: true,
                },
            },
        },
        orderBy: {
            receivedDateTime: 'desc',
        },
        take: 100, // Limit to last 100 tickets for performance
    });

    // Log ticket filtering for debugging
    const archivedCount = tickets.filter(t => t.status === 'ARCHIVED').length;
    const nonArchivedCount = tickets.filter(t => t.status !== 'ARCHIVED').length;
    console.log(`[getTicketsFromDB] Query options:`, { 
        includeArchived: options?.includeArchived, 
        onlyArchived: options?.onlyArchived,
        companyId: options?.companyId 
    });
    console.log(`[getTicketsFromDB] Results: ${tickets.length} total (${archivedCount} archived, ${nonArchivedCount} non-archived)`);
    
    if (archivedCount > 0 && !options?.onlyArchived) {
        console.warn(`[getTicketsFromDB] WARNING: Returning ${archivedCount} archived tickets when onlyArchived is not set!`);
        console.log(`[getTicketsFromDB] Archived ticket IDs:`, tickets.filter(t => t.status === 'ARCHIVED').map(t => `#${t.ticketNumber}`));
    }

    // Map to Email interface format for compatibility
    const formattedTickets: Email[] = tickets.map(ticket => ({
        id: ticket.id,
        subject: ticket.subject,
        sender: ticket.sender,
        senderEmail: ticket.senderEmail,
        bodyPreview: ticket.bodyPreview,
        receivedDateTime: ticket.receivedDateTime.toISOString(),
        priority: ticket.priority.charAt(0) + ticket.priority.slice(1).toLowerCase(), // LOW -> Low
        status: ticket.status === 'CLOSED' ? 'Resolved' : ticket.status.charAt(0) + ticket.status.slice(1).toLowerCase(),
        type: ticket.type.charAt(0) + ticket.type.slice(1).toLowerCase() + 's', // QUESTION -> Questions
        conversationId: ticket.conversationId || undefined,
        deadline: ticket.deadline?.toISOString(),
        tags: ticket.tags.map(t => t.tag),
        closedAt: ticket.closedAt?.toISOString(),
        lastReplier: ticket.lastReplier as 'agent' | 'client' | undefined,
        ticketNumber: ticket.ticketNumber,
        companyId: ticket.companyId || undefined,
        companyName: ticket.company?.name,
        assignee: ticket.assigneeId || undefined,
        assigneeName: ticket.assignee?.name || 'Unassigned',
        creator: ticket.creatorId ? { name: ticket.sender, email: ticket.senderEmail } : undefined,
    }));

    return formattedTickets;
}

async function sendTicketCreationNotification(
    organizationId: string,
    ticket: any,
    clientEmail: string,
    clientName: string
): Promise<void> {
    try {
        const settings = await getAPISettings(organizationId);
        if (!settings) {
            console.error('Cannot send ticket creation notification: API settings not configured');
            return;
        }

        const accessToken = await getAccessToken(settings);
        const client = Client.init({
            authProvider: (done: any) => {
                done(null, accessToken);
            },
        });

        // Get the base URL from environment
        const baseUrl = process.env.NEXT_PUBLIC_PARENT_DOMAIN;
        const ticketUrl = `https://${baseUrl}/tickets/${ticket.id}`;

        const subject = `Ticket Created: #${ticket.ticketNumber} - ${ticket.subject}`;
        const body = `
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #4F46E5;">Ticket Created Successfully</h2>
                <p>Hello ${clientName},</p>
                <p>Your support ticket has been created and our team will respond shortly.</p>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Ticket #:</strong> ${ticket.ticketNumber}</p>
                    <p><strong>Subject:</strong> ${ticket.subject}</p>
                    <p><strong>Status:</strong> ${ticket.status}</p>
                    <p><strong>Created:</strong> ${new Date(ticket.receivedDateTime).toLocaleString()}</p>
                </div>
                <p>
                    <a href="${ticketUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        View Ticket
                    </a>
                </p>
                <p>You can track the status of your ticket using the link above.</p>
                <p style="margin-top: 30px; color: #666; font-size: 12px;">
                    This is an automated notification from your ticketing system.
                </p>
            </body>
            </html>
        `;

        const message = {
            subject,
            body: {
                contentType: 'HTML',
                content: body,
            },
            toRecipients: [
                {
                    emailAddress: {
                        address: clientEmail,
                    },
                },
            ],
        };

        await client.api(`/users/${settings.userId}/sendMail`).post({ message });
        console.log(`Ticket creation notification sent to ${clientEmail} for ticket #${ticket.ticketNumber}`);
    } catch (error) {
        console.error('Error sending ticket creation notification:', error);
        // Don't throw error - notification failure shouldn't block ticket creation
    }
}

async function sendAssignmentNotification(
    organizationId: string,
    ticket: any,
    assigneeEmail: string,
    assigneeName: string
): Promise<void> {
    try {
        const settings = await getAPISettings(organizationId);
        if (!settings) {
            console.error('Cannot send assignment notification: API settings not configured');
            return;
        }

        const accessToken = await getAccessToken(settings);
        const client = Client.init({
            authProvider: (done: any) => {
                done(null, accessToken);
            },
        });

        // Get the base URL from environment
        const baseUrl = process.env.NEXT_PUBLIC_PARENT_DOMAIN;
        const ticketUrl = `https://${baseUrl}/tickets/${ticket.id}`;

        const subject = `You've been assigned to Ticket #${ticket.ticketNumber}: ${ticket.subject}`;
        const body = `
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #4F46E5;">Ticket Assignment Notification</h2>
                <p>Hello ${assigneeName},</p>
                <p>You have been assigned to the following ticket:</p>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Ticket #:</strong> ${ticket.ticketNumber}</p>
                    <p><strong>Subject:</strong> ${ticket.subject}</p>
                    <p><strong>Priority:</strong> ${ticket.priority}</p>
                    <p><strong>Status:</strong> ${ticket.status}</p>
                    <p><strong>Type:</strong> ${ticket.type}</p>
                    ${ticket.deadline ? `<p><strong>Deadline:</strong> ${new Date(ticket.deadline).toLocaleDateString()}</p>` : ''}
                </div>
                <p>
                    <a href="${ticketUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        View Ticket
                    </a>
                </p>
                <p>Please review and respond to this ticket at your earliest convenience.</p>
                <p style="margin-top: 30px; color: #666; font-size: 12px;">
                    This is an automated notification from your ticketing system.
                </p>
            </body>
            </html>
        `;

        const message = {
            subject,
            body: {
                contentType: 'HTML',
                content: body,
            },
            toRecipients: [
                {
                    emailAddress: {
                        address: assigneeEmail,
                    },
                },
            ],
        };

        await client.api(`/users/${settings.userId}/sendMail`).post({ message });
        console.log(`Assignment notification sent to ${assigneeEmail} for ticket #${ticket.ticketNumber}`);
    } catch (error) {
        console.error('Error sending assignment notification:', error);
        throw error;
    }
}

async function sendPriorityChangeNotification(
    organizationId: string,
    ticket: any,
    assigneeEmail: string,
    assigneeName: string,
    newPriority: string
): Promise<void> {
    try {
        const settings = await getAPISettings(organizationId);
        if (!settings) {
            console.error('Cannot send priority change notification: API settings not configured');
            return;
        }

        const accessToken = await getAccessToken(settings);
        const client = Client.init({
            authProvider: (done: any) => {
                done(null, accessToken);
            },
        });

        // Get the base URL from environment
        const baseUrl = process.env.NEXT_PUBLIC_PARENT_DOMAIN;
        const ticketUrl = `https://${baseUrl}/tickets/${ticket.id}`;

        // Format deadline
        const deadlineText = ticket.deadline 
            ? `<p><strong>New Deadline:</strong> <span style="color: #DC2626; font-size: 16px;">${new Date(ticket.deadline).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></p>`
            : '<p><strong>Deadline:</strong> Not set</p>';

        const subject = `Deadline Updated: Ticket #${ticket.ticketNumber} - ${ticket.subject}`;
        const body = `
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #4F46E5;">Ticket Deadline Changed</h2>
                <p>Hello ${assigneeName},</p>
                <p>The priority of a ticket assigned to you has been updated:</p>
                <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Ticket #:</strong> ${ticket.ticketNumber}</p>
                    <p><strong>Subject:</strong> ${ticket.subject}</p>
                    <p><strong>New Priority:</strong> <span style="color: #DC2626; font-size: 16px; font-weight: bold;">${newPriority}</span></p>
                    ${deadlineText}
                    <p><strong>Status:</strong> ${mapEnumToStatus(ticket.status)}</p>
                </div>
                <p>
                    <a href="${ticketUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        View Ticket
                    </a>
                </p>
                <p>Please review this ticket and take appropriate action based on the new priority level.</p>
                <p style="margin-top: 30px; color: #666; font-size: 12px;">
                    This is an automated notification from your ticketing system.
                </p>
            </body>
            </html>
        `;

        const message = {
            subject,
            body: {
                contentType: 'HTML',
                content: body,
            },
            toRecipients: [
                {
                    emailAddress: {
                        address: assigneeEmail,
                    },
                },
            ],
        };

        await client.api(`/users/${settings.userId}/sendMail`).post({ message });
        console.log(`Priority change notification sent to ${assigneeEmail} for ticket #${ticket.ticketNumber}`);
    } catch (error) {
        console.error('Error sending priority change notification:', error);
        throw error;
    }
}

export async function updateTicket(
    organizationId: string,
    id: string,
    data: {
        priority?: string;
        status?: string;
        type?: string;
        assignee?: string | null;
        deadline?: string | null;
        tags?: string[];
        companyId?: string | null;
    },
    currentUserId?: string
): Promise<{ success: boolean; error?: string }> {
    if (!organizationId || !id) {
        return { success: false, error: 'Organization ID and Ticket ID are required.' };
    }

    try {
        const updateData: Prisma.TicketUpdateInput = {};

        if (data.priority !== undefined) {
            updateData.priority = mapPriorityToEnum(data.priority);
        }

        if (data.status) {
            // Prevent setting ARCHIVED status through updateTicket - must use archiveTickets function
            if (data.status === 'Archived') {
                console.warn(`[updateTicket] Attempted to set ticket ${id} to ARCHIVED via updateTicket. Use archiveTickets() instead.`);
                return { success: false, error: 'Cannot archive tickets through status update. Use the archive function instead.' };
            }
            
            updateData.status = mapStatusToEnum(data.status);
            if (data.status === 'Resolved' || data.status === 'Closed') {
                updateData.closedAt = new Date();
            }
        }

        if (data.type) {
            updateData.type = mapTypeToEnum(data.type);
        }

        if (data.assignee !== undefined) {
            updateData.assigneeId = data.assignee || null;
        }

        if (data.deadline !== undefined) {
            updateData.deadline = data.deadline ? new Date(data.deadline) : null;
        }

        if (data.companyId !== undefined) {
            updateData.companyId = data.companyId || null;
        }

        const updatedTicket = await prisma.ticket.update({
            where: { id },
            data: updateData,
            include: {
                assignee: true,
            },
        });

        // Handle tags separately
        if (data.tags) {
            // Delete existing tags
            await prisma.ticketTag.deleteMany({
                where: { ticketId: id },
            });

            // Create new tags
            if (data.tags.length > 0) {
                await prisma.ticketTag.createMany({
                    data: data.tags.map(tag => ({
                        ticketId: id,
                        tag,
                    })),
                });
            }
        }

        // Send email notification if assignee was changed
        if (data.assignee !== undefined && data.assignee) {
            try {
                const assignee = await prisma.user.findUnique({
                    where: { id: data.assignee },
                    include: {
                        memberships: {
                            where: { organizationId },
                        },
                    },
                });

                if (assignee && assignee.memberships.length > 0) {
                    const assigneeEmail = assignee.memberships[0].email;
                    const assigneeName = assignee.name || assigneeEmail;
                    
                    // Get API settings to send email
                    const settings = await getAPISettings(organizationId);
                    if (settings) {
                        await sendAssignmentNotification(
                            organizationId,
                            updatedTicket,
                            assigneeEmail,
                            assigneeName
                        );
                    }
                }
            } catch (emailError) {
                console.error('Error sending assignment notification:', emailError);
                // Don't fail the update if email fails
            }
        }

        // Send email notification if priority was changed and ticket has an assignee
        if (data.priority !== undefined && updatedTicket.assigneeId) {
            try {
                const assignee = await prisma.user.findUnique({
                    where: { id: updatedTicket.assigneeId },
                    include: {
                        memberships: {
                            where: { organizationId },
                        },
                    },
                });

                if (assignee && assignee.memberships.length > 0) {
                    const assigneeEmail = assignee.memberships[0].email;
                    const assigneeName = assignee.name || assigneeEmail;
                    
                    // Get API settings to send email
                    const settings = await getAPISettings(organizationId);
                    if (settings) {
                        await sendPriorityChangeNotification(
                            organizationId,
                            updatedTicket,
                            assigneeEmail,
                            assigneeName,
                            data.priority
                        );
                    }
                }
            } catch (emailError) {
                console.error('Error sending priority change notification:', emailError);
                // Don't fail the update if email fails
            }
        }

        // Add activity logs for all changes
        try {
            const activityLogs: Array<{ type: string; details: string }> = [];

            if (data.priority !== undefined) {
                console.log('[Activity Log] Adding priority change log:', data.priority);
                activityLogs.push({
                    type: 'Update',
                    details: `Priority changed to ${data.priority}`
                });
            }

            if (data.status) {
                activityLogs.push({
                    type: 'Update',
                    details: `Status changed to ${data.status}`
                });
            }

            if (data.type) {
                activityLogs.push({
                    type: 'Update',
                    details: `Type changed to ${data.type}`
                });
            }

            if (data.assignee !== undefined) {
                if (data.assignee) {
                    const assignee = await prisma.user.findUnique({
                        where: { id: data.assignee },
                    });
                    const assigneeName = assignee?.name || 'Unknown';
                    activityLogs.push({
                        type: 'Update',
                        details: `Assigned to ${assigneeName}`
                    });
                } else {
                    activityLogs.push({
                        type: 'Update',
                        details: 'Unassigned'
                    });
                }
            }

            if (data.deadline !== undefined) {
                if (data.deadline) {
                    const deadlineDate = new Date(data.deadline).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    });
                    activityLogs.push({
                        type: 'Update',
                        details: `Deadline set to ${deadlineDate}`
                    });
                } else {
                    activityLogs.push({
                        type: 'Update',
                        details: 'Deadline cleared'
                    });
                }
            }

            if (data.companyId !== undefined) {
                if (data.companyId) {
                    const company = await prisma.company.findUnique({
                        where: { id: data.companyId },
                    });
                    const companyName = company?.name || 'Unknown';
                    activityLogs.push({
                        type: 'Update',
                        details: `Company set to ${companyName}`
                    });
                } else {
                    activityLogs.push({
                        type: 'Update',
                        details: 'Company removed'
                    });
                }
            }

            if (data.tags) {
                activityLogs.push({
                    type: 'Update',
                    details: `Tags updated: ${data.tags.join(', ')}`
                });
            }

            // Create all activity logs
            console.log('[Activity Log] Total logs to create:', activityLogs.length);
            console.log('[Activity Log] Current user ID:', currentUserId);
            for (const log of activityLogs) {
                console.log('[Activity Log] Creating log:', log);
                const result = await addActivityLog(organizationId, id, {
                    type: log.type,
                    details: log.details,
                    date: new Date().toISOString(),
                    ticketSubject: updatedTicket.subject
                }, currentUserId);
                console.log('[Activity Log] Result:', result);
            }
        } catch (logError) {
            console.error('[Activity Log] Error adding activity logs:', logError);
            // Don't fail the update if logging fails
        }

        return { success: true };
    } catch (error) {
        console.error('Error updating ticket:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { success: false, error: errorMessage };
    }
}

export async function archiveTickets(organizationId: string, ticketIds: string[]) {
    if (!organizationId) {
        return { success: false, error: 'Organization ID is required.' };
    }

    if (!ticketIds || ticketIds.length === 0) {
        return { success: false, error: 'No tickets selected for archiving.' };
    }

    try {
        await prisma.ticket.updateMany({
            where: {
                id: { in: ticketIds },
                organizationId,
            },
            data: {
                status: 'ARCHIVED',
                archivedAt: new Date(),
            },
        });

        console.log(`[archiveTickets] Archived ${ticketIds.length} tickets:`, ticketIds);

        return { success: true };
    } catch (error) {
        console.error('Error archiving tickets:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { success: false, error: errorMessage };
    }
}

export async function unarchiveTickets(organizationId: string, ticketIds: string[]) {
    if (!organizationId) {
        return { success: false, error: 'Organization ID is required.' };
    }

    if (!ticketIds || ticketIds.length === 0) {
        return { success: false, error: 'No tickets selected for unarchiving.' };
    }

    try {
        await prisma.ticket.updateMany({
            where: {
                id: { in: ticketIds },
                organizationId,
            },
            data: {
                status: 'OPEN',
                archivedAt: null,
            },
        });

        console.log(`[unarchiveTickets] Unarchived ${ticketIds.length} tickets:`, ticketIds);

        return { success: true };
    } catch (error) {
        console.error('Error unarchiving tickets:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { success: false, error: errorMessage };
    }
}

// ============================================================================
// ACTIVITY LOG FUNCTIONS
// ============================================================================

export async function addActivityLog(
    organizationId: string,
    ticketId: string,
    logEntry: Omit<ActivityLog, 'id' | 'userName' | 'userEmail' | 'user'>,
    currentUserId?: string | null
): Promise<{ success: boolean; error?: string }> {
    if (!organizationId || !ticketId) {
        throw new Error('Organization ID and Ticket ID are required.');
    }

    try {
        console.log('[addActivityLog] Creating activity log:', { organizationId, ticketId, logEntry, providedUserId: currentUserId });
        
        // Try to get userId from parameter first, then from session
        let userId = currentUserId || null;
        
        if (!userId) {
            const session = await getServerSession(authOptions);
            userId = session?.user?.id || null;
            console.log('[addActivityLog] No userId provided, got from session:', userId);
        } else {
            console.log('[addActivityLog] Using provided userId:', userId);
        }

        const result = await prisma.activityLog.create({
            data: {
                organizationId,
                ticketId,
                ticketSubject: logEntry.ticketSubject,
                type: logEntry.type,
                details: logEntry.details,
                userId: userId,
                createdAt: new Date(logEntry.date),
            },
        });

        console.log('[addActivityLog] Activity log created successfully:', result.id, 'with userId:', userId);
        return { success: true };
    } catch (error) {
        console.error('[addActivityLog] Error adding activity log:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { success: false, error: errorMessage };
    }
}

export async function getActivityLog(organizationId: string, ticketId: string): Promise<ActivityLog[]> {
    if (!organizationId || !ticketId) {
        return [];
    }

    try {
        const logs = await prisma.activityLog.findMany({
            where: {
                organizationId,
                ticketId,
            },
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
            },
        });

        console.log('[getActivityLog] Found', logs.length, 'activity logs for ticket', ticketId);
        
        // Debug: Log raw data from first log entry
        if (logs.length > 0) {
            console.log('[getActivityLog] Sample raw log:', {
                id: logs[0].id,
                userId: logs[0].userId,
                hasUser: !!logs[0].user,
                userName: logs[0].user?.name,
                userEmail: logs[0].user?.email
            });
        }

        const formattedLogs: ActivityLog[] = logs.map((log: any) => ({
            id: log.id,
            type: log.type,
            details: log.details,
            date: log.createdAt.toISOString(),
            user: (log.user?.name || log.user?.email || 'System'),
            userName: (log.user?.name || log.user?.email || 'System'),
            userEmail: (log.user?.email || ''),
            ticketId: log.ticketId || undefined,
            ticketSubject: log.ticketSubject || undefined,
        }));

        console.log('[getActivityLog] Formatted logs sample:', formattedLogs.length > 0 ? formattedLogs[0] : 'none');
        return formattedLogs;
    } catch (error) {
        console.error('Error fetching activity log:', error);
        return [];
    }
}

export async function getAllActivityLogs(organizationId: string): Promise<ActivityLog[]> {
    if (!organizationId) {
        return [];
    }

    try {
        const logs = await prisma.activityLog.findMany({
            where: { organizationId },
            orderBy: {
                createdAt: 'desc',
            },
            take: 100, // Limit to last 100 activities
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
            },
        });

        const formattedLogs: ActivityLog[] = logs.map((log: any) => ({
            id: log.id,
            type: log.type,
            details: log.details,
            date: log.createdAt.toISOString(),
            user: (log.user?.name || log.user?.email || 'System'),
            userName: (log.user?.name || log.user?.email || 'System'),
            userEmail: (log.user?.email || ''),
            ticketId: log.ticketId || undefined,
            ticketSubject: log.ticketSubject || undefined,
        }));

        return formattedLogs;
    } catch (error) {
        console.error('Error fetching all activity logs:', error);
        return [];
    }
}

export async function getCompanyActivityLogs(organizationId: string, companyId: string): Promise<ActivityLog[]> {
    if (!organizationId || !companyId) {
        return [];
    }

    try {
        // Get all tickets for this company
        const tickets = await prisma.ticket.findMany({
            where: {
                organizationId,
                companyId,
            },
            select: {
                id: true,
            },
        });

        const ticketIds = tickets.map(t => t.id);

        // Get activity logs for these tickets
        const logs = await prisma.activityLog.findMany({
            where: {
                organizationId,
                ticketId: {
                    in: ticketIds,
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 100,
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
            },
        });

        const formattedLogs: ActivityLog[] = logs.map((log: any) => ({
            id: log.id,
            type: log.type,
            details: log.details,
            date: log.createdAt.toISOString(),
            user: (log.user?.name || log.user?.email || 'System'),
            userName: (log.user?.name || log.user?.email || 'System'),
            userEmail: (log.user?.email || ''),
            ticketId: log.ticketId || undefined,
            ticketSubject: log.ticketSubject || undefined,
        }));

        return formattedLogs;
    } catch (error) {
        console.error('Error fetching company activity logs:', error);
        return [];
    }
}

// ============================================================================
// NOTE FUNCTIONS
// ============================================================================

export async function addNoteToTicket(
    organizationId: string,
    ticketId: string,
    noteData: Omit<Note, 'id'>
): Promise<{ success: boolean; error?: string }> {
    if (!organizationId || !ticketId) {
        throw new Error('Organization ID and Ticket ID are required.');
    }

    try {
        await prisma.note.create({
            data: {
                ticketId,
                content: noteData.content,
                user: noteData.user,
                createdAt: new Date(noteData.date),
            },
        });

        // Log the action
        await addActivityLog(organizationId, ticketId, {
            type: 'Note',
            details: 'created a note',
            date: noteData.date,
        });

        return { success: true };
    } catch (error) {
        console.error('Failed to add note:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { success: false, error: errorMessage };
    }
}

export async function getTicketNotes(organizationId: string, ticketId: string): Promise<Note[]> {
    if (!organizationId || !ticketId) {
        return [];
    }

    try {
        const notes = await prisma.note.findMany({
            where: { ticketId },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return notes.map(note => ({
            id: note.id,
            content: note.content,
            date: note.createdAt.toISOString(),
            user: note.user,
        }));
    } catch (error) {
        console.error('Failed to get ticket notes:', error);
        return [];
    }
}

// ============================================================================
// EMAIL SYNC FUNCTIONS - Sync emails from Microsoft Graph to PostgreSQL
// ============================================================================

export async function checkForNewMail(organizationId: string, since: string): Promise<boolean> {
    const settings = await getAPISettings(organizationId);
    if (!settings) {
        return false;
    }
    
    try {
        const accessToken = await getAccessToken(settings);
        const userId = settings.userId;

        const client = Client.init({
            authProvider: (done: any) => {
                done(null, accessToken);
            },
        });

        // Fetch only the most recent email to see if it's newer than `since`
        const response = await client
            .api(`/users/${userId}/mailFolders/inbox/messages`)
            .top(1)
            .select('receivedDateTime')
            .orderby('receivedDateTime DESC')
            .get();

        if (response.value && response.value.length > 0) {
            const latestEmailDate = new Date(response.value[0].receivedDateTime);
            const sinceDate = new Date(since);
            return isAfter(latestEmailDate, sinceDate);
        }

        return false;
    } catch (error) {
        console.error('Error checking for new mail:', error);
        return false;
    }
}

export async function syncEmailsToTickets(organizationId: string, since?: string): Promise<{ success: boolean; error?: string; ticketsCreated?: number }> {
    console.log(`[${organizationId}] Starting email sync...`);
    
    const settings = await getAPISettings(organizationId);
    if (!settings) {
        console.error(`[${organizationId}] Skipping email sync: API credentials not configured.`);
        return { success: false, error: 'API credentials not configured' };
    }

    console.log(`[${organizationId}] Got API settings, userId: ${settings.userId}`);

    try {
        console.log(`[${organizationId}] Acquiring access token...`);
        const accessToken = await getAccessToken(settings);
        const userId = settings.userId;
        console.log(`[${organizationId}] Access token acquired successfully`);

        const client = Client.init({
            authProvider: (done: any) => {
                done(null, accessToken);
            },
        });

        console.log(`[${organizationId}] Fetching latest emails from inbox...`);

        // Build query
        let query = client
            .api(`/users/${userId}/mailFolders/inbox/messages`)
            .top(30)
            .select('id,subject,from,bodyPreview,receivedDateTime,conversationId')
            .orderby('receivedDateTime DESC');

        if (since) {
            query = query.filter(`receivedDateTime gt ${since}`);
        }

        console.log(`[${organizationId}] Executing Graph API query...`);
        const response = await query.get();
        const emailsToProcess = response.value;

        console.log(`[${organizationId}] Found ${emailsToProcess.length} emails to process.`);

        let ticketsCreated = 0;
        for (const email of emailsToProcess) {
            console.log(`[${organizationId}] Processing email: "${email.subject}" from ${email.from.emailAddress.address}`);
            
            if (!email.conversationId) {
                console.log(`[${organizationId}] Skipping email ID ${email.id} - no conversationId.`);
                continue;
            }

            // Skip emails sent from the system's own address
            const senderEmailLower = email.from.emailAddress.address.toLowerCase();
            if (senderEmailLower === userId.toLowerCase()) {
                console.log(`[${organizationId}] Skipping email from system's own address: ${email.subject}`);
                continue;
            }

            // Skip automated replies and system notifications
            const subjectLower = email.subject.toLowerCase();
            const autoReplyKeywords = ['auto:', 'automatic reply', 'out of office', 'undeliverable', 'delivery status notification'];
            const systemNotificationKeywords = ['notification:', 'update on ticket', "you've been assigned", 'ticket created:'];
            
            if (autoReplyKeywords.some(keyword => subjectLower.includes(keyword)) || 
                systemNotificationKeywords.some(keyword => subjectLower.includes(keyword))) {
                console.log(`[${organizationId}] Skipping automated reply/notification: ${email.subject}`);
                continue;
            }

            // Check if ticket already exists for this conversation
            const existingTicket = await prisma.ticket.findFirst({
                where: {
                    organizationId,
                    conversationId: email.conversationId,
                },
            });

            if (existingTicket) {
                console.log(`[${organizationId}] Ticket already exists for conversation ${email.conversationId}`);
                continue;
            }

            // This is a new ticket - fetch full conversation
            console.log(`[${organizationId}] New ticket found from ${senderEmailLower}: ${email.subject}`);
            
            const fullConversation = await fetchAndStoreFullConversation(organizationId, email.conversationId);
            if (!fullConversation || fullConversation.length === 0) {
                console.log(`[${organizationId}] Failed to fetch conversation for ${email.conversationId}`);
                continue;
            }

            const firstMessage = fullConversation[0];

            // Find company if sender is a VERIFIED employee
            let companyId: string | undefined = undefined;
            const employee = await prisma.employee.findFirst({
                where: {
                    email: senderEmailLower,
                    company: {
                        organizationId,
                    },
                },
                select: {
                    companyId: true,
                    status: true,
                },
            });

            // Only create ticket if employee is VERIFIED
            if (employee) {
                if (employee.status !== 'VERIFIED') {
                    console.log(`[${organizationId}] Skipping email from unverified employee ${senderEmailLower} (status: ${employee.status})`);
                    continue;
                }
                companyId = employee.companyId;
                console.log(`[${organizationId}] Found verified employee for ${senderEmailLower}, companyId: ${companyId}`);
            } else {
                console.log(`[${organizationId}] No employee found for ${senderEmailLower}, skipping ticket creation`);
                continue;
            }

            // Get next ticket number
            const ticketNumber = await getNextTicketNumber(organizationId);

            // Create ticket in PostgreSQL
            const newTicket = await prisma.ticket.create({
                data: {
                    organizationId,
                    companyId,
                    ticketNumber,
                    subject: firstMessage.subject || 'No Subject',
                    sender: firstMessage.sender || 'Unknown Sender',
                    senderEmail: firstMessage.senderEmail || senderEmailLower,
                    bodyPreview: firstMessage.bodyPreview || '',
                    body: firstMessage.body?.content || '',
                    bodyContentType: firstMessage.body?.contentType || 'html',
                    receivedDateTime: new Date(firstMessage.receivedDateTime),
                    conversationId: email.conversationId,
                    priority: 'NONE',
                    status: 'OPEN',
                    type: 'QUESTION',
                    hasAttachments: firstMessage.hasAttachments || false,
                },
            });

            console.log(`[${organizationId}] Created new ticket #${ticketNumber} with ID ${newTicket.id}`);
            ticketsCreated++;

            // Store attachments if any
            if (firstMessage.attachments && firstMessage.attachments.length > 0) {
                await prisma.attachment.createMany({
                    data: firstMessage.attachments.map(att => ({
                        ticketId: newTicket.id,
                        name: att.name,
                        contentType: att.contentType,
                        size: att.size,
                        isInline: att.isInline || false,
                        contentId: att.contentId || null,
                    })),
                });
                console.log(`[${organizationId}] Stored ${firstMessage.attachments.length} attachments for ticket #${ticketNumber}`);
            }

            // Add activity log
            await addActivityLog(organizationId, newTicket.id, {
                type: 'Create',
                details: 'Ticket created from email',
                date: firstMessage.receivedDateTime,
            });

            // Send ticket creation notification to client
            const senderEmail = firstMessage.senderEmail || senderEmailLower;
            const senderName = firstMessage.sender || 'Client';
            await sendTicketCreationNotification(
                organizationId,
                newTicket,
                senderEmail,
                senderName
            );
        }

        console.log(`[${organizationId}] Email sync completed successfully. Tickets created: ${ticketsCreated}`);
        return { success: true, ticketsCreated };
    } catch (error: any) {
        console.error(`[${organizationId}] Error syncing emails:`, error);
        console.error(`[${organizationId}] Error message:`, error?.message);
        console.error(`[${organizationId}] Error stack:`, error?.stack);
        if (error?.response) {
            console.error(`[${organizationId}] API Response:`, error.response);
        }
        return { success: false, error: error?.message || 'Unknown error' };
    }
}

export async function fetchAndStoreFullConversation(
    organizationId: string,
    conversationId: string
): Promise<DetailedEmail[]> {
    const settings = await getAPISettings(organizationId);
    if (!settings) {
        throw new Error('API settings are not configured.');
    }

    try {
        const accessToken = await getAccessToken(settings);
        const userId = settings.userId;

        const client = Client.init({
            authProvider: (done: any) => {
                done(null, accessToken);
            },
        });

        // Fetch all messages in the conversation
        // Note: We can't use both filter and orderby as it creates a complex query
        const response = await client
            .api(`/users/${userId}/messages`)
            .filter(`conversationId eq '${conversationId}'`)
            .select('id,subject,from,body,bodyPreview,receivedDateTime,conversationId,hasAttachments,toRecipients,ccRecipients')
            .get();

        const messages: DetailedEmail[] = [];

        // Sort messages by receivedDateTime on client side
        const sortedMessages = response.value.sort((a: any, b: any) => 
            new Date(a.receivedDateTime).getTime() - new Date(b.receivedDateTime).getTime()
        );

        for (const message of sortedMessages) {
            let attachments: Attachment[] = [];
            if (message.hasAttachments) {
                try {
                    const attachmentsResponse = await client
                        .api(`/users/${userId}/messages/${message.id}/attachments`)
                        .get();
                    attachments = attachmentsResponse.value.map((att: any) => ({
                        id: att.id,
                        name: att.name,
                        contentType: att.contentType,
                        size: att.size,
                        isInline: att.isInline,
                        contentId: att.contentId,
                    }));
                } catch (error) {
                    console.error('Error fetching attachments:', error);
                }
            }

            const detailedEmail: DetailedEmail = {
                id: message.id,
                subject: message.subject || '(No Subject)',
                sender: message.from?.emailAddress?.name || 'Unknown',
                senderEmail: message.from?.emailAddress?.address || '',
                bodyPreview: message.bodyPreview || '',
                receivedDateTime: message.receivedDateTime,
                priority: 'Medium',
                status: 'Open',
                type: 'Question',
                conversationId: message.conversationId,
                body: {
                    contentType: message.body?.contentType || 'text',
                    content: message.body?.content || '',
                },
                attachments,
                hasAttachments: message.hasAttachments,
                toRecipients: message.toRecipients,
                ccRecipients: message.ccRecipients,
            };

            messages.push(detailedEmail);
        }

        // Store conversation in PostgreSQL
        await prisma.conversation.upsert({
            where: { id: conversationId },
            create: {
                id: conversationId,
                organizationId,
                messages: messages as any,
            },
            update: {
                messages: messages as any,
                updatedAt: new Date(),
            },
        });

        return messages;
    } catch (error) {
        console.error('Error fetching and storing conversation:', error);
        return [];
    }
}

// ============================================================================
// MICROSOFT GRAPH & AZURE HELPER FUNCTIONS
// ============================================================================

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
    content: string,
    priority?: number,
) {
    if (await recordExistsInCloudflare(type, cfName)) {
        console.log(`⚠️ Record already exists: [${type}] ${cfName}. Skipping.`);
        return;
    }

    const url = `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/dns_records`;
    const payload: any = { type, name: cfName, ttl: 3600 };

    if (type === 'TXT') {
        payload.content = `"${content}"`;
    } else if (type === 'CNAME') {
        payload.content = content;
    } else if (type === 'MX') {
        payload.content = content;
        payload.priority = priority;
    } else {
        payload.content = content;
    }

    const headers = {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
    };

    console.log(`➡️ Adding DNS record to Cloudflare: [${type}] ${cfName} with content ${payload.content}`);

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

async function pollMailboxReady(client: Client, userId: string): Promise<boolean> {
    const maxAttempts = 15;
    let attempt = 0;

    while (attempt < maxAttempts) {
        attempt++;
        try {
            await client.api(`/users/${userId}/mailFolders/inbox`).get();
            console.log(`Mailbox for user ${userId} is ready after ${attempt} attempts.`);
            return true;
        } catch (err: any) {
            if (err.statusCode === 404) {
                console.log(`Attempt ${attempt}: Mailbox not ready yet. Waiting 20 seconds...`);
                await new Promise(r => setTimeout(r, 20000));
            } else {
                throw err;
            }
        }
    }

    throw new Error("Mailbox did not become ready in time.");
}

// ============================================================================
// EMAIL VERIFICATION FUNCTIONS
// ============================================================================

export async function createAndVerifyDomain(organizationId: string): Promise<{ success: boolean; newDomain?: string; error?: string }> {
    try {
        // Get organization from PostgreSQL
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
        });

        if (!organization) {
            throw new Error("Organization not found.");
        }

        // If domain already verified, return it
        if (organization.newDomain) {
            return { success: true, newDomain: organization.newDomain };
        }

        const client = getGraphClient();
        const orgDomainName = organization.domain.split('.')[0];
        const newDomain = `${orgDomainName}.${process.env.NEXT_PUBLIC_PARENT_DOMAIN}`;

        await addDomain(client, newDomain);
        const domainInfo = await getDomain(client, newDomain);

        if (!domainInfo.isVerified) {
            const verificationRecords = await getDomainVerificationRecords(client, newDomain);
            const msTxtRecord = verificationRecords.find((rec: any) => rec.recordType.toLowerCase() === "txt" && rec.text.startsWith("MS="));
            if (!msTxtRecord) throw new Error("Could not find TXT verification record from Azure.");

            await addDnsRecordToCloudflare("TXT", newDomain, msTxtRecord.text);
            await pollDnsPropagation(newDomain, msTxtRecord.text);

            let verified = false;
            let verifyAttempts = 0;
            while (!verified && verifyAttempts < 10) {
                verifyAttempts++;
                try {
                    await verifyDomain(client, newDomain);
                    const updatedDomainInfo = await getDomain(client, newDomain);
                    if (updatedDomainInfo.isVerified) {
                        verified = true;
                    }
                } catch (err) {
                    if (verifyAttempts >= 10) throw err;
                    await new Promise(res => setTimeout(res, 30000));
                }
            }
            if (!verified) throw new Error("Domain verification timed out.");
        }

        // Update organization in PostgreSQL
        await prisma.organization.update({
            where: { id: organizationId },
            data: { newDomain },
        });

        return { success: true, newDomain };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function configureEmailRecords(organizationId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
        });

        if (!organization || !organization.newDomain) {
            throw new Error("Organization domain not found.");
        }

        const newDomain = organization.newDomain;
        const client = getGraphClient();

        const serviceRecords = await getDomainServiceRecords(client, newDomain);
        for (const rec of serviceRecords) {
            const type = rec.recordType.toLowerCase();
            if (type === "mx") {
                await addDnsRecordToCloudflare("MX", newDomain, rec.mailExchange, rec.preference);
            } else if (type === "cname" && rec.label.toLowerCase().includes("autodiscover")) {
                await addDnsRecordToCloudflare("CNAME", rec.label, rec.canonicalName);
            } else if (type === "txt" && rec.text.startsWith("v=spf1")) {
                await addDnsRecordToCloudflare("TXT", newDomain, rec.text);
            }
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function createLicensedUser(
    organizationId: string,
    username: string,
    displayName: string,
    password: string
): Promise<{ success: boolean; userId?: string; userPrincipalName?: string; error?: string }> {
    try {
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
        });

        if (!organization || !organization.newDomain) {
            throw new Error("Organization domain not found.");
        }

        const newDomain = organization.newDomain;
        const client = getGraphClient();

        // Create the user
        const newUser = await createGraphUser(client, displayName, username, newDomain, password);

        // Start background task for license assignment + mailbox polling
        (async () => {
            try {
                await assignLicenseToUser(client, newUser.id);
                await pollMailboxReady(client, newUser.id);
            } catch (err) {
                console.error("Background license/mailbox setup error:", err);
            }
        })();

        return {
            success: true,
            userId: newUser.id,
            userPrincipalName: newUser.userPrincipalName,
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function finalizeUserSetup(
    organizationId: string,
    userId: string,
    userPrincipalName: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Update organization member status and email in PostgreSQL
        await prisma.organizationMember.updateMany({
            where: {
                organizationId,
                userId,
            },
            data: {
                status: 'VERIFIED',
                email: userPrincipalName,
            },
        });

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ============================================================================
// EMPLOYEE VERIFICATION EMAIL
// ============================================================================

export async function sendEmployeeVerificationEmail(
    organizationId: string,
    companyId: string,
    recipientEmail: string,
    recipientName: string
) {
    const settings = await getAPISettings(organizationId);
    if (!settings) {
        throw new Error("API settings are not configured to send emails.");
    }

    // Check if employee exists in PostgreSQL
    const employee = await prisma.employee.findFirst({
        where: {
            companyId,
            email: recipientEmail.toLowerCase(),
        },
    });

    if (!employee) {
        throw new Error("Employee not found in the specified company.");
    }

    // Update the employee's status to 'INVITED'
    await prisma.employee.update({
        where: { id: employee.id },
        data: { status: 'INVITED' },
    });

    const parentDomain = process.env.NEXT_PUBLIC_PARENT_DOMAIN;
    const signupUrl = `https://${parentDomain}/member-signup`;

    const subject = "You've been invited to your company's support portal";
    const body = `
        <p>Hello ${recipientName},</p>
        <p>You have been invited to join your company's support ticketing portal.</p>
        <p>Please complete your registration by visiting the following link:</p>
        <p><a href="${signupUrl}">${signupUrl}</a></p>
        <p>Once registered, you will be able to submit and manage support tickets.</p>
    `;

    await sendEmailAction(organizationId, {
        recipient: recipientEmail,
        subject: subject,
        body: body,
    });

    return { success: true };
}

// ============================================================================
// GET EMAIL/TICKET DETAILS
// ============================================================================

export async function getEmail(organizationId: string, id: string): Promise<DetailedEmail | null> {
    if (!organizationId || !id) {
        throw new Error("Organization ID and Ticket ID must be provided.");
    }

    console.log(`[getEmail] Looking for ticket with ID: ${id}, orgId: ${organizationId}`);

    // Get ticket from PostgreSQL
    const ticket = await prisma.ticket.findFirst({
        where: {
            id,
            organizationId,
        },
        include: {
            tags: true,
            assignee: {
                select: {
                    id: true,
                    name: true,
                },
            },
            company: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });

    if (!ticket) {
        console.log(`[getEmail] Ticket not found in database for ID: ${id}`);
        return null;
    }
    
    console.log(`[getEmail] Found ticket #${ticket.ticketNumber}: ${ticket.subject}`);

    const conversationId = ticket.conversationId;
    let conversationMessages: DetailedEmail[] = [];

    if (conversationId) {
        // Get conversation from PostgreSQL
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
        });

        if (conversation && conversation.messages) {
            conversationMessages = conversation.messages as any as DetailedEmail[];
        }
    }

    // For manual tickets, build better placeholder
    if (conversationId && conversationId.startsWith('manual-') && conversationMessages.length > 0) {
        const firstMessage = conversationMessages[0];
        if (!firstMessage.toRecipients) {
            const settings = await getAPISettings(organizationId);
            if (settings) {
                firstMessage.toRecipients = [{ emailAddress: { name: 'Support', address: settings.userId } }];
            }
        }
    }

    if (conversationMessages.length === 0) {
        // Create placeholder from ticket data
        const placeholderEmail: DetailedEmail = {
            id: ticket.id,
            subject: ticket.subject || 'No Subject',
            sender: ticket.sender || 'Unknown Sender',
            senderEmail: ticket.senderEmail || 'Unknown Email',
            bodyPreview: ticket.bodyPreview || '',
            receivedDateTime: ticket.receivedDateTime.toISOString(),
            priority: mapEnumToPriority(ticket.priority),
            status: mapEnumToStatus(ticket.status),
            type: mapEnumToType(ticket.type),
            conversationId: ticket.conversationId || undefined,
            tags: ticket.tags.map(t => t.tag),
            deadline: ticket.deadline?.toISOString(),
            closedAt: ticket.closedAt?.toISOString(),
            ticketNumber: ticket.ticketNumber,
            companyId: ticket.companyId || undefined,
            companyName: ticket.company?.name,
            assignee: ticket.assignee?.id || undefined,
            assigneeName: ticket.assignee?.name || 'Unassigned',
            creator: ticket.creatorId ? { name: ticket.sender, email: ticket.senderEmail } : undefined,
            body: { contentType: 'html', content: ticket.body || ticket.bodyPreview || '<p>Full email content is not available yet.</p>' }
        };
        conversationMessages.push(placeholderEmail);
    }

    const mainEmailDetails: DetailedEmail = {
        id: ticket.id,
        subject: ticket.subject,
        sender: ticket.sender,
        senderEmail: ticket.senderEmail,
        bodyPreview: ticket.bodyPreview,
        receivedDateTime: ticket.receivedDateTime.toISOString(),
        priority: mapEnumToPriority(ticket.priority),
        status: mapEnumToStatus(ticket.status),
        type: mapEnumToType(ticket.type),
        conversationId: ticket.conversationId || undefined,
        tags: ticket.tags.map(t => t.tag),
        deadline: ticket.deadline?.toISOString(),
        closedAt: ticket.closedAt?.toISOString(),
        ticketNumber: ticket.ticketNumber,
        companyId: ticket.companyId || undefined,
        companyName: ticket.company?.name,
        assignee: ticket.assignee?.id || undefined,
        assigneeName: ticket.assignee?.name || 'Unassigned',
        creator: ticket.creatorId ? { name: ticket.sender, email: ticket.senderEmail } : undefined,
        body: conversationMessages[0]?.body || { contentType: 'html', content: ticket.body || ticket.bodyPreview || '<p>Full email content not available.</p>' },
        conversation: conversationMessages.map(convMsg => ({
            ...convMsg,
            id: convMsg.id,
            subject: convMsg.subject,
            sender: convMsg.sender,
            senderEmail: convMsg.senderEmail,
            receivedDateTime: convMsg.receivedDateTime,
            body: convMsg.body,
        })),
    };

    return mainEmailDetails;
}

// Export all functions
