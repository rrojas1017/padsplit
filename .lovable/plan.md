
# Update Phone Number Placeholder

## Issue

The phone number field in the Add Booking form currently shows a real-looking phone number `(678) 463-1178` as placeholder text. This could cause confusion for agents entering new bookings.

## Solution

Change the placeholder to a clearly fake number format: `(000) 000-0000`

---

## Change Details

| File | Line | Current | New |
|------|------|---------|-----|
| `src/pages/AddBooking.tsx` | 370 | `placeholder="(678) 463-1178"` | `placeholder="(000) 000-0000"` |

---

## Code Change

```typescript
// Line 370 - Update placeholder
<Input
  id="contactPhone"
  type="tel"
  value={contactPhone}
  onChange={(e) => setContactPhone(e.target.value)}
  placeholder="(000) 000-0000"  // Changed from (678) 463-1178
/>
```

---

## Impact

- Agents will see a neutral placeholder that clearly indicates the expected format
- No confusion with potentially real phone numbers
- The validation logic remains unchanged (requires at least 10 digits)
