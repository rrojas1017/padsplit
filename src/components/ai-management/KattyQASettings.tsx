import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, X, Sparkles, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface KattyQASettingsData {
  id?: string;
  voice_id: string;
  coaching_tone: string;
  max_audio_length_seconds: number;
  always_emphasize: string[];
  never_mention: string[];
  custom_expressions: string[];
  is_active: boolean;
}

const VOICE_OPTIONS = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Warm, empathetic female' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', description: 'Professional, clear female' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', description: 'British, friendly female' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', description: 'Soft, gentle female' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', description: 'Energetic, upbeat female' },
];

const TONE_OPTIONS = [
  { value: 'empathetic', label: 'Empathetic & Supportive' },
  { value: 'encouraging', label: 'Encouraging & Positive' },
  { value: 'professional', label: 'Professional & Direct' },
  { value: 'nurturing', label: 'Nurturing & Patient' },
];

const LENGTH_OPTIONS = [
  { value: 45, label: '45 seconds' },
  { value: 60, label: '60 seconds' },
  { value: 90, label: '90 seconds' },
  { value: 120, label: '2 minutes' },
];

export const KattyQASettings: React.FC = () => {
  const [settings, setSettings] = useState<KattyQASettingsData>({
    voice_id: 'EXAVITQu4vr4xnSDxMaL',
    coaching_tone: 'empathetic',
    max_audio_length_seconds: 60,
    always_emphasize: [],
    never_mention: [],
    custom_expressions: [],
    is_active: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [newEmphasize, setNewEmphasize] = useState('');
  const [newNeverMention, setNewNeverMention] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('qa_coaching_settings')
        .select('*')
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching QA coaching settings:', error);
        return;
      }

      if (data) {
        setSettings({
          id: data.id,
          voice_id: data.voice_id,
          coaching_tone: data.coaching_tone,
          max_audio_length_seconds: data.max_audio_length_seconds,
          always_emphasize: data.always_emphasize || [],
          never_mention: data.never_mention || [],
          custom_expressions: data.custom_expressions || [],
          is_active: data.is_active,
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const dataToSave = {
        voice_id: settings.voice_id,
        coaching_tone: settings.coaching_tone,
        max_audio_length_seconds: settings.max_audio_length_seconds,
        always_emphasize: settings.always_emphasize,
        never_mention: settings.never_mention,
        custom_expressions: settings.custom_expressions,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (settings.id) {
        const { error } = await supabase
          .from('qa_coaching_settings')
          .update(dataToSave)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('qa_coaching_settings')
          .insert(dataToSave)
          .select()
          .single();

        if (error) throw error;
        setSettings(prev => ({ ...prev, id: data.id }));
      }

      toast.success('Katty QA settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBatchGenerate = async () => {
    setIsBatchGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('batch-generate-qa-coaching');

      if (error) throw error;

      toast.success(data?.message || 'Batch QA coaching generation started!');
    } catch (error) {
      console.error('Error starting batch generation:', error);
      toast.error('Failed to start batch generation');
    } finally {
      setIsBatchGenerating(false);
    }
  };

  const addEmphasizeTopic = () => {
    if (newEmphasize.trim() && !settings.always_emphasize.includes(newEmphasize.trim())) {
      setSettings(prev => ({
        ...prev,
        always_emphasize: [...prev.always_emphasize, newEmphasize.trim()]
      }));
      setNewEmphasize('');
    }
  };

  const removeEmphasizeTopic = (topic: string) => {
    setSettings(prev => ({
      ...prev,
      always_emphasize: prev.always_emphasize.filter(t => t !== topic)
    }));
  };

  const addNeverMention = () => {
    if (newNeverMention.trim() && !settings.never_mention.includes(newNeverMention.trim())) {
      setSettings(prev => ({
        ...prev,
        never_mention: [...prev.never_mention, newNeverMention.trim()]
      }));
      setNewNeverMention('');
    }
  };

  const removeNeverMention = (topic: string) => {
    setSettings(prev => ({
      ...prev,
      never_mention: prev.never_mention.filter(t => t !== topic)
    }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const selectedVoice = VOICE_OPTIONS.find(v => v.id === settings.voice_id);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-pink-500/20 flex items-center justify-center">
            <Volume2 className="h-5 w-5 text-pink-500" />
          </div>
          <div>
            <CardTitle>Katty QA Voice Settings</CardTitle>
            <CardDescription>
              Configure the AI QA coach that provides empathetic quality feedback to agents
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Voice Selection */}
        <div className="space-y-2">
          <Label>Voice</Label>
          <Select
            value={settings.voice_id}
            onValueChange={(value) => setSettings(prev => ({ ...prev, voice_id: value }))}
          >
            <SelectTrigger>
              <SelectValue>
                {selectedVoice ? `${selectedVoice.name} - ${selectedVoice.description}` : 'Select voice'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {VOICE_OPTIONS.map((voice) => (
                <SelectItem key={voice.id} value={voice.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{voice.name}</span>
                    <span className="text-xs text-muted-foreground">{voice.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Coaching Tone */}
        <div className="space-y-2">
          <Label>Coaching Tone</Label>
          <Select
            value={settings.coaching_tone}
            onValueChange={(value) => setSettings(prev => ({ ...prev, coaching_tone: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONE_OPTIONS.map((tone) => (
                <SelectItem key={tone.value} value={tone.value}>
                  {tone.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Max Audio Length */}
        <div className="space-y-2">
          <Label>Maximum Audio Length</Label>
          <Select
            value={settings.max_audio_length_seconds.toString()}
            onValueChange={(value) => setSettings(prev => ({ ...prev, max_audio_length_seconds: parseInt(value) }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LENGTH_OPTIONS.map((length) => (
                <SelectItem key={length.value} value={length.value.toString()}>
                  {length.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Always Emphasize Topics */}
        <div className="space-y-2">
          <Label>Always Emphasize</Label>
          <p className="text-xs text-muted-foreground">Topics Katty should always mention in coaching</p>
          <div className="flex gap-2">
            <Input
              placeholder="Add topic to emphasize..."
              value={newEmphasize}
              onChange={(e) => setNewEmphasize(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmphasizeTopic())}
            />
            <Button variant="outline" size="icon" onClick={addEmphasizeTopic}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {settings.always_emphasize.map((topic, index) => (
              <Badge key={index} variant="secondary" className="gap-1">
                {topic}
                <button onClick={() => removeEmphasizeTopic(topic)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Never Mention Topics */}
        <div className="space-y-2">
          <Label>Never Mention</Label>
          <p className="text-xs text-muted-foreground">Topics Katty should avoid in coaching</p>
          <div className="flex gap-2">
            <Input
              placeholder="Add topic to avoid..."
              value={newNeverMention}
              onChange={(e) => setNewNeverMention(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNeverMention())}
            />
            <Button variant="outline" size="icon" onClick={addNeverMention}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {settings.never_mention.map((topic, index) => (
              <Badge key={index} variant="destructive" className="gap-1">
                {topic}
                <button onClick={() => removeNeverMention(topic)} className="ml-1 hover:text-destructive-foreground">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBatchGenerate}
            disabled={isBatchGenerating}
            className="gap-2"
          >
            {isBatchGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate All Missing QA Coaching
          </Button>
          
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Save Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
