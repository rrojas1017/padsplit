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

  /** On-the-fly translation (fallback only) */
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

      const result = data as TranslatedContent;
      // Carry stable ids + ai hints from source onto translated questions
      const sourceQs = Array.isArray(script.questions) ? script.questions : [];
      const translatedQs = Array.isArray(result.questions) ? result.questions : [];
      result.questions = translatedQs.map((tq: any, idx: number) => {
        const sq: any = sourceQs[idx] || {};
        return {
          ...tq,
          id: sq.id ?? tq.id,
          ai_extraction_hint: tq.ai_extraction_hint ?? sq.ai_extraction_hint,
        };
      });
      return result;
    } catch (err) {
      console.error('Translation error:', err);
      toast.error('Translation service unavailable. Proceeding in English.');
      return null;
    } finally {
      setIsTranslating(false);
    }
  }, []);

  /** Translate and persist results back to research_scripts table */
  const translateAndStore = useCallback(async (
    scriptId: string,
    script: TranslatableScript
  ): Promise<boolean> => {
    // Mark as translating
    await supabase.from('research_scripts').update({
      translation_status: 'translating',
    } as any).eq('id', scriptId);

    try {
      const { data, error } = await supabase.functions.invoke('translate-script', {
        body: {
          intro: script.intro_script || '',
          closing: script.closing_script || '',
          rebuttal: script.rebuttal_script || '',
          questions: script.questions,
          targetLanguage: 'es',
        },
      });

      if (error || data?.error) {
        console.error('Translation error:', error || data?.error);
        await supabase.from('research_scripts').update({
          translation_status: 'failed',
        } as any).eq('id', scriptId);
        toast.error('Spanish translation failed');
        return false;
      }

      const translated = data as TranslatedContent;
      // Copy stable question ids + ai_extraction_hint from source onto translated questions
      // so raw_script_answers and downstream lookups stay aligned across languages.
      const sourceQs = Array.isArray(script.questions) ? script.questions : [];
      const translatedQs = Array.isArray(translated.questions) ? translated.questions : [];
      const alignedQs = translatedQs.map((tq: any, idx: number) => {
        const sq: any = sourceQs[idx] || {};
        return {
          ...tq,
          id: sq.id ?? tq.id,
          ai_extraction_hint: tq.ai_extraction_hint ?? sq.ai_extraction_hint,
        };
      });
      await supabase.from('research_scripts').update({
        intro_script_es: translated.intro || null,
        closing_script_es: translated.closing || null,
        rebuttal_script_es: translated.rebuttal || null,
        questions_es: alignedQs as any,
        translation_status: 'completed',
      } as any).eq('id', scriptId);

      toast.success('Spanish translation generated');
      return true;
    } catch (err) {
      console.error('Translation error:', err);
      await supabase.from('research_scripts').update({
        translation_status: 'failed',
      } as any).eq('id', scriptId);
      toast.error('Spanish translation failed');
      return false;
    }
  }, []);

  return { isTranslating, translateScript, translateAndStore };
}
