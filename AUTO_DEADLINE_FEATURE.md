# Automatic Deadline Setting Feature

## Overview
When a ticket's priority is changed, the system automatically calculates and sets a deadline based on the organization's deadline configuration settings.

## How It Works

### 1. Deadline Configuration
Organization owners can configure deadline settings in **Settings** page:

- **Urgent**: Default 1 day
- **High**: Default 2 days  
- **Medium**: Default 3 days
- **Low**: Default 4 days

These values can be customized per organization.

### 2. Automatic Deadline Calculation
When a user changes a ticket's priority:

1. **System checks** if deadline settings exist for the organization
2. **Retrieves** the number of days configured for that priority level
3. **Calculates** new deadline: `Current Date + Configured Days`
4. **Updates** both priority and deadline in a single transaction
5. **Displays** toast notification with the new priority and deadline
6. **Refreshes** ticket data to show updated information

### 3. Example Flow

**Scenario**: Admin changes ticket priority from "None" to "High"

```
Organization Settings:
- High Priority = 2 days

Action:
1. User selects "High" priority
2. System calculates: Today + 2 days = Deadline
3. Both priority and deadline are updated
4. Toast shows: "Priority changed to High and deadline set to Dec 25, 2024"
```

## Implementation Details

### Code Location
**File**: `/src/components/ticket-detail-content.tsx`

**Function**: `handleSelectChange()`

### Logic Flow
```typescript
const handleSelectChange = async (field, value) => {
    // ... other field handling ...
    
    // Auto-set deadline when priority changes
    if (field === 'priority' && value && value !== 'None' && userProfile?.deadlineSettings) {
        const deadlineSettings = userProfile.deadlineSettings as DeadlineSettings;
        const daysToAdd = deadlineSettings[value as keyof DeadlineSettings];
        
        if (daysToAdd !== undefined && daysToAdd > 0) {
            const newDeadline = new Date();
            newDeadline.setDate(newDeadline.getDate() + daysToAdd);
            
            // Update both priority and deadline together
            await updateTicket(organizationId, ticketId, { 
                priority: value,
                deadline: newDeadline.toISOString()
            });
            
            // Show success notification
            toast({
                title: 'Ticket Updated',
                description: `Priority changed to ${label} and deadline set to ${format(newDeadline, 'PPP')}`,
            });
            
            // Refresh ticket data
            await fetchEmailData(false);
        }
    }
}
```

### Database Schema
```typescript
interface DeadlineSettings {
    Urgent: number;   // Days
    High: number;     // Days
    Medium: number;   // Days
    Low: number;      // Days
}
```

Stored in `Organization.deadlineSettings` as JSON.

## User Experience

### Before Priority Change
- Ticket has priority: "None"
- Ticket has no deadline

### After Priority Change to "High"
- Ticket priority: "High"
- Ticket deadline: Automatically set to 2 days from now (based on settings)
- User sees toast: "Priority changed to High and deadline set to Dec 25, 2024"
- Activity log records both changes

### Visual Feedback
1. **Immediate UI Update**: Priority and deadline fields update instantly
2. **Toast Notification**: Clear message about both changes
3. **Activity Log**: Records the priority change and deadline setting
4. **Deadline Badge**: Shows days remaining with color coding

## Edge Cases Handled

### 1. Priority Set to "None"
- **Behavior**: No automatic deadline is set
- **Reason**: "None" priority doesn't require a deadline

### 2. No Deadline Settings Configured
- **Behavior**: Only priority is updated, no deadline is set
- **Fallback**: Uses default values (Urgent: 1, High: 2, Medium: 3, Low: 4)

### 3. Deadline Settings = 0 Days
- **Behavior**: No deadline is set
- **Reason**: 0 days means no deadline requirement

### 4. Manual Deadline Override
- **Behavior**: User can still manually change the deadline after priority change
- **Method**: Click on deadline field and select a different date

## Activity Log Tracking

When priority changes with automatic deadline:

**Two activity log entries are created:**

1. **Priority Change**
   ```
   Type: Priority
   Details: "Priority changed from None to High"
   User: admin@example.com
   Date: 2024-10-27 10:45 AM
   ```

2. **Deadline Set**
   ```
   Type: Deadline
   Details: "Deadline set to Dec 25, 2024"
   User: admin@example.com
   Date: 2024-10-27 10:45 AM
   ```

## Configuration

### Setting Deadline Defaults
1. Navigate to **Settings** page
2. Scroll to **Deadline Settings** section
3. Click **Edit** button
4. Enter days for each priority level:
   - Urgent: [1-365] days
   - High: [1-365] days
   - Medium: [1-365] days
   - Low: [1-365] days
5. Click **Save Changes**

### Best Practices
- **Urgent**: 1-2 days (immediate attention)
- **High**: 2-3 days (quick response)
- **Medium**: 3-7 days (normal timeline)
- **Low**: 7-14 days (flexible timeline)

## Benefits

1. **Consistency**: All tickets with same priority get same deadline timeframe
2. **Automation**: Reduces manual work for agents
3. **SLA Compliance**: Ensures tickets have appropriate deadlines
4. **Visibility**: Clear expectations for resolution time
5. **Flexibility**: Organization can customize based on their needs

## Future Enhancements

Potential improvements:
- Business days calculation (excluding weekends)
- Different deadline settings per company/client
- Deadline escalation rules
- Automatic priority adjustment based on deadline proximity
- Email notifications when deadline is approaching

## Troubleshooting

### Deadline Not Setting Automatically
**Check:**
1. Organization has deadline settings configured
2. Priority is not "None"
3. Deadline setting for that priority > 0
4. User has permission to update tickets

### Wrong Deadline Calculated
**Check:**
1. Organization's deadline settings values
2. System timezone configuration
3. Current date/time on server

### Deadline Overwritten
**Expected Behavior**: Each priority change recalculates deadline
**Solution**: If you want to keep custom deadline, set it AFTER changing priority

## Related Files

- `/src/components/ticket-detail-content.tsx` - Main implementation
- `/src/components/settings-form.tsx` - Deadline settings UI
- `/src/app/actions-types.ts` - DeadlineSettings interface
- `/src/app/actions-new.ts` - updateOrganization function
- `/prisma/schema.prisma` - Organization model with deadlineSettings

## Testing

### Test Scenarios

1. **Change priority from None to High**
   - ✅ Deadline should be set to 2 days from now
   - ✅ Toast shows both changes
   - ✅ Activity log has 2 entries

2. **Change priority from High to Urgent**
   - ✅ Deadline should update to 1 day from now
   - ✅ Previous deadline is overwritten

3. **Change priority to None**
   - ✅ Priority updates to None
   - ✅ No automatic deadline is set

4. **Organization without deadline settings**
   - ✅ Only priority updates
   - ✅ No error occurs

5. **Manual deadline change after priority change**
   - ✅ User can override automatic deadline
   - ✅ Manual deadline persists
