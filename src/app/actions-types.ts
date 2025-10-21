// Type definitions for the application
// These types are shared across the codebase

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
    tags?: string[];
    deadline?: string;
    closedAt?: string;
    ticketNumber?: number;
    companyId?: string;
    assignee?: string;
    creator?: { name: string; email: string; };
}

export interface Attachment {
    id: string;
    name: string;
    contentType: string;
    size: number;
    isInline: boolean;
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
    userName: string;
    userEmail: string;
    user?: string; // Legacy field for compatibility
    ticketId?: string;
    ticketSubject?: string;
}

export interface Recipient {
    emailAddress: {
        name: string;
        address: string;
    };
}

export interface DetailedEmail extends Email {
    body: {
        contentType: string;
        content: string;
    };
    conversation?: DetailedEmail[];
    hasAttachments?: boolean;
    attachments?: Attachment[];
    toRecipients?: Recipient[];
    ccRecipients?: Recipient[];
    bccRecipients?: Recipient[];
}

export interface Note {
    id: string;
    content: string;
    date: string;
    author: string;
    authorEmail: string;
}

export interface DeadlineSettings {
    Urgent: number;
    High: number;
    Medium: number;
    Low: number;
}
