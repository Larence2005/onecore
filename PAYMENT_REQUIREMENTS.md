# Payment Requirements for Adding Agents

## Overview
Organization owners (admins) must have an active subscription with no pending payments before they can add new agents to their organization.

## Pricing Model
- **$10 USD per agent per month**
- This includes the admin/owner
- Each additional agent increases the monthly cost by $10

## Rules for Adding Agents

### ✅ **Can Add Agents When:**
1. **Trial Period** - Organization is in the 14-day free trial
2. **Active Subscription** - Organization has paid and subscription is active
3. **No Pending Payments** - All previous payments have been completed

### ❌ **Cannot Add Agents When:**
1. **Pending Payments** - There are unpaid invoices
   - Error: "You have pending payments. Please complete your payment before adding new agents."

2. **Past Due** - Subscription payment is overdue
   - Error: "Your subscription is past due. Please renew your subscription to add new agents."

3. **Canceled** - Subscription has been canceled
   - Error: "Your subscription is canceled. Please renew your subscription to add new agents."

4. **Expired** - Subscription has expired
   - Error: "Your subscription is expired. Please renew your subscription to add new agents."

5. **No Subscription** - Organization hasn't set up subscription yet
   - Error: "No subscription found. Please set up your subscription first."

## Implementation

### Server-Side Validation (`actions-subscription.ts`)
```typescript
canAddMembers(organizationId: string)
```
- Checks subscription status
- Verifies no pending payments exist
- Returns whether adding members is allowed and reason if not

### Client-Side Check (`organization-view.tsx`)
- Before adding a member, calls `canAddMembers()`
- Shows error toast if not allowed
- Prevents API call if validation fails

## User Flow

### Adding First Agent (During Trial)
1. Owner creates organization → 14-day trial starts
2. Owner can add agents freely during trial
3. Each agent added increases monthly cost calculation

### Adding Agent (After Trial)
1. Owner tries to add agent
2. System checks:
   - Is subscription active?
   - Are there pending payments?
3. If validation passes → Agent added
4. If validation fails → Error message shown with reason

### Payment Required Scenario
1. Owner has pending payment
2. Tries to add new agent
3. System blocks with message: "You have pending payments. Please complete your payment before adding new agents."
4. Owner goes to Settings → Subscription & Billing
5. Completes pending payment
6. Can now add agents

## Cost Calculation Example

### Scenario 1: Owner + 2 Agents
- **Total agents:** 3 (1 owner + 2 agents)
- **Monthly cost:** $30 USD
- **PHP equivalent:** ~₱1,770 (at 1 USD = 59 PHP)

### Scenario 2: Adding 3rd Agent
- **Current:** 3 agents = $30/month
- **After adding:** 4 agents = $40/month
- **Increase:** +$10/month

## Notifications

### On Successful Add
```
Title: "Agent Added"
Description: "{Name} has been invited to the organization. 
Note: Adding agents increases your monthly cost by $10 per agent."
```

### On Blocked Add
```
Title: "Cannot Add Agent"
Description: "{Specific reason based on subscription status}"
Duration: 5 seconds (longer to ensure user reads it)
```

## Technical Details

### Database Checks
1. Query subscription table for organization
2. Check subscription status field
3. Query payments table for pending payments
4. Return validation result

### Performance
- Single database query for subscription
- Single database query for pending payments
- Fast validation (<100ms typically)

## Testing Scenarios

### Test 1: Trial Period
- Create new organization
- Should allow adding agents
- No payment required

### Test 2: Pending Payment
- Have pending payment in system
- Try to add agent
- Should block with appropriate message

### Test 3: Active Subscription
- Complete payment
- Subscription status = ACTIVE
- Should allow adding agents

### Test 4: Expired Subscription
- Let subscription expire
- Try to add agent
- Should block with renewal message

## Future Enhancements

1. **Proactive Warnings**
   - Show warning before trial ends
   - Notify when payment is due

2. **Automatic Billing**
   - Auto-charge when new agent added
   - Prorate charges for mid-month additions

3. **Agent Limits**
   - Set maximum agents per plan
   - Offer different pricing tiers

4. **Grace Period**
   - Allow X days after payment due
   - Soft block vs hard block
