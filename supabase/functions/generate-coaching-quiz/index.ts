import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, quizType } = await req.json();

    if (!bookingId || !quizType) {
      return new Response(
        JSON.stringify({ error: 'bookingId and quizType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['jeff_coaching', 'katty_qa'].includes(quizType)) {
      return new Response(
        JSON.stringify({ error: 'quizType must be jeff_coaching or katty_qa' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the transcription data
    const { data: transcription, error: fetchError } = await supabase
      .from('booking_transcriptions')
      .select('agent_feedback, qa_scores')
      .eq('booking_id', bookingId)
      .single();

    if (fetchError || !transcription) {
      console.error('Error fetching transcription:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Transcription not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const feedbackData = quizType === 'jeff_coaching' 
      ? transcription.agent_feedback 
      : transcription.qa_scores;

    if (!feedbackData) {
      return new Response(
        JSON.stringify({ error: `No ${quizType === 'jeff_coaching' ? 'agent feedback' : 'QA scores'} available` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate quiz questions using AI
    const systemPrompt = `You are a coaching quiz generator. Based on the provided coaching feedback, generate exactly 3 multiple-choice questions to verify the agent understood the key takeaways.

Rules:
1. Each question must have exactly 4 options
2. Questions should focus on:
   - Question 1: Their strongest area or positive feedback
   - Question 2: Their weakest area or area needing improvement  
   - Question 3: A specific tip or recommendation from the feedback
3. Make questions specific to the actual feedback content
4. Avoid generic questions - be specific about scores, categories, or comments
5. Return ONLY valid JSON, no markdown or other text

Response format:
{
  "questions": [
    {
      "id": 1,
      "question": "What was identified as your strongest area?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0
    }
  ]
}`;

    const userPrompt = quizType === 'jeff_coaching'
      ? `Generate 3 quiz questions based on this performance coaching feedback:

${JSON.stringify(feedbackData, null, 2)}

Focus on:
- Overall score and rating
- Specific strengths mentioned
- Areas for improvement
- Any coaching tips provided`
      : `Generate 3 quiz questions based on this QA scoring feedback:

${JSON.stringify(feedbackData, null, 2)}

Focus on:
- Category scores and which was highest/lowest
- Total percentage score
- Specific areas that need attention
- Any scoring notes or feedback`;

    console.log('Generating quiz questions for', quizType);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('Failed to generate quiz questions');
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse the JSON response
    let questions: QuizQuestion[];
    try {
      // Remove any markdown code blocks if present
      const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      questions = parsed.questions;

      // Validate structure
      if (!Array.isArray(questions) || questions.length !== 3) {
        throw new Error('Invalid question count');
      }

      for (const q of questions) {
        if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || 
            typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) {
          throw new Error('Invalid question structure');
        }
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError, content);
      throw new Error('Failed to parse quiz questions');
    }

    console.log('Generated quiz questions:', questions);

    return new Response(
      JSON.stringify({ success: true, questions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating coaching quiz:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
