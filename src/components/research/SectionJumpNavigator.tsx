import { CheckCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionEntry {
  name: string;
  firstQuestionIndex: number;
}

interface SectionJumpNavigatorProps {
  sections: SectionEntry[];
  currentQuestionIndex: number;
  visitedQuestionIndices: Set<number>;
  onJump: (questionIndex: number) => void;
}

function getSectionForIndex(sections: SectionEntry[], index: number): number {
  let sectionIdx = 0;
  for (let i = 0; i < sections.length; i++) {
    const nextStart = sections[i + 1]?.firstQuestionIndex ?? Infinity;
    if (index >= sections[i].firstQuestionIndex && index < nextStart) {
      sectionIdx = i;
      break;
    }
  }
  return sectionIdx;
}

function isSectionCompleted(
  section: SectionEntry,
  nextSectionStart: number,
  visitedQuestionIndices: Set<number>,
  currentQuestionIndex: number
): boolean {
  for (let i = section.firstQuestionIndex; i < nextSectionStart; i++) {
    if (i === currentQuestionIndex) return false;
    if (!visitedQuestionIndices.has(i)) return false;
  }
  return true;
}

export function SectionJumpNavigator({
  sections,
  currentQuestionIndex,
  visitedQuestionIndices,
  onJump,
}: SectionJumpNavigatorProps) {
  if (sections.length === 0) return null;

  const currentSectionIdx = getSectionForIndex(sections, currentQuestionIndex);

  return (
    <div className="w-52 shrink-0">
      <div className="bg-card border rounded-xl p-3 sticky top-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
          Sections
        </p>
        <div className="space-y-0.5">
          {sections.map((section, idx) => {
            const nextStart = sections[idx + 1]?.firstQuestionIndex ?? Infinity;
            const isCurrent = idx === currentSectionIdx;
            const isCompleted = !isCurrent && isSectionCompleted(section, nextStart, visitedQuestionIndices, currentQuestionIndex);

            return (
              <button
                key={idx}
                onClick={() => onJump(section.firstQuestionIndex)}
                className={cn(
                  'w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors',
                  isCurrent
                    ? 'bg-primary/10 text-primary font-semibold'
                    : isCompleted
                    ? 'text-muted-foreground hover:bg-accent/50'
                    : 'text-foreground hover:bg-accent/50'
                )}
              >
                <span className="shrink-0">
                  {isCompleted ? (
                    <CheckCircle className="w-3.5 h-3.5 text-primary" />
                  ) : isCurrent ? (
                    <ChevronRight className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <span className="w-3.5 h-3.5 inline-flex items-center justify-center rounded-full border border-muted-foreground/30 text-[9px] font-bold text-muted-foreground">
                      {idx + 1}
                    </span>
                  )}
                </span>
                <span className="truncate leading-tight">{section.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
