import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { StepUpload, type WizardData } from './StepUpload';
import { StepQuestions } from './StepQuestions';
import { StepAIPrompt } from './StepAIPrompt';
import { StepPreview } from './StepPreview';
import { StepLaunch } from './StepLaunch';
import { toast } from 'sonner';

const STEPS = [
  { label: 'Upload & Define', key: 'upload' },
  { label: 'Build Questions', key: 'questions' },
  { label: 'AI Prompt', key: 'prompt' },
  { label: 'Preview', key: 'preview' },
  { label: 'Launch', key: 'launch' },
];

interface Props {
  onClose: () => void;
  onSave: (data: WizardData, isDraft: boolean) => Promise<void>;
}

const defaultData: WizardData = {
  name: '',
  description: '',
  scriptType: 'qualitative',
  campaignType: 'satisfaction',
  targetAudience: 'existing_member',
  slug: '',
  questions: [],
  introScript: '',
  rebuttalScript: '',
  closingScript: '',
  aiPrompt: '',
  aiModel: 'gemini-2.5-flash',
  aiTemperature: 0.2,
  isActive: false,
};

export function ScriptWizard({ onClose, onSave }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({ ...defaultData });
  const [isSaving, setIsSaving] = useState(false);

  const updateData = useCallback((updates: Partial<WizardData>) => {
    setData(prev => ({ ...prev, ...updates }));
  }, []);

  const canAdvance = (s: number): boolean => {
    if (s === 0) return !!data.name.trim() && !!data.scriptType;
    if (s === 1) return data.questions.filter(q => q.question?.trim()).length > 0;
    return true;
  };

  const handleNext = () => {
    if (!canAdvance(step)) {
      toast.error(step === 0 ? 'Please enter a script name and type' : 'Add at least one question');
      return;
    }
    setStep(prev => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => setStep(prev => Math.max(prev - 1, 0));

  const handleSave = async (isDraft: boolean) => {
    setIsSaving(true);
    try {
      const saveData = { ...data, isActive: isDraft ? false : data.isActive };
      await onSave(saveData, isDraft);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">New Script Wizard</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <button
              onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                i === step
                  ? 'bg-primary text-primary-foreground'
                  : i < step
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400 cursor-pointer hover:bg-green-500/20'
                  : 'bg-muted text-muted-foreground'
              }`}
              disabled={i > step}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                i === step ? 'bg-primary-foreground/20' : i < step ? 'bg-green-500 text-white' : 'bg-muted-foreground/20'
              }`}>
                {i < step ? '✓' : i + 1}
              </span>
              <span className="hidden sm:inline whitespace-nowrap">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-border mx-1" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {step === 0 && <StepUpload data={data} onChange={updateData} />}
        {step === 1 && <StepQuestions data={data} onChange={updateData} />}
        {step === 2 && <StepAIPrompt data={data} onChange={updateData} />}
        {step === 3 && <StepPreview data={data} />}
        {step === 4 && (
          <StepLaunch
            data={data}
            onChange={updateData}
            onSaveDraft={() => handleSave(true)}
            onLaunch={() => handleSave(false)}
            isSaving={isSaving}
          />
        )}
      </div>

      {/* Navigation */}
      {step < 4 && (
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={step === 0 ? onClose : handleBack}>
            <ChevronLeft className="w-4 h-4 mr-1" /> {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          <Button onClick={handleNext} disabled={!canAdvance(step)}>
            Next: {STEPS[step + 1]?.label} <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
