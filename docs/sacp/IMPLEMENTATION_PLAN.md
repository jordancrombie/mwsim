# mwsim SACP Implementation Plan

**Project**: SimToolBox Agent Commerce Protocol (SACP)
**Component**: mwsim (Mobile Wallet App)
**Branch**: `feature/agentic-support`
**Date**: 2026-01-21

---

## Design Decisions

Responses to open questions from WSIM requirements doc:

| # | Question | Decision |
|---|----------|----------|
| 1 | Mobile-only or web support? | **Both** - mwsim handles mobile, WSIM web to be coordinated |
| 2 | How to share agent credentials? | **Agent-initiated flow** - OAuth/web, push approval, or QR scan (like SSIM payments). Credentials not shown in UI. |
| 3 | Auth for high-value approvals? | **Biometric on mobile, Passkey on desktop** |
| 4 | Minimum iOS/Android version? | **Whatever minimum supports required capabilities** (currently iOS 15.5 for NFC, but agents may not need NFC) |
| 5 | Show pending step-ups? | **Message Center** - New centralized notification/action center for all pending items |

---

## Key Architectural Decisions

### 1. Agent Credential Flow (Decision #2)

**Important**: Agents don't receive credentials via "copy to clipboard" UI. Instead:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    AI Agent     │     │      WSIM       │     │     mwsim       │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  1. Request access    │                       │
         │ ───────────────────► │                       │
         │                       │  2. Push notification │
         │                       │ ─────────────────────►│
         │                       │                       │
         │                       │  3. User approves     │
         │                       │ ◄─────────────────────│
         │                       │                       │
         │  4. Credentials       │                       │
         │ ◄─────────────────── │                       │
         │                       │                       │
```

**Alternative flows**:
- **QR Code**: Agent displays QR, user scans with mwsim, approves
- **Web OAuth**: Agent redirects to WSIM web, user approves, redirect back with code

This is MORE secure than displaying credentials in UI - credentials are delivered directly to the requesting agent.

**Implication**: We need to add an "Agent Access Request" approval flow similar to step-up.

### 2. Message Center (Decision #5)

New centralized hub for all actionable notifications:

```
┌────────────────────────────────────────┐
│  Message Center                    (3) │
│                                        │
│  ┌────────────────────────────────┐   │
│  │ 🔔 NEW                          │   │
│  │ Purchase approval needed        │   │
│  │ My Shopping Assistant • $156.48 │   │
│  │ Regal Moose • Expires in 12 min │   │
│  │            [View] [Approve]     │   │
│  └────────────────────────────────┘   │
│                                        │
│  ┌────────────────────────────────┐   │
│  │ 🤖 Agent access request         │   │
│  │ "Claude Shopping" wants access  │   │
│  │ Permissions: browse, cart, buy  │   │
│  │            [View] [Approve]     │   │
│  └────────────────────────────────┘   │
│                                        │
│  ┌────────────────────────────────┐   │
│  │ 📄 Contract ready for funding   │   │
│  │ "Hockey Bet" with @mike         │   │
│  │ Your stake: $20.00              │   │
│  │            [View] [Fund]        │   │
│  └────────────────────────────────┘   │
│                                        │
│  EARLIER TODAY                         │
│  ┌────────────────────────────────┐   │
│  │ ✓ Transfer received - $50.00   │   │
│  │ From @sarah • 2 hours ago       │   │
│  └────────────────────────────────┘   │
└────────────────────────────────────────┘
```

**Message types**:
- `agent.step_up` - Purchase approval needed
- `agent.access_request` - New agent wants credentials (NEW)
- `agent.transaction` - Transaction completed
- `agent.limit_warning` - Approaching limit
- `agent.suspended` - Agent auto-suspended
- `contract.funding_ready` - Contract ready to fund
- `contract.resolved` - Contract resolved
- `transfer.received` - Transfer received
- `transfer.failed` - Transfer failed

**Benefits**:
- Single place to see all pending actions
- Badge count on tab bar / home screen
- Reduces notification fatigue
- Historical record of notifications

---

## Implementation Phases

### Phase 1: Core Agent Management (P0)

| Task | Description | Est |
|------|-------------|-----|
| **Types & API** | TypeScript types from OpenAPI, agent-api.ts service | 1 day |
| **Agent List** | Settings > AI Agents, list with status/spending | 2 days |
| **Agent Detail** | View agent info, spending progress, activity | 2 days |
| **Step-Up Screen** | Approval screen with biometric auth | 3 days |
| **Push Handler** | Handle `agent.step_up` notifications | 1 day |
| **Deep Linking** | `mwsim://step-up/:id` support | 0.5 days |

### Phase 2: Agent Creation & Message Center (P0/P1)

| Task | Description | Est |
|------|-------------|-----|
| **Message Center** | New screen for centralized notifications | 3 days |
| **Agent Registration** | Create agent wizard (name, permissions, limits) | 3 days |
| **Access Request Flow** | Approve agent credential requests | 2 days |
| **QR Scan Approval** | Scan agent QR to approve access | 1 day |

### Phase 3: Management & History (P1)

| Task | Description | Est |
|------|-------------|-----|
| **Edit Agent** | Modify settings, limits, permissions | 2 days |
| **Suspend/Revoke** | Temporarily disable or permanently revoke | 1 day |
| **Transaction History** | Per-agent transaction list with filters | 2 days |
| **Secret Rotation** | Rotate credentials with new delivery flow | 1 day |

---

## New Files to Create

```
app/src/
├── screens/
│   ├── AgentList.tsx           # Settings > AI Agents
│   ├── AgentDetail.tsx         # Agent info & activity
│   ├── AgentCreate.tsx         # Registration wizard
│   ├── AgentEdit.tsx           # Edit settings
│   ├── StepUpApproval.tsx      # Purchase approval
│   ├── AgentAccessRequest.tsx  # Approve credential request
│   └── MessageCenter.tsx       # Centralized notifications
├── components/
│   ├── AgentCard.tsx           # List item
│   ├── SpendingProgress.tsx    # Limit progress bar
│   ├── StepUpDetails.tsx       # Purchase details
│   ├── PermissionSelector.tsx  # Permission checkboxes
│   ├── LimitInput.tsx          # Currency input
│   └── MessageCard.tsx         # Message center item
├── services/
│   └── agent-api.ts            # API client
├── hooks/
│   ├── useAgentNotifications.ts
│   └── useMessageCenter.ts
└── types/
    └── agent.ts                # Agent types
```

---

## API Endpoints (from WSIM OpenAPI)

### Agent Management
- `GET /api/mobile/agents` - List agents
- `POST /api/mobile/agents` - Create agent
- `GET /api/mobile/agents/:id` - Agent details
- `PATCH /api/mobile/agents/:id` - Update agent
- `DELETE /api/mobile/agents/:id` - Revoke agent
- `POST /api/mobile/agents/:id/rotate-secret` - Rotate credentials
- `GET /api/mobile/agents/:id/transactions` - Transaction history

### Step-Up
- `GET /api/mobile/step-up/:id` - Step-up details
- `POST /api/mobile/step-up/:id/approve` - Approve
- `POST /api/mobile/step-up/:id/reject` - Reject

### Message Center (NEW - needs WSIM coordination)
- `GET /api/mobile/messages` - List messages
- `PATCH /api/mobile/messages/:id` - Mark read/dismissed

---

## Coordination Needed with WSIM

1. **Agent Access Request Flow**
   - New notification type: `agent.access_request`
   - New endpoints for approve/reject access request
   - QR code generation for agent-side display

2. **Message Center API**
   - Unified message/notification endpoint
   - Or: Aggregate from multiple sources client-side

3. **Push Notification Payloads**
   - Confirm all notification types and payloads
   - Action button support for iOS

---

## Open Questions for WSIM

1. Can we add `agent.access_request` notification type?
2. Should Message Center be a WSIM API or client-side aggregation?
3. How should agent QR code flow work? (agent generates QR with request ID?)

---

## Next Steps

1. [ ] Create TypeScript types from OpenAPI spec
2. [ ] Implement agent-api.ts service
3. [ ] Build Agent List screen
4. [ ] Coordinate with WSIM on agent access request flow
5. [ ] Design Message Center data model
