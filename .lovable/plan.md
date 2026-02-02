

# Telnyx Click-to-Call Integration

## Overview

This plan implements a **click-to-call** feature using Telnyx's Programmable Voice API. When agents click the "Voice" button in the Contact Profile Hover Card, the system will initiate an outbound call through Telnyx that:
1. First calls the agent's phone
2. When the agent answers, bridges the call to the contact

This is a **server-initiated call** pattern (not WebRTC) that works with any phone - no browser audio required.

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Click-to-Call Flow                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Agent clicks "Voice"     Edge Function           Telnyx API              │
│   in Hover Card        →   initiate-call   →   POST /v2/calls              │
│                                                                             │
│   1. Agent's phone rings ←──────────────────── Telnyx dials agent         │
│   2. Agent answers       →  Webhook received → call.answered               │
│   3. Contact rings       ←──────────────────── Telnyx bridges to contact  │
│   4. Call connected!                                                        │
│                                                                             │
│   Webhooks track:                                                           │
│   - call.initiated → Log call started                                       │
│   - call.answered  → Update call status                                     │
│   - call.hangup    → Log duration, save recording URL                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## What You'll Get

- **One-click calling** from the Reports page hover card
- **Call tracking** integrated with existing `calls` table
- **Recording support** (automatic if enabled in Telnyx)
- **Call history** in communication logs
- **Caller ID** shows PadSplit number

## Requirements

Before implementation, you'll need to provide:

| Requirement | Where to Get It |
|-------------|-----------------|
| **Telnyx API Key** | Telnyx Portal → API Keys |
| **Connection ID** | Telnyx Portal → SIP Connections or Call Control App |
| **From Number** | A Telnyx phone number to use as Caller ID |
| **Agent Phone Numbers** | Added to profiles table (new column) |

---

## Implementation Steps

### Phase 1: Database Updates

**Add agent phone number column to profiles:**
- Store the agent's personal/work phone number that Telnyx will dial first
- This is the number that rings when an agent initiates a click-to-call

**Add Telnyx tracking columns to calls table:**
- `telnyx_call_control_id` - For sending commands to active calls
- `telnyx_call_session_id` - For grouping related call legs
- `initiated_by` - Track which user started the call

### Phase 2: Edge Functions

**Create `initiate-telnyx-call` edge function:**
- Validates user has `can_send_communications` permission
- Fetches agent's phone number from profiles
- Calls Telnyx API to initiate outbound call:
  ```text
  POST https://api.telnyx.com/v2/calls
  {
    "to": "+1AGENT_PHONE",
    "from": "+1PADSPLIT_NUMBER",
    "connection_id": "YOUR_CONNECTION_ID",
    "webhook_url": "https://.../receive-telnyx-webhook",
    "answering_machine_detection": "detect_words"
  }
  ```
- Creates initial call record in `calls` table
- Returns call ID for tracking

**Create `receive-telnyx-webhook` edge function:**
- Handles `call.initiated` - Log call start
- Handles `call.answered` - Bridge to contact's phone:
  ```text
  POST /v2/calls/{call_control_id}/actions/bridge
  {
    "call_control_id": "CONTACT_LEG_ID"
  }
  ```
- Handles `call.hangup` - Update call record with duration, recording URL
- Handles `call.recording.saved` - Store recording URL

### Phase 3: Frontend Updates

**Update Contact Profile Hover Card:**
- Replace `handleVoiceNoteClick` to open a call dialog (like SMS/Email)
- Show call status (ringing, connected, ended)
- Display estimated cost

**Create `InitiateCallDialog` component:**
- Shows agent's phone number (where they'll receive the call)
- Displays contact number being called
- "Start Call" button triggers edge function
- Shows real-time status updates

**Update `useContactCommunications` hook:**
- Add `initiateCall` method
- Handle `voice_call` communication type (distinct from `voice_note`)

### Phase 4: Settings & Configuration

**Add Telnyx settings to Admin panel:**
- Store `from_number` in system settings
- Allow admins to configure default behaviors

---

## Technical Details

### New Secrets Required

| Secret Name | Description |
|-------------|-------------|
| `TELNYX_API_KEY` | Telnyx API v2 bearer token |
| `TELNYX_CONNECTION_ID` | Your Call Control connection ID |
| `TELNYX_FROM_NUMBER` | PadSplit caller ID number (e.g., +18001234567) |

### Database Schema Changes

```sql
-- Add phone number column to profiles
ALTER TABLE profiles 
ADD COLUMN phone_number text;

-- Add Telnyx tracking to calls table
ALTER TABLE calls
ADD COLUMN telnyx_call_control_id text,
ADD COLUMN telnyx_call_session_id text,
ADD COLUMN initiated_by uuid REFERENCES profiles(id);

-- Update source options
-- Allow 'telnyx' as a source value
```

### Edge Function: initiate-telnyx-call

Key logic:
1. Verify user has communication permissions
2. Lookup agent's phone from profiles
3. Lookup contact's phone from booking
4. Call Telnyx API with webhook URL pointing to `receive-telnyx-webhook`
5. Store initial call record with status `initiating`
6. Return call ID for frontend tracking

### Edge Function: receive-telnyx-webhook

Webhook event handling:

| Event | Action |
|-------|--------|
| `call.initiated` | Update call status to `ringing` |
| `call.answered` (agent leg) | Initiate dial to contact, update status to `connecting` |
| `call.answered` (contact leg) | Bridge calls, update status to `connected` |
| `call.hangup` | Update status to `completed`, store duration & recording |

### Communication Type

Add new type `voice_call` to distinguish from manual `voice_note`:
- `voice_note` = Agent manually dialed from their phone
- `voice_call` = System-initiated call via Telnyx

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/initiate-telnyx-call/index.ts` | **Create** - Initiate outbound calls |
| `supabase/functions/receive-telnyx-webhook/index.ts` | **Create** - Handle call events |
| `supabase/config.toml` | **Modify** - Add new function configs |
| `src/components/reports/InitiateCallDialog.tsx` | **Create** - Call initiation UI |
| `src/components/reports/ContactProfileHoverCard.tsx` | **Modify** - Use new call dialog |
| `src/hooks/useContactCommunications.ts` | **Modify** - Add initiateCall method |
| Database migration | **Create** - Add phone_number, telnyx columns |

---

## Testing Checklist

After implementation:
- [ ] Add Telnyx API credentials as secrets
- [ ] Add agent phone number to a test profile
- [ ] Click "Voice" button on a contact with phone number
- [ ] Verify agent's phone rings first
- [ ] Answer agent phone, verify contact is dialed
- [ ] Complete call, verify recording URL captured
- [ ] Check `contact_communications` log entry

---

## Cost Considerations

Telnyx pricing is usage-based:
- **Outbound calls**: ~$0.01-0.02/minute
- **Recording storage**: ~$0.0025/minute/month
- No monthly minimum

Consider displaying estimated cost in the call dialog.

