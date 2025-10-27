# Activity Log Implementation

## Overview
Activity logs track all changes and actions performed on tickets throughout the system. This document explains how activity logs work and where they are displayed.

## Database Schema

### ActivityLog Model
```prisma
model ActivityLog {
  id            String   @id @default(cuid())
  organizationId String
  ticketId      String?
  ticketSubject String?
  type          String   // Create, Status, Priority, Assignee, Deadline, Tags, Company, Forward, Note, etc.
  details       String   // Description of the change
  userId        String?  // User who made the change
  userName      String?
  userEmail     String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

## Activity Log Types

- **Create**: Ticket created
- **Status**: Status changed (Open, Pending, Resolved, Closed, Archived)
- **Priority**: Priority changed (None, Low, Medium, High, Urgent)
- **Assignee**: Ticket assigned to a team member
- **Deadline**: Deadline set or modified
- **Tags**: Tags added or removed
- **Company**: Company association changed
- **Forward**: Ticket forwarded to another email
- **Note**: Internal note added (not shown in activity timeline)
- **Type**: Ticket type changed (Question, Incident, Problem, Feature Request)

## Where Activity Logs Are Displayed

### 1. Ticket Detail Page (`/tickets/[id]`)
**Location**: Right sidebar under "Activity" section

**Features**:
- Shows all activities for the specific ticket
- Excludes "Note" type activities (notes have their own section)
- Updates in real-time with smart polling
- Displays:
  - Activity type icon
  - User who performed the action
  - Activity description
  - Timestamp

**Code**: `/src/components/ticket-detail-content.tsx`
```tsx
{activityLog.filter(log => log.type !== 'Note').map((log) => (
    <TimelineItem key={log.id} type={log.type} date={log.date} user={log.user}>
        {log.details}
    </TimelineItem>
))}
```

### 2. Dashboard Analytics View (`/dashboard?view=analytics`)
**Location**: Bottom section titled "All Activity"

**Features**:
- Shows last 100 activities across all tickets
- Filtered by user role:
  - **Admin/Owner**: Sees all activities
  - **Agent**: Sees only activities for assigned tickets
  - **Client**: Not displayed (clients don't see analytics)
- Each activity links to its ticket
- Scrollable list with max height
- Displays:
  - Activity type icon
  - User who performed the action
  - Activity description
  - Ticket subject (clickable link)
  - Timestamp

**Code**: `/src/components/dashboard-view.tsx`
```tsx
<Card>
    <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            All Activity
        </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4 max-h-96 overflow-y-auto">
        {filteredData.agentFilteredLogs.map((log) => (
            <TimelineItem key={log.id} type={log.type} date={log.date} user={log.user}>
                <div className="flex flex-wrap items-center gap-x-2">
                   <span>{log.details} on ticket</span> 
                   <Link href={`/tickets/${log.ticketId}`}>
                        {log.ticketSubject}
                   </Link>
                </div>
            </TimelineItem>
        ))}
    </CardContent>
</Card>
```

## API Functions

### Add Activity Log
```typescript
await addActivityLog(organizationId, ticketId, {
    type: 'Status',
    details: 'Status changed from Open to Resolved',
    date: new Date().toISOString(),
    user: userEmail,
    ticketSubject: ticketSubject,
});
```

### Get Activity Log for a Ticket
```typescript
const logs = await getActivityLog(organizationId, ticketId);
```

### Get All Activity Logs
```typescript
const allLogs = await getAllActivityLogs(organizationId);
```

## When Activity Logs Are Created

Activity logs are automatically created when:

1. **Ticket Creation**
   - From email sync
   - From portal submission
   - Manual creation

2. **Ticket Updates**
   - Status change
   - Priority change
   - Assignee change
   - Deadline set/modified
   - Tags added/removed
   - Company association changed
   - Type changed

3. **Ticket Actions**
   - Email reply sent
   - Ticket forwarded
   - Note added

## Activity Log Components

### TimelineItem Component
**Location**: `/src/components/timeline-item.tsx`

Displays a single activity with:
- Icon based on activity type
- User name/email
- Activity description
- Formatted timestamp
- Color-coded by activity type

### Icons by Activity Type
- **Tags**: Purple tag icon
- **Deadline**: Red calendar icon
- **Assignee**: Blue user check icon
- **Priority**: Orange shield icon
- **Status**: Green check circle icon
- **Type**: Indigo file type icon
- **Company**: Pink building icon
- **Create**: Green pencil icon
- **Forward**: Teal forward icon
- **Note**: Yellow message square icon

## Real-time Updates

Both the ticket detail page and dashboard use smart polling:
- **Active**: Polls every 10 seconds when user is active
- **Idle**: Polls every 30 seconds after 2 minutes of inactivity
- **Hidden Tab**: Stops polling, resumes when tab becomes visible

## Filtering

### Dashboard Activity Filtering
- By company (dropdown filter)
- By date range (7d, 30d, 90d, custom, all time)
- By user role (automatic)

### Ticket Detail Activity Filtering
- Automatically excludes "Note" type activities
- Shows only activities for the current ticket

## Best Practices

1. **Always include ticket subject** when creating activity logs
2. **Use descriptive details** that clearly explain what changed
3. **Include user information** (email or ID) for accountability
4. **Use appropriate activity types** for consistency
5. **Don't log sensitive information** in activity details

## Troubleshooting

### Activity logs not showing in ticket detail
- Check that `getActivityLog()` is being called in `fetchEmailData()`
- Verify `activityLog` state is being set
- Ensure activity logs are not filtered out by type

### Activity logs not showing in dashboard
- Check that `getAllActivityLogs()` is being called
- Verify user has proper permissions
- Check company and date filters

### Activity logs not being created
- Ensure `addActivityLog()` is called after ticket updates
- Check that organizationId and ticketId are provided
- Verify database connection and schema

## Recent Changes

✅ **Fixed**: Activity logs now properly fetch and display in ticket detail page
✅ **Fixed**: Dashboard "All Activity" section now works correctly
✅ **Implemented**: Real-time updates for activity logs
✅ **Implemented**: Role-based filtering for activity logs
