# Priority Change Email Notifications

## Overview
When a ticket's priority is changed, the system automatically sends an email notification to the assigned agent, informing them about the new priority and deadline.

## How It Works

### Trigger Conditions
Email notification is sent when **ALL** of the following conditions are met:
1. ✅ Priority is changed (to any value including "None")
2. ✅ Ticket has an assigned agent
3. ✅ API/Email settings are configured
4. ✅ Agent has a valid email address

### What Gets Sent

**Email Subject:**
```
Priority Updated: Ticket #123 - [Ticket Subject]
```

**Email Content Includes:**
- 🔔 Priority change notification header
- Ticket number and subject
- 🎯 New priority (highlighted in red, bold)
- ⏰ New deadline (if set) - formatted as "Monday, December 25, 2024"
- Current status
- Direct link to view the ticket
- Call to action button

### Email Template

The email is professionally formatted with:
- **Yellow highlight box** for important information
- **Bold red text** for new priority
- **Large red text** for deadline
- **Blue action button** to view ticket
- Responsive HTML design
- Automated system signature

### Example Scenarios

#### Scenario 1: Priority Changed to "High" (with deadline)
```
Subject: Priority Updated: Ticket #456 - Server Down

Content:
🔔 Ticket Priority Changed

Hello John Doe,

The priority of a ticket assigned to you has been updated:

┌─────────────────────────────────────┐
│ Ticket #: 456                       │
│ Subject: Server Down                │
│ 🎯 New Priority: High               │
│ ⏰ New Deadline: Monday, Dec 25, 2024│
│ Status: Open                        │
└─────────────────────────────────────┘

[View Ticket Button]

Please review this ticket and take appropriate action based on the new priority level.
```

#### Scenario 2: Priority Changed to "None" (deadline cleared)
```
Subject: Priority Updated: Ticket #456 - Server Down

Content:
🔔 Ticket Priority Changed

Hello John Doe,

The priority of a ticket assigned to you has been updated:

┌─────────────────────────────────────┐
│ Ticket #: 456                       │
│ Subject: Server Down                │
│ 🎯 New Priority: None               │
│ Deadline: Not set                   │
│ Status: Open                        │
└─────────────────────────────────────┘

[View Ticket Button]

Please review this ticket and take appropriate action based on the new priority level.
```

## Implementation Details

### Code Location
**File**: `/src/app/actions-new.ts`

**Function**: `sendPriorityChangeNotification()`

### Email Sending Logic
```typescript
// In updateTicket function
if (data.priority !== undefined && updatedTicket.assigneeId) {
    // Get assignee details
    const assignee = await prisma.user.findUnique({
        where: { id: updatedTicket.assigneeId },
        include: { memberships: { where: { organizationId } } }
    });
    
    // Send notification
    if (assignee && assignee.memberships.length > 0) {
        await sendPriorityChangeNotification(
            organizationId,
            updatedTicket,
            assigneeEmail,
            assigneeName,
            data.priority
        );
    }
}
```

### Email Service
- Uses **Microsoft Graph API** to send emails
- Sent from organization's configured email address
- Appears in agent's inbox immediately
- HTML formatted for better readability

## When Notifications Are Sent

### ✅ Notification WILL be sent:
- Priority changed from "None" to "High" (with deadline)
- Priority changed from "High" to "Urgent" (deadline updated)
- Priority changed from "Medium" to "None" (deadline cleared)
- Priority changed from "Low" to "High" (deadline updated)

### ❌ Notification will NOT be sent:
- Ticket has no assigned agent
- Priority is not changed (only deadline changed)
- API/Email settings not configured
- Agent email is invalid or missing

## User Experience

### For Admins/Managers
1. Change ticket priority from ticket list or detail page
2. System automatically calculates deadline
3. Updates ticket in database
4. Sends email notification to assigned agent
5. Shows toast: "Priority changed to High and deadline set to Dec 25, 2024"

### For Assigned Agents
1. Receives email notification immediately
2. Email clearly shows new priority and deadline
3. Can click "View Ticket" button to go directly to ticket
4. Can see all ticket details in the email itself

## Benefits

1. **Immediate Awareness**: Agents know right away when priority changes
2. **Clear Deadlines**: Exact deadline date is prominently displayed
3. **Actionable**: Direct link to ticket for quick access
4. **Professional**: Well-formatted HTML email
5. **Audit Trail**: Email serves as record of priority change

## Configuration Requirements

### Environment Variables
```bash
# Microsoft Graph API credentials
AZURE_CLIENT_ID=your_client_id
AZURE_TENANT_ID=your_tenant_id
AZURE_CLIENT_SECRET=your_client_secret

# Base domain for ticket links
NEXT_PUBLIC_PARENT_DOMAIN=yourdomain.com
```

### Organization Settings
- Organization must have verified admin email
- Email must be configured in organization settings
- Microsoft 365 account must have send mail permissions

## Error Handling

### Email Sending Failures
- **Logged** to console with error details
- **Does NOT fail** the priority update
- Ticket priority and deadline still update successfully
- User sees success toast even if email fails

### Common Issues
1. **API credentials not configured**: Email skipped silently
2. **Invalid assignee email**: Email skipped, logged as error
3. **Microsoft Graph API error**: Logged, ticket still updated
4. **Network timeout**: Logged, ticket still updated

## Testing

### Test Scenarios

1. **Change priority with assigned agent**
   - ✅ Email should be sent
   - ✅ Check agent's inbox
   - ✅ Verify deadline in email matches calculated deadline

2. **Change priority without assigned agent**
   - ✅ No email should be sent
   - ✅ Priority still updates

3. **Change priority to "None"**
   - ✅ Email shows "Deadline: Not set"
   - ✅ Priority updates to None

4. **Change priority multiple times**
   - ✅ Each change sends a new email
   - ✅ Latest email has correct deadline

## Related Features

- **Automatic Deadline Setting**: Priority change triggers deadline calculation
- **Activity Logs**: Priority change is recorded in activity log
- **Assignment Notifications**: Similar email sent when agent is assigned
- **Deadline Reminders**: Separate system for deadline approaching notifications

## Future Enhancements

Potential improvements:
- Email digest (batch multiple changes)
- Customizable email templates
- SMS notifications for urgent priorities
- In-app notifications
- Email preferences per agent
- Priority escalation alerts

## Troubleshooting

### Email Not Received

**Check:**
1. Agent is assigned to the ticket
2. Agent has valid email in their profile
3. Microsoft Graph API credentials are configured
4. Organization email settings are set up
5. Check spam/junk folder
6. Check server logs for errors

### Wrong Deadline in Email

**Check:**
1. Organization deadline settings are correct
2. Priority value matches deadline settings key
3. Server timezone is correct
4. Deadline calculation logic is working

### Email Formatting Issues

**Check:**
1. Email client supports HTML
2. Images/styles are loading
3. Email template syntax is correct
4. Microsoft Graph API is rendering HTML properly

## Related Files

- `/src/app/actions-new.ts` - Main implementation
- `/src/components/ticket-detail-content.tsx` - Ticket detail priority change
- `/src/components/ticket-item.tsx` - Ticket list priority change
- `/AUTO_DEADLINE_FEATURE.md` - Automatic deadline documentation
- `/ACTIVITY_LOG_IMPLEMENTATION.md` - Activity logging documentation
