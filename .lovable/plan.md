

## Add Time Range Filter + Fuzzy Matching to Pain Point Evolution

### Overview

Add a dedicated time range dropdown to the Evolution panel (e.g., "Last 3 months", "Last 6 months", "Last 12 months", "All time") along with fuzzy matching to consolidate similar category names.

### How It Will Work

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Pain Point Evolution                              [Last 6 months ▼] │
│ Monthly trends across 6 months                                      │
├─────────────────────────────────────────────────────────────────────┤
│                          📈 Chart                                   │
└─────────────────────────────────────────────────────────────────────┘

Dropdown Options:
• Last 3 months
• Last 6 months  ← default
• Last 12 months
• All time
```

### Technical Implementation

#### 1. Add Time Range Options

**File: `src/hooks/usePainPointEvolution.ts`**

```typescript
export type TimeRangeOption = '3m' | '6m' | '12m' | 'all';

export function usePainPointEvolution(timeRange: TimeRangeOption = '6m'): UsePainPointEvolutionResult {
  // ...
  
  const fetchEvolutionData = useCallback(async () => {
    // Calculate date cutoff based on timeRange
    const now = new Date();
    let cutoffDate: Date | null = null;
    
    switch (timeRange) {
      case '3m':
        cutoffDate = subMonths(now, 3);
        break;
      case '6m':
        cutoffDate = subMonths(now, 6);
        break;
      case '12m':
        cutoffDate = subMonths(now, 12);
        break;
      case 'all':
        cutoffDate = null;
        break;
    }
    
    // Build query with optional date filter
    let query = supabase
      .from('member_insights')
      .select('...')
      .eq('status', 'completed')
      .order('date_range_end', { ascending: true });
    
    if (cutoffDate) {
      query = query.gte('date_range_end', cutoffDate.toISOString());
    }
    
    const { data: analyses } = await query.limit(100);
    // ... rest of logic
  }, [timeRange]);
}
```

#### 2. Add Fuzzy Matching Functions

```typescript
// Extract meaningful keywords from a category name
function extractKeywords(category: string): Set<string> {
  const stopWords = new Set(['and', 'or', 'the', 'a', 'an', 'of', 'for', 'to', 'with', 'in', 'on', '&']);
  return new Set(
    category.toLowerCase()
      .replace(/[&\/\\]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
  );
}

// Calculate Jaccard similarity between two keyword sets
function calculateSimilarity(set1: Set<string>, set2: Set<string>): number {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

// Find canonical category from existing ones
const SIMILARITY_THRESHOLD = 0.5;

function findCanonicalCategory(
  newCategory: string,
  existingCategories: Map<string, { display: string; keywords: Set<string> }>
): string | null {
  const newKeywords = extractKeywords(newCategory);
  
  for (const [normalized, data] of existingCategories) {
    if (calculateSimilarity(newKeywords, data.keywords) >= SIMILARITY_THRESHOLD) {
      return normalized;
    }
  }
  return null;
}
```

#### 3. Update Category Processing with Fuzzy Matching

Replace the simple `allCategories` map with a fuzzy-matched version that consolidates similar categories.

#### 4. Limit Status Table to Top 15

```typescript
const limitedStatusList = statusList.slice(0, 15);
setStatuses(limitedStatusList);
```

#### 5. Add Dropdown to UI

**File: `src/components/member-insights/PainPointEvolutionPanel.tsx`**

```typescript
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimeRangeOption } from '@/hooks/usePainPointEvolution';

export function PainPointEvolutionPanel() {
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('6m');
  const { chartData, categories, ... } = usePainPointEvolution(timeRange);
  
  const timeRangeLabels: Record<TimeRangeOption, string> = {
    '3m': 'Last 3 months',
    '6m': 'Last 6 months',
    '12m': 'Last 12 months',
    'all': 'All time'
  };
  
  // In CardHeader:
  <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRangeOption)}>
    <SelectTrigger className="w-[140px]">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="3m">Last 3 months</SelectItem>
      <SelectItem value="6m">Last 6 months</SelectItem>
      <SelectItem value="12m">Last 12 months</SelectItem>
      <SelectItem value="all">All time</SelectItem>
    </SelectContent>
  </Select>
}
```

### Expected Results

| Improvement | Before | After |
|-------------|--------|-------|
| Time filtering | Shows all 100 analyses | User controls timeframe |
| Category count | 86 unique categories | ~25-35 consolidated |
| Status table | Shows all 86 | Top 15 only |
| Similar names | Treated as separate | Merged together |

### Example Consolidations

```text
Before (separate entries):
• "Application & Approval Process"
• "Booking & Application Process"
• "Application Process Concerns"

After (merged):
• "Application & Approval Process" (canonical)
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/usePainPointEvolution.ts` | Add `TimeRangeOption` type, accept parameter, add date filtering, add fuzzy matching functions, limit status list to 15 |
| `src/components/member-insights/PainPointEvolutionPanel.tsx` | Add time range state, add Select dropdown in header, pass timeRange to hook |

