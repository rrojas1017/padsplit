import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhoneOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StepState = 'complete' | 'active' | 'upcoming';

export interface TrackerStep {
  id: string;
  label: string;
  state: StepState;
}

interface StepTrackerProps {
  steps: TrackerStep[];
  /** Optional: cluster question dots when > this count (default 5) */
  questionClusterThreshold?: number;
  /** Total questions count — used for cluster mode label */
  totalQuestions?: number;
  /** Active question index within the question block — used for cluster label */
  activeQuestionIndex?: number;
  onEndCall?: () => void;
}

function StepNode({ step }: { step: TrackerStep }) {
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div
        className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300',
          step.state === 'complete' && 'bg-primary text-primary-foreground',
          step.state === 'active' && [
            'bg-primary text-primary-foreground',
            'ring-2 ring-primary/30 ring-offset-2 ring-offset-background',
            'shadow-[0_0_10px_2px_hsl(var(--primary)/0.25)]',
          ],
          step.state === 'upcoming' && 'border-2 border-muted-foreground/25 bg-background',
        )}
      >
        {step.state === 'complete' && <Check className="w-3 h-3 stroke-[2.5]" />}
        {step.state === 'active' && (
          <span className="w-2 h-2 rounded-full bg-primary-foreground" />
        )}
      </div>
      <span
        className={cn(
          'text-[10px] leading-none whitespace-nowrap',
          step.state === 'active' && 'text-primary font-semibold',
          step.state === 'complete' && 'text-muted-foreground',
          step.state === 'upcoming' && 'text-muted-foreground/50',
        )}
      >
        {step.label}
      </span>
    </div>
  );
}

function Connector({ completed }: { completed: boolean }) {
  return (
    <div
      className={cn(
        'flex-1 h-px mt-[-9px] transition-colors duration-300',
        completed ? 'bg-primary/40' : 'bg-border',
      )}
    />
  );
}

export function StepTracker({
  steps,
  questionClusterThreshold = 5,
  totalQuestions,
  activeQuestionIndex,
  onEndCall,
}: StepTrackerProps) {
  // Split steps into prefix (non-question), question block, suffix (non-question)
  const questionSteps = steps.filter(s => s.id.startsWith('q-'));
  const nonQuestionSteps = steps.filter(s => !s.id.startsWith('q-'));
  const useCluster = questionSteps.length > questionClusterThreshold;

  // Build the rendered nodes list
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
          <StepNode
            key="q-cluster"
            step={{ id: 'q-cluster', label: clusterLabel, state: clusterState }}
          />
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

  return (
    <div className="flex items-center gap-2">
      {/* Track */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
        {renderNodes()}
      </div>

      {/* End Call button */}
      {onEndCall && (
        <Button
          variant="destructive"
          size="sm"
          className="h-7 px-2.5 text-xs gap-1 shrink-0 ml-3"
          onClick={onEndCall}
        >
          <PhoneOff className="w-3 h-3" />
          End Call
        </Button>
      )}
    </div>
  );
}

/** Build TrackerStep array from script structure + current phase info */
export function buildSteps(params: {
  hasVerify?: boolean;
  hasIntro: boolean;
  hasClosing: boolean;
  questions: unknown[];
  phase: string;
  questionIndex: number;
}): TrackerStep[] {
  const { hasVerify, hasIntro, hasClosing, questions, phase, questionIndex } = params;

  const steps: TrackerStep[] = [];

  if (hasVerify) steps.push({ id: 'verify', label: 'Verify', state: 'upcoming' });
  if (hasIntro) steps.push({ id: 'intro', label: 'Intro', state: 'upcoming' });
  steps.push({ id: 'consent', label: 'Consent', state: 'upcoming' });
  questions.forEach((_, i) =>
    steps.push({ id: `q-${i}`, label: `Q${i + 1}`, state: 'upcoming' })
  );
  if (hasClosing) steps.push({ id: 'closing', label: 'Closing', state: 'upcoming' });

  // Determine active index
  let activeIndex = -1;
  if (phase === 'verify') activeIndex = steps.findIndex(s => s.id === 'verify');
  else if (phase === 'intro') activeIndex = steps.findIndex(s => s.id === 'intro');
  else if (phase === 'consent') activeIndex = steps.findIndex(s => s.id === 'consent');
  else if (phase === 'question') activeIndex = steps.findIndex(s => s.id === `q-${questionIndex}`);
  else if (phase === 'closing') activeIndex = steps.findIndex(s => s.id === 'closing');
  else if (phase === 'rebuttal') activeIndex = steps.findIndex(s => s.id === 'consent');

  // Assign states
  return steps.map((step, i) => ({
    ...step,
    state:
      i < activeIndex ? 'complete' :
      i === activeIndex ? 'active' :
      'upcoming',
  }));
}
