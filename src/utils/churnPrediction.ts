export interface ChurnSignal {
  label: string;
  points: number;
  weight: 'high' | 'medium' | 'low';
  present: boolean;
}

export interface ChurnRiskResult {
  score: number;
  level: 'low' | 'medium' | 'high';
  signals: ChurnSignal[];
  topFactors: string[];
}

interface ChurnInput {
  callDurationSeconds: number | null;
  bookingDate: string;
  moveInDate: string;
  communicationMethod: string | null;
  transcription?: {
    callSentiment?: string;
    moveInReadiness?: string;
    objections?: any[];
    buyerIntent?: { score?: number };
  } | null;
  agentFeedback?: {
    scores?: Record<string, number>;
  } | null;
  marketChurnRate?: number; // historical churn rate for this market
}

export function calculateChurnRisk(input: ChurnInput): ChurnRiskResult {
  const signals: ChurnSignal[] = [];

  // 1. Short call duration (< 3 min) — High weight, max 15 pts
  const duration = input.callDurationSeconds || 0;
  const shortCall = duration > 0 && duration < 180;
  signals.push({
    label: 'Short call duration (< 3 min)',
    points: shortCall ? 15 : 0,
    weight: 'high',
    present: shortCall,
  });

  // 2. Negative sentiment — High weight, max 15 pts
  const sentiment = input.transcription?.callSentiment?.toLowerCase() || '';
  const negativeSentiment = sentiment.includes('negative');
  signals.push({
    label: 'Negative call sentiment',
    points: negativeSentiment ? 15 : 0,
    weight: 'high',
    present: negativeSentiment,
  });

  // 3. Low move-in readiness — High weight, max 15 pts
  const readiness = input.transcription?.moveInReadiness?.toLowerCase() || '';
  const lowReadiness = readiness === 'low' || readiness.includes('not ready');
  signals.push({
    label: 'Low move-in readiness',
    points: lowReadiness ? 15 : 0,
    weight: 'high',
    present: lowReadiness,
  });

  // 4. Cold buyer intent (< 40) — High weight, max 15 pts
  const intentScore = input.transcription?.buyerIntent?.score;
  const coldIntent = typeof intentScore === 'number' && intentScore < 40;
  signals.push({
    label: `Cold buyer intent (${intentScore ?? 'N/A'}/100)`,
    points: coldIntent ? 15 : 0,
    weight: 'high',
    present: coldIntent,
  });

  // 5. Multiple objections (3+) — Medium weight, max 10 pts
  const objCount = Array.isArray(input.transcription?.objections) ? input.transcription!.objections.length : 0;
  const multipleObjections = objCount >= 3;
  signals.push({
    label: `Multiple objections raised (${objCount})`,
    points: multipleObjections ? 10 : 0,
    weight: 'medium',
    present: multipleObjections,
  });

  // 6. Short time between booking and move-in (< 2 days) — Medium weight, max 10 pts
  const bookingMs = new Date(input.bookingDate).getTime();
  const moveInMs = new Date(input.moveInDate).getTime();
  const daysBetween = (moveInMs - bookingMs) / (1000 * 60 * 60 * 24);
  const rushBooking = daysBetween >= 0 && daysBetween < 2;
  signals.push({
    label: `Rush booking (${Math.round(daysBetween * 10) / 10} days gap)`,
    points: rushBooking ? 10 : 0,
    weight: 'medium',
    present: rushBooking,
  });

  // 7. High market churn — Medium weight, max 10 pts
  const highMarketChurn = (input.marketChurnRate || 0) > 30;
  signals.push({
    label: 'Market with high historical churn',
    points: highMarketChurn ? 10 : 0,
    weight: 'medium',
    present: highMarketChurn,
  });

  // 8. Low agent QA scores (avg < 60) — Low weight, max 5 pts
  const qaScores = input.agentFeedback?.scores ? Object.values(input.agentFeedback.scores) : [];
  const avgQA = qaScores.length > 0 ? qaScores.reduce((s, v) => s + v, 0) / qaScores.length : null;
  const lowQA = avgQA !== null && avgQA < 60;
  signals.push({
    label: `Low agent QA score (${avgQA !== null ? Math.round(avgQA) : 'N/A'})`,
    points: lowQA ? 5 : 0,
    weight: 'low',
    present: lowQA,
  });

  // 9. SMS-only communication — Low weight, max 5 pts
  const smsOnly = input.communicationMethod?.toLowerCase() === 'sms';
  signals.push({
    label: 'SMS-only communication',
    points: smsOnly ? 5 : 0,
    weight: 'low',
    present: smsOnly,
  });

  // Calculate total (cap at 100)
  const rawScore = signals.reduce((s, sig) => s + sig.points, 0);
  const score = Math.min(100, rawScore);

  const level: ChurnRiskResult['level'] = score <= 30 ? 'low' : score <= 60 ? 'medium' : 'high';

  const topFactors = signals
    .filter(s => s.present)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map(s => s.label);

  return { score, level, signals, topFactors };
}
