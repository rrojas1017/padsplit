# BUG-006 — Stale save responses after Restart (PublicScriptView.tsx only)

Only file: `src/pages/PublicScriptView.tsx`. There are no server, payload, trigger, save_seq, beforeunload, disposition, branching or translation changes. The only new banner text is the timeout message.

## Timeout mechanism (installed version)
The installed versions are `@supabase/supabase-js` 2.86.0 and `@supabase/functions-js` 2.86.0. Their `FunctionsClient.invoke` accepts `signal` (and `timeout`), so no `Promise.race` is needed. Each send creates an `AbortController`, calls `setTimeout(() => { timedOut = true; ctrl.abort(); }, 20000)` and passes `signal: ctrl.signal`. After an abort, invoke either returns a `FunctionsFetchError` or throws. Both paths check the local `timedOut` flag, which maps the abort to "Server did not answer — retry". The timer is cleared in `finally`.

## New / changed refs (lines ~175–181)
```diff
   const saveSeqRef = useRef(0);
-  const inFlightRef = useRef(false);
+  const generationRef = useRef(0);
+  const requestIdRef = useRef(0);
+  const latestReqIdRef = useRef(0);
+  const inFlightRef = useRef<{ gen: number; reqId: number } | null>(null);
   const pendingRef = useRef<boolean | null>(null);
```
`SAVE_TIMEOUT_MS = 20000` is added next to them.

## send()
```diff
   const send = useCallback(async (final: boolean): Promise<void> => {
     if (!token) return;
     const s = snapshotRef.current;
     if (!s.submissionId) return;
-    inFlightRef.current = true;
+    const gen = generationRef.current;
+    const reqId = ++requestIdRef.current;
+    const submissionId = s.submissionId;
+    latestReqIdRef.current = reqId;
+    inFlightRef.current = { gen, reqId };
+    const isCurrent = () =>
+      gen === generationRef.current &&
+      reqId === latestReqIdRef.current &&
+      submissionId === snapshotRef.current.submissionId;
+    const ctrl = new AbortController();
+    let timedOut = false;
+    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, SAVE_TIMEOUT_MS);
     lastAttemptFinalRef.current = final;
     saveSeqRef.current += 1;
     const json = contentJson(s);
     setSaveState('saving');
     try {
       const { data, error: fnError } = await supabase.functions.invoke('submit-public-script', {
         body: { ...unchanged... },
+        signal: ctrl.signal,
       });
+      if (!isCurrent()) return;
       if (fnError) {
+        if (timedOut) { setLastError('Server did not answer — retry'); setSaveState('failed'); return; }
         ...status/body parsing unchanged...
+        if (!isCurrent()) return;          // after the awaited .json()
         setLastError(reason); setSaveState('failed');
       } else {
         ...success block unchanged (savedJsonRef, lastSavedAt, answers, 'saved', terminalSaved)...
       }
     } catch {
+      if (!isCurrent()) return;
-      setLastError('Server error');
+      setLastError(timedOut ? 'Server did not answer — retry' : 'Server error');
       setSaveState('failed');
     } finally {
+      clearTimeout(timer);
+      if (!isCurrent()) return;            // stale: touch nothing
       inFlightRef.current = null;
       const next = pendingRef.current;
       pendingRef.current = null;
       if (next !== null && !terminalSavedRef.current) void send(next);
     }
   }, [token]);
```
(The `return` inside `finally` only exits the cleanup for stale requests. It never swallows errors, because every `try` and `catch` path is already handled above it.)

A stale request (older generation, superseded reqId, or a different submission_id) never writes any state or ref and never dispatches a pending save.

## requestSave()
```diff
   const requestSave = useCallback((final: boolean) => {
     if (terminalSavedRef.current) return;
-    if (inFlightRef.current) {
+    const f = inFlightRef.current;
+    if (f && f.gen === generationRef.current) {
       pendingRef.current = final || pendingRef.current === true;
       return;
     }
     void send(final);
   }, [send]);
```

## doRestart()
```diff
   const doRestart = useCallback(() => {
+    generationRef.current += 1;
+    inFlightRef.current = null;
     setPhase('start');
     ...all existing resets unchanged (banner state cleared, pendingRef null, terminalSavedRef false, etc.)...
   }, []);
```
Existing `requestIdRef`/`latestReqIdRef` values stay as they are. The generation bump alone makes every old request stale.

## restart() and the Restart button
The button is disabled while the survey is not yet terminally saved and a save is pending or idle. This also covers the brief moment after an autosave shows "saved" but before the terminal save has started:
```ts
const restartBlocked = !terminalSaved && (saveState === 'saving' || saveState === 'idle' || saveState === 'saved');
```
```diff
   const restart = () => {
+    if (restartBlocked) return;
     if (terminalSaved) doRestart();
-    else setRestartConfirmOpen(true);
+    else setRestartConfirmOpen(true);   // only reachable when saveState === 'failed'
   };
```
```diff
-                <div className="flex gap-3 justify-center">
-                  <Button onClick={restart}>
-                    <RotateCcw className="w-4 h-4 mr-2" /> Restart
-                  </Button>
-                </div>
+                <div className="flex flex-col items-center gap-1">
+                  <Button onClick={restart} disabled={restartBlocked}>
+                    <RotateCcw className="w-4 h-4 mr-2" /> Restart
+                  </Button>
+                  {restartBlocked && <span className="text-xs text-muted-foreground">Saving…</span>}
+                </div>
```
- Terminal save succeeded → the button is enabled and restarts immediately.
- Save failed (including timeout) → the button is enabled and opens the existing "Restart anyway?" dialog.

## Banner
The banner markup is unchanged. It reads only `saveState`/`lastSavedAt`/`lastSavedAnswers`/`lastError`. After this change those values can only be written by the current request of the current survey, and `doRestart()` clears them as before.

## Verification
- `tsgo --noEmit -p tsconfig.app.json`.
- Browser check of the Restart button's disabled state and "Saving…" hint on the done screen.
- The acceptance runs (a second research_calls row, and the stale response delayed more than 20 s) write real survey rows. They run only with your go-ahead.
