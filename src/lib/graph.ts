import type { Settings } from '@/providers/settings-provider';

export interface Email {
    id: string;
    subject: string;
    sender: string;
}

export interface NewEmail {
    recipient: string;
    subject: string;
    body: string;
}

// This is a mock function. A real implementation would require
// getting an OAuth2 access token and calling the Microsoft Graph API.
export async function getLatestEmails(settings: Settings): Promise<Email[]> {
    console.log("Fetching emails with settings:", { ...settings, clientSecret: '[REDACTED]' });

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simulate error if credentials are not 'correct' (for demonstration)
    if (settings.clientId.includes('error')) {
        throw new Error("Invalid credentials provided. Check your settings.");
    }

    // Return mock data
    return [
        { id: '1', subject: 'Project Phoenix: Final Design Review and Next Steps for Q3', sender: 'Katherine Moss' },
        { id: '2', subject: 'Your weekly summary: 5 tasks due, 2 upcoming meetings', sender: 'ProjectHub' },
        { id: '3', subject: 'Re: Marketing Campaign Budget - Urgent Approval Needed', sender: 'David Chen' },
        { id: '4', subject: 'Lunch tomorrow? 🍱', sender: 'Emily Carter' },
        { id: '5', subject: 'Security Alert: New sign-in to your account', sender: 'Microsoft Security' },
        { id: '6', subject: 'FW: Important Update on Company-Wide Health Policy', sender: 'HR Department' },
        { id: '7', subject: 'Your Cloud Services Invoice for May 2024 is ready', sender: 'Cloud Billing' },
        { id: '8', subject: 'Thanks for your order! Here are the details and tracking information.', sender: 'The Online Store' },
        { id: '9', subject: 'A very long subject line to test the truncation feature that should definitely be applied to this element because it is just way too long to fit in a single line on the screen', sender: 'Spam Master 3000' },
        { id: '10', subject: "You're invited: Team Offsite Planning Session", sender: 'Maria Garcia' },
    ].slice(0, 10);
}

// This is a mock function for sending an email.
export async function sendEmail(settings: Settings, emailData: NewEmail): Promise<{ success: boolean }> {
    console.log("Sending email with settings:", { ...settings, clientSecret: '[REDACTED]' });
    console.log("Email data:", emailData);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate error
    if (emailData.recipient.includes('fail')) {
        throw new Error("Recipient address is blocked by policy.");
    }

    return { success: true };
}
