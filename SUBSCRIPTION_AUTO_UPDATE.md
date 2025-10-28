# Automatic Subscription Price Updates

## Overview

The subscription system now **automatically updates** the agent count and total price when you add or remove agents from your organization.

## How It Works

### When You Add an Agent

1. **Add agent** via Organization Members page
2. **System counts** all non-client members
3. **Subscription updates** automatically:
   - `agentCount` = new count
   - `totalAmount` = agentCount × ₱500

### When You Remove an Agent

1. **Delete agent** from Organization Members
2. **System recounts** remaining agents
3. **Subscription updates** automatically:
   - `agentCount` = new count
   - `totalAmount` = agentCount × ₱500

## Example

**Initial State:**
- 3 agents
- Total: ₱1,500/month

**Add 2 agents:**
- 5 agents
- Total: ₱2,500/month ✅ (auto-updated)

**Remove 1 agent:**
- 4 agents
- Total: ₱2,000/month ✅ (auto-updated)

## Technical Details

### Functions Modified

**`addMemberToOrganization()`** - `/src/app/actions-new.ts`
```typescript
// After creating member
await updateSubscriptionAgentCount(organizationId);
```

**`deleteMemberFromOrganization()`** - `/src/app/actions-new.ts`
```typescript
// After deleting member
await updateSubscriptionAgentCount(organizationId);
```

### What Gets Updated

The `updateSubscriptionAgentCount()` function:
1. Counts all `OrganizationMember` where `isClient = false`
2. Updates `Subscription` table:
   - `agentCount` = new count
   - `totalAmount` = agentCount × pricePerAgent (₱500)

### Error Handling

- If subscription update fails, **member add/delete still succeeds**
- Error is logged to console
- User is not notified (silent failure)
- Subscription can be manually refreshed later

## Viewing Updated Price

**To see the updated price:**
1. Go to **Settings** → **Subscription & Billing**
2. The **Monthly Cost** will show the updated amount
3. **Active Agents** count will reflect current number

## Agent Counting Rules

**Counted as agents (billable):**
- `OrganizationMember` with `isClient = false`
- Includes: Admins, Support Agents, Team Members

**NOT counted as agents (free):**
- `OrganizationMember` with `isClient = true`
- These are your customers/clients

## Manual Update

If the count gets out of sync, you can manually trigger an update:

**Option 1: Via Code**
```typescript
import { updateSubscriptionAgentCount } from '@/app/actions-subscription';
await updateSubscriptionAgentCount(organizationId);
```

**Option 2: Via Database**
1. Open Prisma Studio: `npm run prisma:studio`
2. Go to `Subscription` table
3. Find your organization's subscription
4. Update `agentCount` and `totalAmount` manually

**Option 3: Refresh Page**
- The subscription view recalculates on load
- Just refresh the Subscription & Billing page

## Testing

### Test Adding Agents

1. Go to **Organization** → **Members**
2. Click **Add Member**
3. Fill in details (make sure `isClient` is unchecked)
4. Save
5. Go to **Settings** → **Subscription & Billing**
6. Verify agent count and price increased

### Test Removing Agents

1. Go to **Organization** → **Members**
2. Delete a member
3. Go to **Settings** → **Subscription & Billing**
4. Verify agent count and price decreased

## Troubleshooting

### Price Not Updating

**Check Console Logs:**
```
Failed to update subscription agent count: <error>
```

**Common Issues:**
1. **Subscription doesn't exist** - Create one first
2. **Database connection** - Check database is running
3. **Prisma client outdated** - Run `npm run prisma:generate`

**Fix:**
1. Restart dev server
2. Manually trigger update
3. Check database for subscription record

### Wrong Agent Count

**Verify in Database:**
```sql
SELECT COUNT(*) FROM "OrganizationMember" 
WHERE "organizationId" = 'your-org-id' 
AND "isClient" = false;
```

**Fix:**
- Make sure `isClient` field is set correctly
- Clients should have `isClient = true`
- Agents should have `isClient = false`

## Future Enhancements

### Potential Improvements

1. **Real-time Updates**
   - WebSocket notifications when price changes
   - Toast notification: "Subscription updated to ₱2,500/month"

2. **Price Change History**
   - Log all agent count changes
   - Show history in Subscription page

3. **Prorated Billing**
   - Calculate prorated amount when adding mid-month
   - Charge difference immediately

4. **Agent Limits**
   - Set maximum agents per plan
   - Block adding agents if limit reached

5. **Bulk Operations**
   - Add multiple agents at once
   - Single subscription update after all adds

## Related Files

- `/src/app/actions-new.ts` - Member add/delete functions
- `/src/app/actions-subscription.ts` - Subscription update logic
- `/src/components/subscription-view.tsx` - UI display
- `/prisma/schema.prisma` - Database models

## Summary

✅ **Automatic Updates** - No manual intervention needed  
✅ **Real-time Pricing** - Always shows current cost  
✅ **Error Handling** - Graceful failures  
✅ **Simple Logic** - Count agents × ₱500  

The subscription price now updates automatically whenever you add or remove agents! 🎉
