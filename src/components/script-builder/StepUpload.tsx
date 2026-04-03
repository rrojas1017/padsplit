import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Upload, Loader2, AlertCircle, Pencil } from 'lucide-react';
import mammoth from 'mammoth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ScriptQuestion } from '@/hooks/useResearchScripts';

const SCRIPT_TYPES = [
  { value: 'qualitative', label: 'Qualitative (open-ended, AI extracts themes)' },
  { value: 'quantitative', label: 'Quantitative (multiple choice, structured)' },
  { value: 'mixed', label: 'Mixed (both open-ended and structured)' },
];

const CAMPAIGN_TYPES = [
  { value: 'satisfaction', label: 'Member Satisfaction' },
  { value: 'market_research', label: 'Market Research' },
  { value: 'retention', label: 'Retention Check-in' },
  { value: 'audience_survey', label: 'Audience Survey' },
  { value: 'move_out_survey', label: 'Move-Out Survey' },
];

const TARGET_AUDIENCES = [
  { value: 'existing_member', label: 'Existing Members' },
  { value: 'former_booking', label: 'Former Bookings' },
  { value: 'rejected', label: 'Rejected Leads' },
  { value: 'account_created', label: 'Account Created' },
  { value: 'application_started', label: 'Application Started' },
  { value: 'approved_not_booked', label: 'Approved (Not Booked)' },
  { value: 'active_member', label: 'Active Members' },
];

export interface WizardData {
  name: string;
  description: string;
  scriptType: string;
  campaignType: string;
  targetAudience: string;
  slug: string;
  questions: ScriptQuestion[];
  introScript: string;
  rebuttalScript: string;
  closingScript: string;
  aiPrompt: string;
  aiModel: string;
  aiTemperature: number;
  isActive: boolean;
}

interface Props {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50);
}

export function StepUpload({ data, onChange }: Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);
    setIsProcessing(true);

    try {
      let text = '';
      if (file.name.endsWith('.txt')) {
        text = await file.text();
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value?.trim() || '';
      }

      if (!text) throw new Error('No text content found in the document');
      setExtractedText(text);

      // Send to edge function for AI parsing
      const { data: parsed, error: fnError } = await supabase.functions.invoke('parse-research-script', {
        body: { text },
      });

      if (fnError) throw new Error(fnError.message || 'Failed to parse document');
      if (parsed?.error) throw new Error(parsed.error);

      const questions: ScriptQuestion[] = (parsed.questions || []).map((q: any, i: number) => ({
        order: q.order || i + 1,
        question: q.text || q.question || '',
        type: q.type || 'open_ended',
        options: q.type === 'multiple_choice' ? q.options : undefined,
        required: q.required ?? true,
        ai_extraction_hint: q.ai_extraction_hint || '',
        section: q.section || undefined,
        probes: q.probes?.length ? q.probes : undefined,
        branch: q.branch && Object.keys(q.branch).length > 0 ? q.branch : undefined,
        is_internal: q.is_internal ?? false,
      }));

      onChange({
        name: parsed.name || data.name || 'Imported Script',
        description: parsed.description || data.description || '',
        introScript: parsed.intro_script || '',
        rebuttalScript: parsed.rebuttal_script || '',
        closingScript: parsed.closing_script || '',
        questions,
        slug: generateSlug(parsed.name || data.name || 'imported-script'),
      });

      toast.success(`Imported ${questions.length} questions from "${file.name}"`);
    } catch (err: any) {
      console.error('Import error:', err);
      setError(err.message || 'Failed to process document');
    } finally {
      setIsProcessing(false);
    }
  }, [data.name, data.description, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.docx') || file.name.endsWith('.doc') || file.name.endsWith('.txt'))) {
      processFile(file);
    } else {
      setError('Please upload a .docx or .txt file');
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left column — Upload */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold mb-1">Script Source</h3>
          <p className="text-xs text-muted-foreground">Upload a Word document or start from scratch</p>
        </div>

        <div
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            isProcessing ? 'pointer-events-none opacity-60' : 'cursor-pointer hover:border-primary/50'
          } border-border`}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => !isProcessing && document.getElementById('wizard-upload')?.click()}
        >
          <input
            id="wizard-upload"
            type="file"
            accept=".docx,.doc,.txt"
            className="hidden"
            onChange={handleFileSelect}
          />
          {isProcessing ? (
            <div className="space-y-3">
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
              <p className="text-sm font-medium">AI is parsing "{fileName}"...</p>
              <p className="text-xs text-muted-foreground">Detecting questions, types, and scripts</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Drop a .docx or .txt file here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {extractedText && (
          <div className="space-y-2">
            <Label className="text-xs">Extracted Text Preview</Label>
            <div className="max-h-64 overflow-y-auto bg-muted rounded-lg p-4 font-mono text-xs whitespace-pre-wrap">
              {extractedText.slice(0, 2000)}{extractedText.length > 2000 ? '...' : ''}
            </div>
          </div>
        )}

        {!extractedText && !isProcessing && (
          <div className="text-center pt-2">
            <Button variant="outline" size="sm" onClick={() => onChange({ questions: [{ order: 1, question: '', type: 'open_ended', required: true }] })}>
              <Pencil className="w-4 h-4 mr-2" /> Start from Scratch
            </Button>
          </div>
        )}
      </div>

      {/* Right column — Details */}
      <div className="space-y-5">
        <div>
          <h3 className="text-sm font-semibold mb-1">Script Details</h3>
          <p className="text-xs text-muted-foreground">Configure how this script will be used</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Script Name *</Label>
            <Input
              value={data.name}
              onChange={e => {
                const name = e.target.value;
                onChange({ name, slug: data.slug || generateSlug(name) });
              }}
              placeholder="e.g., Renewal Experience Survey"
            />
          </div>

          <div className="space-y-2">
            <Label>Script Type *</Label>
            <Select value={data.scriptType} onValueChange={v => onChange({ scriptType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCRIPT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Campaign Type *</Label>
            <Select value={data.campaignType} onValueChange={v => onChange({ campaignType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CAMPAIGN_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={data.description}
              onChange={e => onChange({ description: e.target.value })}
              placeholder="Purpose of this script..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Target Audience</Label>
            <Select value={data.targetAudience} onValueChange={v => onChange({ targetAudience: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TARGET_AUDIENCES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Campaign Tag (slug)</Label>
            <Input
              value={data.slug}
              onChange={e => onChange({ slug: e.target.value })}
              placeholder="auto-generated-from-name"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Used as the campaign_type value in the API</p>
          </div>
        </div>
      </div>
    </div>
  );
}
