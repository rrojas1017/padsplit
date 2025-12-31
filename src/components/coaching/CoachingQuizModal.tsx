import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Trophy, 
  RefreshCw,
  Target,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
}

interface CoachingQuizModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  quizType: 'jeff_coaching' | 'katty_qa';
  onQuizPassed: () => void;
  onReplayRequested?: () => void;
}

export function CoachingQuizModal({
  open,
  onOpenChange,
  bookingId,
  quizType,
  onQuizPassed,
  onReplayRequested,
}: CoachingQuizModalProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const coachName = quizType === 'jeff_coaching' ? 'Jeff' : 'Katty';
  const passingScore = 2; // Need 2 out of 3 to pass

  useEffect(() => {
    if (open && questions.length === 0) {
      generateQuiz();
    }
  }, [open]);

  const generateQuiz = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-coaching-quiz', {
        body: { bookingId, quizType },
      });

      if (error) throw error;

      if (data?.questions) {
        setQuestions(data.questions);
        setCurrentQuestionIndex(0);
        setSelectedAnswers([]);
        setShowResults(false);
      } else {
        throw new Error(data?.error || 'Failed to generate quiz');
      }
    } catch (error) {
      console.error('Error generating quiz:', error);
      toast.error('Failed to generate quiz. Please try again.');
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAnswer = (optionIndex: number) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestionIndex] = optionIndex;
    setSelectedAnswers(newAnswers);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmitQuiz = async () => {
    setIsSubmitting(true);
    
    // Calculate score
    let correctCount = 0;
    questions.forEach((q, index) => {
      if (selectedAnswers[index] === q.correctIndex) {
        correctCount++;
      }
    });
    
    setScore(correctCount);
    const hasPassed = correctCount >= passingScore;
    setPassed(hasPassed);
    setShowResults(true);

    try {
      // Save quiz result - using type assertion since table was just created
      if (user?.id) {
        const quizResult = {
          booking_id: bookingId,
          user_id: user.id,
          quiz_type: quizType,
          questions: questions,
          answers: selectedAnswers,
          score: correctCount,
          passed: hasPassed,
          completed_at: hasPassed ? new Date().toISOString() : null,
        };
        
        const { error: insertError } = await supabase
          .from('coaching_quiz_results')
          .insert(quizResult as any);

        if (insertError) {
          console.error('Error saving quiz result:', insertError);
        }
      }

      // If passed, update the transcription record
      if (hasPassed) {
        const updateField = quizType === 'jeff_coaching' 
          ? 'coaching_quiz_passed_at' 
          : 'qa_coaching_quiz_passed_at';
        
        const { error: updateError } = await supabase
          .from('booking_transcriptions')
          .update({ [updateField]: new Date().toISOString() })
          .eq('booking_id', bookingId);

        if (updateError) {
          console.error('Error updating transcription:', updateError);
        } else {
          onQuizPassed();
        }
      }
    } catch (error) {
      console.error('Error processing quiz results:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setShowResults(false);
    setSelectedAnswers([]);
    setCurrentQuestionIndex(0);
  };

  const handleReplayAudio = () => {
    onOpenChange(false);
    onReplayRequested?.();
  };

  const currentQuestion = questions[currentQuestionIndex];
  const hasSelectedAnswer = selectedAnswers[currentQuestionIndex] !== undefined;
  const allAnswered = selectedAnswers.length === questions.length && 
    selectedAnswers.every(a => a !== undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Quick Coaching Check
          </DialogTitle>
          <DialogDescription>
            Let's make sure you got the key takeaways from {coachName}'s feedback!
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">Generating your quiz...</p>
          </div>
        ) : showResults ? (
          <div className="py-6 text-center space-y-6">
            {passed ? (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-green-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Great Job! 🎉</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You scored {score}/{questions.length} - Quiz passed!
                  </p>
                </div>
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Coaching Verified
                </Badge>
                <Button onClick={() => onOpenChange(false)} className="w-full">
                  Done
                </Button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Almost There!</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    You scored {score}/{questions.length}. Need {passingScore} correct to pass.
                  </p>
                </div>
                
                {/* Show correct answers */}
                <div className="text-left space-y-3 bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium">Correct Answers:</p>
                  {questions.map((q, index) => (
                    <div key={q.id} className="text-sm">
                      <p className="text-muted-foreground">Q{index + 1}: {q.question}</p>
                      <p className={cn(
                        "font-medium",
                        selectedAnswers[index] === q.correctIndex 
                          ? "text-green-600" 
                          : "text-red-600"
                      )}>
                        → {q.options[q.correctIndex]}
                        {selectedAnswers[index] !== q.correctIndex && (
                          <span className="text-muted-foreground font-normal">
                            {" "}(You chose: {q.options[selectedAnswers[index]]})
                          </span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleReplayAudio} className="flex-1">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Replay Audio
                  </Button>
                  <Button onClick={handleRetry} className="flex-1">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : currentQuestion ? (
          <div className="space-y-6">
            {/* Progress indicator */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <div className="flex gap-1">
                {questions.map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "w-2 h-2 rounded-full",
                      index === currentQuestionIndex
                        ? "bg-primary"
                        : selectedAnswers[index] !== undefined
                        ? "bg-primary/50"
                        : "bg-muted"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Question */}
            <div>
              <h4 className="font-medium text-foreground mb-4">
                {currentQuestion.question}
              </h4>
              <div className="space-y-2">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectAnswer(index)}
                    className={cn(
                      "w-full p-3 text-left rounded-lg border transition-colors",
                      selectedAnswers[currentQuestionIndex] === index
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    <span className="text-sm">{option}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
              {currentQuestionIndex > 0 && (
                <Button variant="outline" onClick={handlePreviousQuestion}>
                  Previous
                </Button>
              )}
              <div className="flex-1" />
              {currentQuestionIndex < questions.length - 1 ? (
                <Button 
                  onClick={handleNextQuestion} 
                  disabled={!hasSelectedAnswer}
                >
                  Next
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmitQuiz} 
                  disabled={!allAnswered || isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Submit
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
