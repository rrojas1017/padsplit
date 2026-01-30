

# Remove Text Truncation from Concerns Section

## Change

Remove the `line-clamp-2` class from the Concerns section so the full concern text is always visible without being cut off.

## File to Modify

| File | Change |
|------|--------|
| `src/components/reports/ContactProfileHoverCard.tsx` | Remove `line-clamp-2` from concerns text |

## Code Change

**Line 245:**
```typescript
// FROM:
<span className="line-clamp-2 leading-snug">{concern}</span>

// TO:
<span className="leading-snug">{concern}</span>
```

## Result

Concerns will display their full text, ensuring important context about the contact's worries and questions is never hidden.

