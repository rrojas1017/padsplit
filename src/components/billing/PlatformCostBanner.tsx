import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

const PlatformCostBanner = () => {
  return (
    <Alert className="border-primary/30 bg-primary/5">
      <Info className="h-4 w-4 text-primary" />
      <AlertTitle className="text-primary">API Costs vs. Platform Costs</AlertTitle>
      <AlertDescription className="text-muted-foreground">
        This page tracks <strong>third-party API costs</strong> (Deepgram STT, ElevenLabs TTS, AI analysis) logged per record. 
        Your <strong>Lovable Cloud platform costs</strong> (compute, hosting, edge function invocations) are billed separately and 
        can be viewed in your{' '}
        <a 
          href="https://lovable.dev/settings" 
          target="_blank" 
          rel="noopener noreferrer"
          className="underline text-primary hover:text-primary/80"
        >
          workspace billing settings
        </a>.
      </AlertDescription>
    </Alert>
  );
};

export default PlatformCostBanner;
