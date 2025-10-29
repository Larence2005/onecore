# Agent Slots System Implementation

## Overview
Implemented a slot-based system where organization owners can buy agent slots in bulk. Agents can only be added if there are available slots.

## Database Schema Changes

### Subscription Model
Added `agentSlots` field to track purchased slots:
```prisma
model Subscription {
  agentCount   Int  @default(1)  // Current number of agents
  agentSlots   Int  @default(1)  // Total agent slots purchased
  pricePerAgent Float @default(10.00) // $10 USD per slot
}
```

**Note:** Run `npx prisma migrate dev` to apply schema changes.

## New Functions (`actions-subscription.ts`)

### 1. `buyAgentSlots(organizationId, slotsToAdd)`
- Creates a payment for purchasing agent slots
- Marks payment with `type: 'AGENT_SLOTS'` in metadata
- Returns payment link for checkout

### 2. `getAvailableSlots(organizationId)`
- Returns:
  - `totalSlots`: Total slots purchased
  - `usedSlots`: Current number of agents
  - `availableSlots`: Remaining slots (totalSlots - usedSlots)

### 3. Updated `checkPaymentStatus(paymentId)`
- Detects slot purchase payments
- Automatically adds purchased slots to subscription when paid
- Updates `agentSlots` field

### 4. Updated `canAddMembers(organizationId)`
- Now checks available slots FIRST
- Blocks if `availableSlots <= 0`
- Shows: "No available agent slots. You have X/Y slots used. Please buy more slots in Settings → Subscription."

## User Flow

### Buying Agent Slots
1. Owner goes to Settings → Subscription & Billing
2. Sees "Buy Agent Slots" card showing:
   - Current slots: X/Y used
   - Available slots: Z
3. Enters number of slots to buy (e.g., 10)
4. Clicks "Buy Slots" → Opens payment gateway
5. Completes payment
6. System automatically adds slots to subscription

### Adding Agents
1. Owner goes to Organization page
2. Clicks "Add Agent" button
3. System checks:
   - Are there available slots?
   - Is subscription active?
   - Are there pending payments?
4. If slots available → Agent added
5. If no slots → Error: "No available agent slots. Please buy more slots."

## UI Components (To Be Completed)

### Settings → Subscription Page
Need to add:
```tsx
{/* Agent Slots Card */}
<Card>
  <CardHeader>
    <CardTitle>Agent Slots</CardTitle>
    <CardDescription>
      Buy agent slots in bulk to add more agents to your organization
    </CardDescription>
  </CardHeader>
  <CardContent>
    {/* Show current slots */}
    <div>Used: {usedSlots}/{totalSlots} slots</div>
    <div>Available: {availableSlots} slots</div>
    
    {/* Buy slots form */}
    <Label>Number of Slots to Buy</Label>
    <Input 
      type="number" 
      value={slotsToBuy}
      onChange={(e) => setSlotsToBuy(Number(e.target.value))}
      min={1}
    />
    <div>Cost: ${slotsToBuy * 10} USD</div>
    
    <Button onClick={handleBuySlots}>
      Buy {slotsToBuy} Slot{slotsToBuy > 1 ? 's' : ''}
    </Button>
  </CardContent>
</Card>
```

### Organization Page
Update "Add Agent" button visibility:
```tsx
{availableSlots > 0 ? (
  <Button onClick={openAddMemberDialog}>
    <UserPlus /> Add Agent
  </Button>
) : (
  <Button disabled>
    No Slots Available - Buy in Settings
  </Button>
)}
```

## Pricing

- **$10 USD per slot per month**
- Bulk purchase: 10 slots = $100 USD
- Slots are permanent until subscription ends
- Monthly billing based on `agentCount`, not `agentSlots`

## Example Scenarios

### Scenario 1: Buy 10 Slots
- Current: 2/2 slots (0 available)
- Buy: 10 slots for $100
- After payment: 2/12 slots (10 available)
- Can now add 10 more agents

### Scenario 2: Try to Add Agent Without Slots
- Current: 5/5 slots (0 available)
- Try to add agent → Blocked
- Error: "No available agent slots. You have 5/5 slots used."
- Must buy more slots first

### Scenario 3: Monthly Billing
- Total slots: 20
- Used slots: 15 agents
- Monthly cost: 15 × $10 = $150 USD
- (Billed for agents, not slots)

## Implementation Status

### ✅ Completed
- Database schema updated
- `buyAgentSlots()` function
- `getAvailableSlots()` function
- `canAddMembers()` updated with slot check
- `checkPaymentStatus()` handles slot purchases
- Payment metadata tracks slot purchases

### ⏳ Pending
- Apply Prisma migration
- Add UI card in subscription view
- Add slot display in organization view
- Update "Add Agent" button visibility
- Load and display slot information
- Handle buy slots button click

## Migration Command

```bash
npx prisma migrate dev --name add_agent_slots
```

## Testing Checklist

- [ ] Buy 10 slots successfully
- [ ] Slots added to subscription after payment
- [ ] Can add agents when slots available
- [ ] Cannot add agents when no slots
- [ ] Error message shows correct slot count
- [ ] Monthly billing uses agentCount not agentSlots
- [ ] Slot purchase shows in payment history

## Future Enhancements

1. **Slot Expiration**
   - Slots expire with subscription
   - Warn before expiration

2. **Slot Packages**
   - 5 slots: $45 (10% discount)
   - 10 slots: $90 (10% discount)
   - 20 slots: $170 (15% discount)

3. **Auto-Purchase**
   - Auto-buy slots when trying to add agent
   - "Buy 1 slot for $10 to add this agent"

4. **Slot Transfer**
   - Transfer unused slots between organizations
   - Sell back unused slots
