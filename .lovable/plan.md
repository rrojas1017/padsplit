

# Add Contact Email and Phone Fields to Booking Form

## Overview

Add two mandatory fields to the Add Booking form for contact email and phone number. These fields already exist in the database and TypeScript types - they just need to be added to the form UI and validation logic.

## Changes Summary

| Location | Change |
|----------|--------|
| Form state | Add `contactEmail` and `contactPhone` state variables |
| Validation | Add mandatory validation for both fields + format validation |
| Form UI | Add new "Contact Information" section with email and phone inputs |
| Submit handler | Include `contactEmail` and `contactPhone` in the `addBooking` call |
| BookingsContext | Update `addBooking` to save `contact_email` and `contact_phone` to database |

---

## Implementation Details

### 1. Add Form State Variables

Add two new state variables after the existing member/booking states:

```typescript
const [contactEmail, setContactEmail] = useState('');
const [contactPhone, setContactPhone] = useState('');
```

### 2. Add Validation in handleSubmit

Add validation after the existing member name check:

```typescript
// Email validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!contactEmail.trim() || !emailRegex.test(contactEmail.trim())) {
  toast({ title: 'Error', description: 'Please enter a valid email address', variant: 'destructive' });
  return;
}

// Phone validation (at least 10 digits)
const phoneDigits = contactPhone.replace(/\D/g, '');
if (phoneDigits.length < 10) {
  toast({ title: 'Error', description: 'Please enter a valid phone number (at least 10 digits)', variant: 'destructive' });
  return;
}
```

### 3. Add Contact Information Section to Form UI

Insert a new card section after the "Member Information" section:

```text
┌─────────────────────────────────────────────────────────────┐
│ 📞 Contact Information                                      │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ Email Address *              Phone Number *                 │
│ ┌─────────────────────────┐  ┌─────────────────────────┐   │
│ │ member@email.com        │  │ (678) 463-1178          │   │
│ └─────────────────────────┘  └─────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4. Update addBooking Call

Add the contact fields to the addBooking call:

```typescript
await addBooking({
  // ... existing fields
  contactEmail: contactEmail.trim(),
  contactPhone: contactPhone.trim(),
});
```

### 5. Update BookingsContext

Update the `addBooking` function to include contact fields in the database insert:

```typescript
const { data, error } = await supabase.from('bookings').insert({
  // ... existing fields
  contact_email: booking.contactEmail || null,
  contact_phone: booking.contactPhone || null,
}).select('id').single();
```

### 6. Reset Fields on "Add Another"

Clear the contact fields when using "Save & Add Another":

```typescript
if (addAnother) {
  setContactEmail('');
  setContactPhone('');
  // ... existing resets
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/AddBooking.tsx` | Add state, validation, UI section, and include in submit |
| `src/contexts/BookingsContext.tsx` | Update `addBooking` to save `contact_email` and `contact_phone` |

---

## Form Layout After Change

The form will have sections in this order:

1. **Booking Information** (dates, type, status)
2. **Member Information** (name, rebooking toggle)
3. **Contact Information** (email, phone) - NEW
4. **Agent & Location** (agent, city, state)
5. **Communication** (method)
6. **External Links** (optional links)
7. **Notes & Follow-up** (notes, reach-out checkbox)

---

## Validation Rules

| Field | Validation |
|-------|------------|
| Contact Email | Required, must match email format (`user@domain.com`) |
| Contact Phone | Required, must have at least 10 digits |

Both fields will show red error toasts if invalid, preventing form submission.

