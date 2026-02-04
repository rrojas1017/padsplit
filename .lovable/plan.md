
## Fix: Site Filter Showing 0 Records

### Problem Identified

The pending stats query in `useBulkProcessingJobs.ts` is filtering for:
```typescript
.eq('transcription_status', 'pending')
```

But the actual pending records have `transcription_status = NULL` (5,013 records), not `'pending'`.

### Database State
| transcription_status | Count |
|---------------------|-------|
| NULL (never processed) | 5,013 |
| completed | 815 |
| failed | 35 |
| processing | 1 |

### Site Distribution (Correct)
| Site | Pending Records |
|------|-----------------|
| Vixicom | 394 |
| PadSplit Internal | 4,619 |

### Solution

Update `src/hooks/useBulkProcessingJobs.ts` to filter for `transcription_status IS NULL` instead of `= 'pending'`:

**Lines 84-89 (Total count query):**
```typescript
// Before
.eq('transcription_status', 'pending')

// After
.is('transcription_status', null)
```

**Lines 103-109 (Vixicom count query):**
```typescript
// Before
.eq('transcription_status', 'pending')

// After
.is('transcription_status', null)
```

### Technical Details

**File to modify:** `src/hooks/useBulkProcessingJobs.ts`

**Changes:**
1. Line 87: Change `.eq('transcription_status', 'pending')` to `.is('transcription_status', null)`
2. Line 106: Change `.eq('transcription_status', 'pending')` to `.is('transcription_status', null)`

This single fix will make the UI correctly show:
- Vixicom Only: 394 records
- Non-Vixicom Only: 4,619 records  
- Total: 5,013 records
