

# Fix Contact Info Masking in Reports

## Issue Analysis

The masking code is correctly implemented, but it only activates for users with `role === 'agent'`. Based on your screenshot showing full email addresses, you are likely logged in as a non-agent role (super_admin, admin, or supervisor).

**Current behavior:**
| Role | Sees |
|------|------|
| super_admin | Full contact info |
| admin | Full contact info |
| supervisor | Full contact info |
| agent | Masked contact info |

## Clarification Needed

There are two possible interpretations:

### Option A: Masking is working correctly (current design)
If you're logged in as admin/supervisor and seeing full emails, that's the expected behavior. To test masking, you would need to log in as an agent-role user.

### Option B: You want to change the masking logic
If you want ALL users (or specific roles) to see masked contact info, the `shouldMaskContactInfo` function needs to be updated.

---

## Proposed Fix (Option B - Mask for all roles)

If you want contact info masked for everyone, update `src/utils/contactPrivacy.ts`:

```typescript
// Current: Only agents see masked data
export function shouldMaskContactInfo(userRole: string | undefined): boolean {
  return userRole === 'agent';
}

// Change to: Everyone sees masked data EXCEPT super_admin
export function shouldMaskContactInfo(userRole: string | undefined): boolean {
  return userRole !== 'super_admin';
}

// OR: Everyone sees masked data
export function shouldMaskContactInfo(userRole: string | undefined): boolean {
  return true;
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/utils/contactPrivacy.ts` | Update `shouldMaskContactInfo` function logic |

---

## Quick Test

To verify masking works for agents:
1. Log in as an agent-role user
2. Navigate to Reports page
3. Emails should appear as `tro***@gmail.com` instead of full address

**Please confirm which behavior you want:**
- A) Keep current design (only agents see masked info) - just need to test with agent account
- B) Mask for all users except super_admin
- C) Mask for everyone including super_admin

