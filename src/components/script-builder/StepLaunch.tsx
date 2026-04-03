import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Copy, Check, Rocket, Save, ClipboardList, Plug } from 'lucide-react';
import { toast } from 'sonner';
import type { WizardData } from './StepUpload';

interface Props {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
  onSaveDraft: () => Promise<void>;
  onLaunch: () => Promise<void>;
  isSaving: boolean;
}

export function StepLaunch({ data, onChange, onSaveDraft, onLaunch, isSaving }: Props) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const webhookUrl = `${supabaseUrl}/functions/v1/submit-conversation-audio`;
  const questionsCount = data.questions.filter(q => q.question?.trim()).length;
  const openEnded = data.questions.filter(q => q.type === 'open_ended').length;
  const structured = questionsCount - openEnded;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyBtn = ({ text, field }: { text: string; field: string }) => (
    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(text, field)}>
      {copiedField === field ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> Script Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Name:</span>
              <p className="font-medium">{data.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Type:</span>
              <p className="font-medium capitalize">{data.scriptType}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Questions:</span>
              <p className="font-medium">{questionsCount} ({openEnded} open-ended, {structured} structured)</p>
            </div>
            <div>
              <span className="text-muted-foreground">Target Audience:</span>
              <p className="font-medium capitalize">{data.targetAudience.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Campaign Tag:</span>
              <p className="font-mono text-xs bg-muted px-2 py-1 rounded inline-block">{data.slug}</p>
            </div>
            <div>
              <span className="text-muted-foreground">AI Model:</span>
              <p className="font-medium">{data.aiModel}</p>
            </div>
          </div>
          {data.description && (
            <>
              <Separator />
              <p className="text-sm text-muted-foreground">{data.description}</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialer Integration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plug className="w-4 h-4" /> Dialer Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This script uses the same backend pipeline as your existing surveys. Configure your dialer to send recordings with the campaign tag below.
          </p>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs w-28 shrink-0">Campaign Tag:</Label>
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono">{data.slug}</code>
              <CopyBtn text={data.slug} field="slug" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs w-28 shrink-0">Webhook URL:</Label>
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono truncate">{webhookUrl}</code>
              <CopyBtn text={webhookUrl} field="webhook" />
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1.5">
            <p className="font-medium">To connect to your dialer:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>In your dialer, create a new campaign</li>
              <li>Set the recording webhook to the URL above</li>
              <li>Pass the Campaign Tag as the <code className="bg-background px-1 rounded">campaign</code> parameter</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Launch Controls */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Script Status</Label>
              <p className="text-xs text-muted-foreground">Active scripts will process incoming recordings</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={data.isActive ? 'default' : 'secondary'}>{data.isActive ? 'Active' : 'Draft'}</Badge>
              <Switch checked={data.isActive} onCheckedChange={v => onChange({ isActive: v })} />
            </div>
          </div>

          <Separator />

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onSaveDraft} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" /> Save as Draft
            </Button>
            <Button className="flex-1" onClick={onLaunch} disabled={isSaving}>
              <Rocket className="w-4 h-4 mr-2" /> {data.isActive ? 'Launch Script' : 'Save Script'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
