import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ScriptQuestion } from '@/hooks/useResearchScripts';
import mammoth from 'mammoth';

interface ParsedScript {
  name: string;
  description: string;
  intro_script: string;
  rebuttal_script: string;
  closing_script: string;
  questions: ScriptQuestion[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (data: ParsedScript) => void;
}

export function ResearchScriptImportDialog({ open, onOpenChange, onImported }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);
    setIsProcessing(true);

    try {
      // Extract text from .docx using mammoth
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value?.trim();

      if (!text) {
        throw new Error('No text content found in the document');
      }

      // Send to edge function for AI parsing
      const { data, error: fnError } = await supabase.functions.invoke('parse-research-script', {
        body: { text },
      });

      if (fnError) throw new Error(fnError.message || 'Failed to parse document');
      if (data?.error) throw new Error(data.error);

      // Normalize questions
      const questions: ScriptQuestion[] = (data.questions || []).map((q: any, i: number) => ({
        order: q.order || i + 1,
        question: q.question,
        type: q.type || 'open_ended',
        options: q.type === 'multiple_choice' ? q.options : undefined,
        required: q.required ?? true,
        ai_extraction_hint: q.ai_extraction_hint || '',
      }));

      onImported({
        name: data.name || 'Imported Script',
        description: data.description || '',
        intro_script: data.intro_script || '',
        rebuttal_script: data.rebuttal_script || '',
        closing_script: data.closing_script || '',
        questions,
      });

      toast.success(`Imported ${questions.length} questions from "${file.name}"`);
      onOpenChange(false);
    } catch (err: any) {
      console.error('Import error:', err);
      setError(err.message || 'Failed to process document');
      toast.error('Import failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  }, [onImported, onOpenChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.docx') || file.name.endsWith('.doc'))) {
      processFile(file);
    } else {
      setError('Please upload a .docx file');
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Script from Document
          </DialogTitle>
          <DialogDescription>
            Upload a Word document (.docx) and AI will convert it into a ready-to-use research script.
          </DialogDescription>
        </DialogHeader>

        <div
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            isDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          } ${isProcessing ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !isProcessing && document.getElementById('docx-upload')?.click()}
        >
          <input
            id="docx-upload"
            type="file"
            accept=".docx,.doc"
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
              <FileText className="w-10 h-10 mx-auto text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Drop a .docx file here</p>
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

        <p className="text-xs text-muted-foreground">
          The AI will auto-detect question types (scale, multiple choice, yes/no, open-ended) and generate intro, closing, and rebuttal scripts.
        </p>
      </DialogContent>
    </Dialog>
  );
}
