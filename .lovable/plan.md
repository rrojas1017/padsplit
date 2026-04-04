

# Fix: Communication Insights Word Export — Missing Pain Point Names + Wrong Metrics

## Problem
The exported .docx has two bugs visible in the screenshot:

1. **Pain Point names are blank** — the data uses `category` as the field name (e.g., "Payment & Pricing Confusion"), but the code only checks `p.pain_point || p.name || p.issue` — none of which exist
2. **"Mentions" column shows raw decimals** (12.6, 12.1, 10.2) — these are actually percentages (`frequency`), not mention counts. Should display as "12.6%" or show actual counts from sub-categories

## Data Shape (from DB)
```json
{
  "category": "Payment & Pricing Confusion",
  "frequency": 12.6,
  "description": "Members are frequently confused by...",
  "sub_categories": [...],
  "examples": [...]
}
```

## Fix — `src/utils/generate-communication-insights-docx.ts`

### Line 164-167: Rename column header
Change `'Mentions'` → `'Frequency'`

### Line 171: Add `category` to field lookup
```typescript
const name = typeof p === 'string' ? p : (p.category || p.pain_point || p.name || p.issue || '');
```

### Line 172: Format frequency as percentage
```typescript
const count = p.frequency ? `${p.frequency}%` : (p.count || p.mentions || '');
```

### Line 173: Use `description` field (which exists in the data)
```typescript
const detail = p.description || p.detail || p.example || '';
```

## Result
The table will show:
| Pain Point | Frequency | Details |
|---|---|---|
| Payment & Pricing Confusion | 12.6% | Members are frequently confused by... |

## Single file change
| File | Change |
|------|--------|
| `src/utils/generate-communication-insights-docx.ts` | Fix field mapping for pain points: add `category`, format frequency as %, rename column header, prioritize `description` |

