
# Fix User Creation Form — Add Password Validation Feedback

## Problem
The Create User dialog in User Management has no client-side password validation or strength indicator. The backend requires passwords with 8+ characters, uppercase, lowercase, number, and special character — but the form gives no feedback until submission fails. This is almost certainly why Jack Avera couldn't create Anoosha Kumar's account: the password was rejected silently or with a vague error toast.

## Root Cause
- The `PasswordStrengthIndicator` component exists and is used on the Login page, but is NOT included in the User Management create user dialog
- Client-side validation (line 281) only checks if fields are non-empty — no password strength check
- Backend errors are shown via toast but may not be clear enough (e.g., "Password must contain at least one special character")

## Solution

### 1. Add PasswordStrengthIndicator to Create User Dialog
Wire the existing `PasswordStrengthIndicator` component into the create user form, showing real-time password requirements as the admin types.

### 2. Add Client-Side Password Validation Before Submission
Add a check in `handleCreateUser` that validates password strength BEFORE calling the edge function, showing a clear validation error if requirements aren't met.

### 3. Improve Error Display
Ensure backend validation errors (like "Password must contain at least one special character") are clearly surfaced in the toast description.

## Files to Modify
- `src/pages/UserManagement.tsx` — Import `PasswordStrengthIndicator` and `validatePassword` from existing utils, add the indicator below the password field, add client-side validation in `handleCreateUser`

## What Does NOT Change
- No backend/edge function changes needed
- No new components needed (reusing existing ones)
- No database changes
