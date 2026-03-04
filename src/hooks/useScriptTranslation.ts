import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type SurveyLanguage = 'en' | 'es';

interface TranslatableScript {
  intro_script?: string | null;
  closing_script?: string | null;
  rebuttal_script?: string | null;
  questions: any[];
}

interface TranslatedContent {
  intro: string;
  closing: string;
  rebuttal: string;
  questions: any[];
}

export function useScriptTranslation() {
  const [isTranslating, setIsTranslating] = useState(false);

  const translateScript = useCallback(async (
    script: TranslatableScript,
    targetLanguage: SurveyLanguage
  ): Promise<TranslatedContent | null> => {
    if (targetLanguage === 'en') {
      return {
        intro: script.intro_script || '',
        closing: script.closing_script || '',
        rebuttal: script.rebuttal_script || '',
        questions: script.questions,
      };
    }

    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-script', {
        body: {
          intro: script.intro_script || '',
          closing: script.closing_script || '',
          rebuttal: script.rebuttal_script || '',
          questions: script.questions,
          targetLanguage,
        },
      });

      if (error) {
        console.error('Translation error:', error);
        toast.error('Failed to translate script. Proceeding in English.');
        return null;
      }

      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      return data as TranslatedContent;
    } catch (err) {
      console.error('Translation error:', err);
      toast.error('Translation service unavailable. Proceeding in English.');
      return null;
    } finally {
      setIsTranslating(false);
    }
  }, []);

  return { isTranslating, translateScript };
}
