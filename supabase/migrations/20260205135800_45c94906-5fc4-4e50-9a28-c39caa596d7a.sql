-- Create llm_prompt_enhancements table for provider-specific prompt tuning
CREATE TABLE public.llm_prompt_enhancements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name text NOT NULL, -- 'deepseek' or 'lovable_ai'
  enhancement_type text NOT NULL, -- 'few_shot_examples', 'scoring_rubric', 'negative_signals'
  content text NOT NULL, -- The actual prompt content to inject
  priority int DEFAULT 0, -- Higher priority = earlier in prompt
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.llm_prompt_enhancements ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to manage (used by edge functions)
CREATE POLICY "Service role can manage llm_prompt_enhancements" 
ON public.llm_prompt_enhancements 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Policy: Authenticated users can view (for UI display)
CREATE POLICY "Authenticated users can view llm_prompt_enhancements"
ON public.llm_prompt_enhancements
FOR SELECT
TO authenticated
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_llm_prompt_enhancements_updated_at
BEFORE UPDATE ON public.llm_prompt_enhancements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial DeepSeek prompt enhancements
INSERT INTO public.llm_prompt_enhancements (provider_name, enhancement_type, content, priority) VALUES
-- Few-shot examples for readiness detection (highest priority)
('deepseek', 'few_shot_examples', 'READINESS CLASSIFICATION EXAMPLES - Study these carefully:

EXAMPLE 1 - LOW READINESS (Issue/Complaint Call):
Transcript snippet: "I booked a room and paid money but there is an issue with my service dog. I need to talk to someone about getting my money back."
Analysis: moveInReadiness = "low" 
Why: Member is NOT trying to book - they are complaining about an existing issue and may want a refund.

EXAMPLE 2 - LOW READINESS (Just Browsing):
Transcript snippet: "I was just calling to see what you all have available. I am not ready to move yet, maybe in a few months."
Analysis: moveInReadiness = "low"
Why: Member explicitly states no urgency, timeline is months away.

EXAMPLE 3 - MEDIUM READINESS (Interested but Exploring):
Transcript snippet: "I found a listing online and wanted to know more about it. What are the requirements? My budget is around $200 a week."
Analysis: moveInReadiness = "medium"
Why: Member shows interest, has budget, but is still gathering information, no specific timeline.

EXAMPLE 4 - HIGH READINESS (Ready to Move):
Transcript snippet: "I need to move by this weekend. I have my deposit ready and just need to find a room near downtown Atlanta."
Analysis: moveInReadiness = "high"
Why: Urgent timeline (this weekend), has funds ready, specific location preference.', 10),

-- Negative sentiment signals (second priority)
('deepseek', 'negative_signals', 'NEGATIVE CALL INDICATORS (When detected, readiness should usually be LOW or MEDIUM):

COMPLAINT KEYWORDS: "issue", "problem", "refund", "money back", "cancel", "frustrated", "upset", "not what I expected"

ISSUE CALL PATTERNS:
- Member already booked/paid and is having problems
- Discussing service animals, accessibility issues, or policy violations
- Agent is apologizing or explaining policies defensively
- Member wants to speak to a manager or escalate

When these patterns appear, the call is NOT a sales opportunity - it is issue resolution. 
Mark as LOW readiness regardless of other factors.', 8),

-- Explicit scoring rubric (third priority)
('deepseek', 'scoring_rubric', 'MOVE-IN READINESS SCORING RULES (CRITICAL - Follow exactly):

Score LOW if ANY of these are true:
- Member is calling about an EXISTING booking issue (complaints, refunds, service dog problems)
- Member says "just looking", "not ready yet", "few months", "next year"
- Member is upset/frustrated about a previous interaction
- Call is an issue resolution, not a sales inquiry
- No timeline mentioned AND no urgency indicators

Score MEDIUM if:
- Member is actively exploring options but no immediate timeline
- Has budget but is comparing with other options
- Interested but needs to check with someone else
- Wants more information before committing

Score HIGH only if ALL of these are true:
- Member has urgent need (this week, ASAP, immediate)
- Has budget confirmed or deposit ready
- Is the decision maker
- Actively asking about booking process or next steps', 5);