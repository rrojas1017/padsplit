
# Fix: Step Tracker Progress Indicator Not Moving

## Root Cause — Two Bugs in `StepTracker.tsx`

### Bug 1: Missing connector before the cluster node
In `renderNodes()`, when `useCluster` is true and we hit the first question step (`i === firstQIdx`), the function renders the cluster node and returns early. However, the connector that should appear **before** the cluster (between the last non-question step and the cluster) is never added — because the connector insertion logic lives in the "Normal node" branch that the cluster path bypasses.

### Bug 2: Connector after the cluster reads the wrong step
When `useCluster` is true and the loop reaches the "Closing" step (a non-question step after the cluster), it tries to look up the connector state using `steps[i - 1]` — but `i` is the **original index** in the full `steps` array (e.g., index 8 for Closing if there are 6 questions). `steps[i-1]` is the **last `q-` step object**, not the cluster node. Since the individual question steps are all set to a valid state in `buildSteps`, this may accidentally show the wrong color, but more critically the label `Q X/Y` on the cluster node never updates visually because the `activeQuestionIndex` prop is being ignored by the cluster's state derivation — the cluster state is set to `'active'` as soon as any question is not complete, but the label depends on `activeQuestionIndex ?? 0`, which **is** being passed. Let me re-examine more carefully.

Actually, re-reading the code more carefully:

```ts
const clusterLabel =
  clusterState === 'active'
    ? `Q ${(activeQuestionIndex ?? 0) + 1}/${questionSteps.length}`
    : ...
```

The label **does** use `activeQuestionIndex`. So the label text should update. The visual state (filled dot vs. ring) for the cluster stays `'active'` throughout all questions — that part is correct.

The real visible symptom is: **the connectors between nodes are not lighting up** as the user progresses through non-question phases. Here is the precise failure:

In non-cluster mode (≤5 questions), each non-question step's connector uses:
```ts
const prevStep = i > 0 ? steps[i - 1] : null;
const connectorCompleted = prevStep?.state === 'complete';
```

This is correct in non-cluster mode. But in **cluster mode**, when rendering "Closing" at array index `i` (say, `i = 8` for 6 questions), `steps[i-1]` = `steps[7]` = the last `q-6` step object. Its state is determined by `buildSteps` which correctly marks it `complete` when past it — so the connector *should* light up. Let me check if the connector before the cluster is missing.

In cluster mode:
- Steps array: `[verify(0), consent(1), q-0(2), q-1(3), q-2(4), q-3(5), q-4(6), q-5(7), closing(8)]`
- Loop iteration at `i=2` (first question): enters cluster branch → pushes cluster node, **returns without pushing a connector first**
- Loop iteration at `i=3..7` (remaining questions): returns early (not first q), no nodes added
- Loop iteration at `i=8` (closing): enters normal branch. `nodes.length > 0` ✓, so pushes connector. `prevStep = steps[7]` = last q step. Its state reflects `buildSteps` output.

**The missing connector is between `consent` and the cluster node.** When `i=2` (first question), the code pushes the cluster node but skips the `if (nodes.length > 0) { push connector }` step because that's in the "Normal node" branch. So there is a visible gap — no connecting line between Consent and Q cluster.

### The Fix

Rewrite `renderNodes()` in `StepTracker.tsx` to track a `previousRenderedStep` variable that always references the last **rendered** node's step data (whether normal or cluster), so connectors are always correctly placed and colored.

## Implementation Plan

**File:** `src/components/research/StepTracker.tsx` — only this one file needs changing.

### New `renderNodes()` logic:

```typescript
const renderNodes = () => {
  const nodes: React.ReactNode[] = [];
  let lastRenderedStepState: StepState | null = null;
  let clusterRendered = false;

  steps.forEach((step, i) => {
    const isQuestion = step.id.startsWith('q-');

    if (useCluster && isQuestion) {
      if (clusterRendered) return; // skip remaining q steps
      clusterRendered = true;

      // Determine cluster state
      const clusterState: StepState = questionSteps.every(s => s.state === 'complete')
        ? 'complete'
        : questionSteps.every(s => s.state === 'upcoming')
        ? 'upcoming'
        : 'active';

      const clusterLabel =
        clusterState === 'complete'
          ? `Q ${questionSteps.length}/${questionSteps.length}`
          : clusterState === 'active'
          ? `Q ${(activeQuestionIndex ?? 0) + 1}/${questionSteps.length}`
          : `Q 1–${questionSteps.length}`;

      // Add connector before cluster using last rendered state
      if (nodes.length > 0) {
        nodes.push(<Connector key="conn-cluster" completed={lastRenderedStepState === 'complete'} />);
      }

      nodes.push(
        <StepNode key="q-cluster" step={{ id: 'q-cluster', label: clusterLabel, state: clusterState }} />
      );
      lastRenderedStepState = clusterState;
      return;
    }

    // Normal node
    if (nodes.length > 0) {
      nodes.push(<Connector key={`conn-${i}`} completed={lastRenderedStepState === 'complete'} />);
    }
    nodes.push(<StepNode key={step.id} step={step} />);
    lastRenderedStepState = step.state;
  });

  return nodes;
};
```

Key changes:
1. `lastRenderedStepState` tracks the state of the **last actually rendered** node (not the raw `steps[i-1]`)
2. The connector before the cluster node is now correctly inserted using `lastRenderedStepState` (the state of "Consent" or whichever preceding step)
3. After rendering the cluster, `lastRenderedStepState` is set to `clusterState` so the connector after the cluster (before "Closing") uses the correct value
4. `clusterRendered` boolean replaces the `i !== firstQIdx` check — simpler and clearer

## What This Fixes

| Scenario | Before | After |
|---|---|---|
| Moving from Consent → Question phase | Connector before cluster missing (visual gap) | Connector appears and lights up correctly |
| Moving through questions | Cluster label updates (`Q 1/6`, `Q 2/6`, …) ✓ already worked | Same — still works |
| Questions all done → Closing | Connector between cluster and Closing may read wrong step | Reads cluster state, lights up correctly |
| ≤5 questions (no cluster) | Connectors worked correctly | Still works (code path unchanged) |

## No Other Files Need Changes

`buildSteps` in `StepTracker.tsx` is correct — it properly marks steps as `complete`/`active`/`upcoming` based on `phase` and `questionIndex`. The `LogSurveyCall.tsx` passes `phase` and `questionIndex` correctly. Only the rendering logic inside `renderNodes()` needs the fix.
