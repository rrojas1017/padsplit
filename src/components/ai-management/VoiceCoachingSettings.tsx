import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, X, Plus, Save, Loader2, Volume2, Square } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VoiceCoachingSettings {
  id?: string;
  coaching_tone: string;
  custom_expressions: string[];
  always_emphasize: string[];
  never_mention: string[];
  voice_id: string;
  is_active: boolean;
}

const VOICE_OPTIONS = [
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', description: 'Energetic male coach' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', description: 'Professional male' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Warm female' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', description: 'Friendly female' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', description: 'Professional female' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'Casual male' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'Authoritative male' },
];

const TONE_OPTIONS = [
  { value: 'energetic', label: 'Energetic Coach', description: 'High-energy, enthusiastic delivery' },
  { value: 'professional', label: 'Professional Mentor', description: 'Calm, structured feedback' },
  { value: 'friendly', label: 'Friendly Peer', description: 'Casual, supportive tone' },
];

export function VoiceCoachingSettings() {
  const [settings, setSettings] = useState<VoiceCoachingSettings>({
    coaching_tone: 'energetic',
    custom_expressions: [],
    always_emphasize: [],
    never_mention: [],
    voice_id: 'nPczCjzI2devNBz1zQrb',
    is_active: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newExpression, setNewExpression] = useState('');
  const [newEmphasize, setNewEmphasize] = useState('');
  const [newNeverMention, setNewNeverMention] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePreviewVoice = async () => {
    // If already playing, stop
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }

    setIsPreviewLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('preview-voice', {
        body: { voice_id: settings.voice_id },
      });

      if (error) throw error;
      if (!data?.audioUrl) throw new Error('No audio returned');

      // Create audio element and play
      const audio = new Audio(data.audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
      };
      
      audio.onerror = () => {
        toast.error('Failed to play audio');
        setIsPlaying(false);
      };

      await audio.play();
      setIsPlaying(true);
    } catch (error: any) {
      console.error('Preview voice error:', error);
      toast.error('Failed to preview voice');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('voice_coaching_settings')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          id: data.id,
          coaching_tone: data.coaching_tone || 'energetic',
          custom_expressions: data.custom_expressions || [],
          always_emphasize: data.always_emphasize || [],
          never_mention: data.never_mention || [],
          voice_id: data.voice_id || 'nPczCjzI2devNBz1zQrb',
          is_active: data.is_active ?? true,
        });
      }
    } catch (error: any) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (settings.id) {
        const { error } = await supabase
          .from('voice_coaching_settings')
          .update({
            coaching_tone: settings.coaching_tone,
            custom_expressions: settings.custom_expressions,
            always_emphasize: settings.always_emphasize,
            never_mention: settings.never_mention,
            voice_id: settings.voice_id,
            is_active: settings.is_active,
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('voice_coaching_settings')
          .insert({
            coaching_tone: settings.coaching_tone,
            custom_expressions: settings.custom_expressions,
            always_emphasize: settings.always_emphasize,
            never_mention: settings.never_mention,
            voice_id: settings.voice_id,
            is_active: settings.is_active,
          })
          .select()
          .single();

        if (error) throw error;
        setSettings(prev => ({ ...prev, id: data.id }));
      }
      toast.success('Voice coaching settings saved');
    } catch (error: any) {
      toast.error('Failed to save settings');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const addTag = (field: 'custom_expressions' | 'always_emphasize' | 'never_mention', value: string) => {
    if (!value.trim()) return;
    setSettings(prev => ({
      ...prev,
      [field]: [...prev[field], value.trim()],
    }));
  };

  const removeTag = (field: 'custom_expressions' | 'always_emphasize' | 'never_mention', index: number) => {
    setSettings(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const selectedVoice = VOICE_OPTIONS.find(v => v.id === settings.voice_id);
  const selectedTone = TONE_OPTIONS.find(t => t.value === settings.coaching_tone);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading settings...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mic className="h-5 w-5 text-purple-500" />
            Voice Coaching Settings
          </CardTitle>
          <CardDescription>
            Customize how AI-generated voice coaching sounds and what it emphasizes
          </CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="voice-active" className="text-sm text-muted-foreground">
              {settings.is_active ? 'Active' : 'Inactive'}
            </Label>
            <Switch
              id="voice-active"
              checked={settings.is_active}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, is_active: checked }))}
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Coaching Tone */}
        <div className="space-y-2">
          <Label>Coaching Tone</Label>
          <Select
            value={settings.coaching_tone}
            onValueChange={(value) => setSettings(prev => ({ ...prev, coaching_tone: value }))}
          >
            <SelectTrigger>
              <SelectValue>
                {selectedTone?.label || 'Select tone'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TONE_OPTIONS.map((tone) => (
                <SelectItem key={tone.value} value={tone.value}>
                  <div>
                    <span className="font-medium">{tone.label}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{tone.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Voice Selection */}
        <div className="space-y-2">
          <Label>Voice</Label>
          <div className="flex gap-2">
            <Select
              value={settings.voice_id}
              onValueChange={(value) => {
                setSettings(prev => ({ ...prev, voice_id: value }));
                // Stop any playing audio when voice changes
                if (audioRef.current) {
                  audioRef.current.pause();
                  audioRef.current.currentTime = 0;
                  setIsPlaying(false);
                }
              }}
            >
              <SelectTrigger className="flex-1">
                <SelectValue>
                  {selectedVoice ? `${selectedVoice.name} - ${selectedVoice.description}` : 'Select voice'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {VOICE_OPTIONS.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    <div>
                      <span className="font-medium">{voice.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{voice.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handlePreviewVoice}
              disabled={isPreviewLoading}
              className="shrink-0"
            >
              {isPreviewLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPlaying ? (
                <Square className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
              <span className="ml-2">{isPlaying ? 'Stop' : 'Preview'}</span>
            </Button>
          </div>
        </div>

        {/* Custom Expressions */}
        <div className="space-y-2">
          <Label>Custom Opening Expressions</Label>
          <p className="text-xs text-muted-foreground">Add phrases the coach will use when celebrating wins</p>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., 'You're on fire today!'"
              value={newExpression}
              onChange={(e) => setNewExpression(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag('custom_expressions', newExpression);
                  setNewExpression('');
                }
              }}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                addTag('custom_expressions', newExpression);
                setNewExpression('');
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {settings.custom_expressions.map((expr, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                "{expr}"
                <button onClick={() => removeTag('custom_expressions', i)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Always Emphasize */}
        <div className="space-y-2">
          <Label>Always Emphasize</Label>
          <p className="text-xs text-muted-foreground">Topics the coach should always mention when relevant</p>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., 'member experience', 'closing techniques'"
              value={newEmphasize}
              onChange={(e) => setNewEmphasize(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag('always_emphasize', newEmphasize);
                  setNewEmphasize('');
                }
              }}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                addTag('always_emphasize', newEmphasize);
                setNewEmphasize('');
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {settings.always_emphasize.map((item, i) => (
              <Badge key={i} variant="outline" className="gap-1 border-green-500/50 text-green-700 dark:text-green-400">
                {item}
                <button onClick={() => removeTag('always_emphasize', i)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Never Mention */}
        <div className="space-y-2">
          <Label>Never Mention</Label>
          <p className="text-xs text-muted-foreground">Words or phrases the coach should avoid</p>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., 'crushed it', specific competitor names"
              value={newNeverMention}
              onChange={(e) => setNewNeverMention(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag('never_mention', newNeverMention);
                  setNewNeverMention('');
                }
              }}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                addTag('never_mention', newNeverMention);
                setNewNeverMention('');
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {settings.never_mention.map((item, i) => (
              <Badge key={i} variant="outline" className="gap-1 border-red-500/50 text-red-700 dark:text-red-400">
                {item}
                <button onClick={() => removeTag('never_mention', i)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> These settings apply to all newly generated coaching audio. 
            Existing audio won't be affected until regenerated.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}