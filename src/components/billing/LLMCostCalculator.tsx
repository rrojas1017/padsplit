import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/utils/billingCalculations';
import { Calculator, Upload, Phone, Zap, Settings2, TrendingDown } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

// Pricing constants based on actual api_costs data and provider rates
const CALCULATOR_PRICING = {
  stt: {
    deepgram: 0.0043,      // per minute
    elevenlabs: 0.034,     // per minute
  },
  llm: {
    deepseek: 0.0007,      // avg per call
    gemini_flash: 0.009,   // avg per call
    gemini_pro: 0.04,      // for complex calls
  },
  polish: 0.0006,          // per call (flash-lite)
  tts: {
    jeff_coaching: 0.18,   // avg per call
    katty_qa: 0.16,        // avg per call
  },
  qa_scoring: 0.0001,      // per call
  speaker_id: 0.00007,     // per call
};

interface CalculatorConfig {
  sttProvider: 'deepgram' | 'elevenlabs';
  llmProvider: 'deepseek' | 'gemini_flash' | 'hybrid';
  aiPolish: boolean;
  jeffCoachingAudio: boolean;
  kattyQAAudio: boolean;
  qaScoring: boolean;
}

interface VolumeInputs {
  recordsPerMonth: number;
  avgCallDuration: number;
  nonBookingPercentage: number;
}

const PRESETS: Record<string, CalculatorConfig> = {
  economy: {
    sttProvider: 'deepgram',
    llmProvider: 'deepseek',
    aiPolish: false,
    jeffCoachingAudio: false,
    kattyQAAudio: false,
    qaScoring: true,
  },
  quality: {
    sttProvider: 'deepgram',
    llmProvider: 'gemini_flash',
    aiPolish: true,
    jeffCoachingAudio: false,
    kattyQAAudio: false,
    qaScoring: true,
  },
  fullAudio: {
    sttProvider: 'deepgram',
    llmProvider: 'gemini_flash',
    aiPolish: true,
    jeffCoachingAudio: true,
    kattyQAAudio: true,
    qaScoring: true,
  },
};

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b', '#10b981', '#6366f1'];

const LLMCostCalculator = () => {
  const [intakeMethod, setIntakeMethod] = useState<'uploads' | 'recordings'>('recordings');
  const [config, setConfig] = useState<CalculatorConfig>({
    sttProvider: 'deepgram',
    llmProvider: 'hybrid',
    aiPolish: true,
    jeffCoachingAudio: false,
    kattyQAAudio: false,
    qaScoring: true,
  });
  const [volume, setVolume] = useState<VolumeInputs>({
    recordsPerMonth: 1000,
    avgCallDuration: 5,
    nonBookingPercentage: 30,
  });
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  const loadCurrentConfig = async () => {
    setIsLoadingConfig(true);
    try {
      const { data: llmSettings } = await supabase
        .from('llm_provider_settings')
        .select('*')
        .eq('is_active', true);

      const { data: sttSettings } = await supabase
        .from('stt_provider_settings')
        .select('*')
        .eq('is_active', true)
        .single();

      if (sttSettings) {
        setConfig(prev => ({
          ...prev,
          sttProvider: sttSettings.provider_name as 'deepgram' | 'elevenlabs',
        }));
      }

      if (llmSettings && llmSettings.length > 0) {
        const hasDeepSeek = llmSettings.some(s => s.provider_name === 'deepseek');
        const hasGemini = llmSettings.some(s => s.provider_name === 'gemini');
        
        if (hasDeepSeek && hasGemini) {
          setConfig(prev => ({ ...prev, llmProvider: 'hybrid' }));
        } else if (hasDeepSeek) {
          setConfig(prev => ({ ...prev, llmProvider: 'deepseek' }));
        } else {
          setConfig(prev => ({ ...prev, llmProvider: 'gemini_flash' }));
        }
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const applyPreset = (presetName: keyof typeof PRESETS) => {
    setConfig(PRESETS[presetName]);
  };

  const calculations = useMemo(() => {
    const totalMinutes = volume.recordsPerMonth * volume.avgCallDuration;
    const bookingRecords = volume.recordsPerMonth * (1 - volume.nonBookingPercentage / 100);
    const nonBookingRecords = volume.recordsPerMonth * (volume.nonBookingPercentage / 100);

    // STT costs
    const sttRate = CALCULATOR_PRICING.stt[config.sttProvider];
    const sttCost = totalMinutes * sttRate;

    // LLM costs (hybrid mode uses DeepSeek for bookings, Gemini for non-bookings)
    let llmCost = 0;
    if (config.llmProvider === 'hybrid') {
      llmCost = (bookingRecords * CALCULATOR_PRICING.llm.deepseek) + 
                (nonBookingRecords * CALCULATOR_PRICING.llm.gemini_flash);
    } else if (config.llmProvider === 'deepseek') {
      llmCost = volume.recordsPerMonth * CALCULATOR_PRICING.llm.deepseek;
    } else {
      llmCost = volume.recordsPerMonth * CALCULATOR_PRICING.llm.gemini_flash;
    }

    // Polish costs
    const polishCost = config.aiPolish ? volume.recordsPerMonth * CALCULATOR_PRICING.polish : 0;

    // TTS costs
    const jeffCost = config.jeffCoachingAudio ? bookingRecords * CALCULATOR_PRICING.tts.jeff_coaching : 0;
    const kattyCost = config.kattyQAAudio ? volume.recordsPerMonth * CALCULATOR_PRICING.tts.katty_qa : 0;
    const ttsCost = jeffCost + kattyCost;

    // QA Scoring
    const qaCost = config.qaScoring ? volume.recordsPerMonth * CALCULATOR_PRICING.qa_scoring : 0;

    // Speaker ID (always on for recordings)
    const speakerIdCost = intakeMethod === 'recordings' ? volume.recordsPerMonth * CALCULATOR_PRICING.speaker_id : 0;

    const totalCost = sttCost + llmCost + polishCost + ttsCost + qaCost + speakerIdCost;
    const costPerRecord = totalCost / volume.recordsPerMonth;
    const costPerMinute = totalCost / totalMinutes;

    // Calculate economy mode comparison
    const economyConfig = PRESETS.economy;
    const economySttCost = totalMinutes * CALCULATOR_PRICING.stt[economyConfig.sttProvider];
    const economyLlmCost = volume.recordsPerMonth * CALCULATOR_PRICING.llm[economyConfig.llmProvider as 'deepseek'];
    const economyQaCost = volume.recordsPerMonth * CALCULATOR_PRICING.qa_scoring;
    const economyTotal = economySttCost + economyLlmCost + economyQaCost + speakerIdCost;
    const savings = totalCost - economyTotal;

    return {
      breakdown: [
        { name: 'STT', value: sttCost, color: CHART_COLORS[0] },
        { name: 'LLM Analysis', value: llmCost, color: CHART_COLORS[1] },
        { name: 'AI Polish', value: polishCost, color: CHART_COLORS[2] },
        { name: 'TTS Audio', value: ttsCost, color: CHART_COLORS[3] },
        { name: 'QA Scoring', value: qaCost, color: CHART_COLORS[4] },
        { name: 'Speaker ID', value: speakerIdCost, color: CHART_COLORS[5] },
      ].filter(item => item.value > 0),
      totalCost,
      costPerRecord,
      costPerMinute,
      economyTotal,
      savings,
      savingsPercentage: economyTotal > 0 ? ((savings / economyTotal) * 100) : 0,
    };
  }, [config, volume, intakeMethod]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              LLM Cost Calculator
            </CardTitle>
            <CardDescription>
              Project monthly costs based on provider configuration and volume
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadCurrentConfig}
            disabled={isLoadingConfig}
          >
            <Settings2 className="h-4 w-4 mr-2" />
            {isLoadingConfig ? 'Loading...' : 'Load Current Config'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Intake Method */}
        <Tabs value={intakeMethod} onValueChange={(v) => setIntakeMethod(v as 'uploads' | 'recordings')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="uploads" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Uploads (Batch)
            </TabsTrigger>
            <TabsTrigger value="recordings" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Recordings (Live)
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium">Presets:</span>
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
            onClick={() => applyPreset('economy')}
          >
            <Zap className="h-3 w-3 mr-1" />
            Economy
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
            onClick={() => applyPreset('quality')}
          >
            Quality
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
            onClick={() => applyPreset('fullAudio')}
          >
            Full Audio
          </Badge>
        </div>

        <Separator />

        {/* Provider Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="font-medium">Provider Configuration</h4>
            
            {/* STT Provider */}
            <div className="flex items-center justify-between">
              <div>
                <Label>STT Provider</Label>
                <p className="text-xs text-muted-foreground">
                  {config.sttProvider === 'deepgram' ? '$0.0043/min' : '$0.034/min'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${config.sttProvider === 'deepgram' ? 'font-bold' : ''}`}>
                  Deepgram
                </span>
                <Switch
                  checked={config.sttProvider === 'elevenlabs'}
                  onCheckedChange={(checked) =>
                    setConfig(prev => ({ ...prev, sttProvider: checked ? 'elevenlabs' : 'deepgram' }))
                  }
                />
                <span className={`text-xs ${config.sttProvider === 'elevenlabs' ? 'font-bold' : ''}`}>
                  ElevenLabs
                </span>
              </div>
            </div>

            {/* LLM Provider */}
            <div className="space-y-2">
              <Label>LLM Provider</Label>
              <div className="flex gap-2">
                {(['deepseek', 'hybrid', 'gemini_flash'] as const).map((provider) => (
                  <Badge
                    key={provider}
                    variant={config.llmProvider === provider ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setConfig(prev => ({ ...prev, llmProvider: provider }))}
                  >
                    {provider === 'deepseek' && 'DeepSeek ($0.0007)'}
                    {provider === 'hybrid' && 'Hybrid (Recommended)'}
                    {provider === 'gemini_flash' && 'Gemini ($0.009)'}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>AI Polish</Label>
                  <p className="text-xs text-muted-foreground">$0.0006/call</p>
                </div>
                <Switch
                  checked={config.aiPolish}
                  onCheckedChange={(checked) =>
                    setConfig(prev => ({ ...prev, aiPolish: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Jeff Coaching Audio</Label>
                  <p className="text-xs text-muted-foreground">~$0.18/call (bookings only)</p>
                </div>
                <Switch
                  checked={config.jeffCoachingAudio}
                  onCheckedChange={(checked) =>
                    setConfig(prev => ({ ...prev, jeffCoachingAudio: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Katty QA Audio</Label>
                  <p className="text-xs text-muted-foreground">~$0.16/call</p>
                </div>
                <Switch
                  checked={config.kattyQAAudio}
                  onCheckedChange={(checked) =>
                    setConfig(prev => ({ ...prev, kattyQAAudio: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>QA Scoring</Label>
                  <p className="text-xs text-muted-foreground">$0.0001/call</p>
                </div>
                <Switch
                  checked={config.qaScoring}
                  onCheckedChange={(checked) =>
                    setConfig(prev => ({ ...prev, qaScoring: checked }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Volume Inputs */}
          <div className="space-y-4">
            <h4 className="font-medium">Volume Projections</h4>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Records per Month</Label>
                <span className="text-sm font-medium">{volume.recordsPerMonth.toLocaleString()}</span>
              </div>
              <Slider
                value={[volume.recordsPerMonth]}
                onValueChange={([value]) => setVolume(prev => ({ ...prev, recordsPerMonth: value }))}
                min={100}
                max={10000}
                step={100}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Avg Call Duration (min)</Label>
                <span className="text-sm font-medium">{volume.avgCallDuration} min</span>
              </div>
              <Slider
                value={[volume.avgCallDuration]}
                onValueChange={([value]) => setVolume(prev => ({ ...prev, avgCallDuration: value }))}
                min={1}
                max={30}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Non-Booking Calls (%)</Label>
                <span className="text-sm font-medium">{volume.nonBookingPercentage}%</span>
              </div>
              <Slider
                value={[volume.nonBookingPercentage]}
                onValueChange={([value]) => setVolume(prev => ({ ...prev, nonBookingPercentage: value }))}
                min={0}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                Non-booking calls use Gemini in hybrid mode for quality analysis
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Results */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cost Breakdown Chart */}
          <div>
            <h4 className="font-medium mb-4">Cost Breakdown</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={calculations.breakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {calculations.breakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cost Summary */}
          <div className="space-y-4">
            <h4 className="font-medium">Projected Costs</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Monthly Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(calculations.totalCost)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Per Record</p>
                  <p className="text-2xl font-bold">{formatCurrency(calculations.costPerRecord)}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Per Minute of Talk Time</p>
                <p className="text-xl font-bold">{formatCurrency(calculations.costPerMinute)}</p>
              </CardContent>
            </Card>

            {calculations.savings > 0 && (
              <Card className="border-amber-500 bg-amber-500/10">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-amber-500" />
                    <p className="text-sm font-medium">Potential Savings with Economy Mode</p>
                  </div>
                  <p className="text-xl font-bold text-amber-600">
                    {formatCurrency(calculations.savings)}/month ({calculations.savingsPercentage.toFixed(0)}% more)
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LLMCostCalculator;
