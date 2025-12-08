import jsPDF from 'jspdf';

export const generateQADocumentationPDF = () => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const addTitle = (text: string, size: number = 20) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin, y);
    y += size * 0.5;
  };

  const addSubtitle = (text: string) => {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin, y);
    y += 8;
  };

  const addText = (text: string, indent: number = 0) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    doc.text(lines, margin + indent, y);
    y += lines.length * 5;
  };

  const addBullet = (text: string, indent: number = 5) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, contentWidth - indent - 5);
    doc.text('•', margin + indent, y);
    doc.text(lines, margin + indent + 5, y);
    y += lines.length * 5;
  };

  const addCode = (text: string, indent: number = 5) => {
    doc.setFontSize(9);
    doc.setFont('courier', 'normal');
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    doc.text(lines, margin + indent, y);
    y += lines.length * 4.5;
  };

  const addSpace = (space: number = 5) => {
    y += space;
  };

  const checkPageBreak = (needed: number = 30) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
  };

  // ============ Title Page ============
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('PadSplit QA Scoring Process', pageWidth / 2, 60, { align: 'center' });
  doc.setFontSize(18);
  doc.text('Quality Assurance Documentation Guide', pageWidth / 2, 75, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 95, { align: 'center' });
  doc.text('Version 1.0', pageWidth / 2, 105, { align: 'center' });

  // ============ Page 2 - Introduction ============
  doc.addPage();
  y = 20;

  addTitle('1. Introduction');
  addSpace(5);
  addText('This document details the Quality Assurance (QA) scoring process used within the PadSplit Sales Dashboard. The system employs AI-powered analysis to evaluate call quality against a standardized rubric, providing objective performance metrics for agent coaching and development.');
  addSpace(10);

  addSubtitle('Purpose of QA Scoring');
  addBullet('Provide objective, consistent evaluation of agent call performance');
  addBullet('Identify coaching opportunities based on specific skill areas');
  addBullet('Track quality trends over time at individual and team levels');
  addBullet('Enable data-driven performance management decisions');
  addSpace(10);

  addSubtitle('System Overview');
  addText('The QA system analyzes transcribed calls using AI to score agents across 6 standardized categories. Scores are calculated automatically after transcription, stored with each booking, and aggregated for dashboard analytics.');
  addSpace(15);

  // ============ Section 2 - QA Rubric Categories ============
  checkPageBreak(80);
  addTitle('2. QA Rubric Categories', 16);
  addSpace(5);
  addText('The current rubric consists of 6 categories totaling 90 possible points:');
  addSpace(10);

  // Category 1
  addSubtitle('Greeting & Introduction (10 points)');
  addText('Evaluates how the agent opens the call and establishes rapport.', 5);
  addSpace(3);
  addText('Scoring Criteria:', 5);
  addBullet('10 pts: Warm greeting, clear name introduction, stated purpose, confirmed who they are speaking with', 10);
  addBullet('7-9 pts: Good greeting with minor omissions', 10);
  addBullet('4-6 pts: Basic greeting lacking warmth or key elements', 10);
  addBullet('0-3 pts: Abrupt, unprofessional, or missing introduction', 10);
  addSpace(10);

  // Category 2
  checkPageBreak(50);
  addSubtitle('Needs Discovery (15 points)');
  addText('Measures how effectively the agent uncovers member needs and situation.', 5);
  addSpace(3);
  addText('Scoring Criteria:', 5);
  addBullet('13-15 pts: Asked about timeline, budget, location preferences, household size, and specific needs', 10);
  addBullet('9-12 pts: Covered most key areas with some gaps', 10);
  addBullet('5-8 pts: Limited discovery, missed important qualifiers', 10);
  addBullet('0-4 pts: Failed to probe for member needs', 10);
  addSpace(10);

  // Category 3
  checkPageBreak(50);
  addSubtitle('Clarity & Product Knowledge (20 points)');
  addText('Assesses the agent\'s ability to clearly explain PadSplit offerings and answer questions.', 5);
  addSpace(3);
  addText('Scoring Criteria:', 5);
  addBullet('17-20 pts: Excellent explanations of pricing, process, amenities; confidently answered all questions', 10);
  addBullet('12-16 pts: Good knowledge with occasional hesitation or minor inaccuracies', 10);
  addBullet('7-11 pts: Basic knowledge; struggled with some questions', 10);
  addBullet('0-6 pts: Poor product knowledge; provided incorrect information', 10);
  addSpace(10);

  // Category 4
  checkPageBreak(50);
  addSubtitle('Handling Objections (15 points)');
  addText('Evaluates how the agent addresses member concerns and hesitations.', 5);
  addSpace(3);
  addText('Scoring Criteria:', 5);
  addBullet('13-15 pts: Acknowledged concerns empathetically, provided solutions, reframed objections positively', 10);
  addBullet('9-12 pts: Addressed objections but missed opportunities to fully resolve', 10);
  addBullet('5-8 pts: Defensive response or inadequate handling', 10);
  addBullet('0-4 pts: Ignored objections or made them worse', 10);
  addSpace(10);

  // Category 5
  checkPageBreak(50);
  addSubtitle('Booking Support/CTA (20 points)');
  addText('Measures how effectively the agent moves the member toward a booking decision.', 5);
  addSpace(3);
  addText('Scoring Criteria:', 5);
  addBullet('17-20 pts: Clear next steps, created urgency, confirmed booking details or scheduled follow-up', 10);
  addBullet('12-16 pts: Attempted close with some follow-through gaps', 10);
  addBullet('7-11 pts: Weak call-to-action, left outcome unclear', 10);
  addBullet('0-6 pts: No attempt to advance the sale or confirm next steps', 10);
  addSpace(10);

  // Category 6
  checkPageBreak(50);
  addSubtitle('Soft Skills & Tone (10 points)');
  addText('Evaluates the overall professionalism and interpersonal effectiveness.', 5);
  addSpace(3);
  addText('Scoring Criteria:', 5);
  addBullet('9-10 pts: Warm, professional, empathetic; excellent active listening; built strong rapport', 10);
  addBullet('6-8 pts: Professional with minor lapses in engagement', 10);
  addBullet('3-5 pts: Flat tone, rushed, or lacked empathy', 10);
  addBullet('0-2 pts: Unprofessional, rude, or dismissive behavior', 10);
  addSpace(15);

  // ============ Section 3 - AI Scoring Process ============
  doc.addPage();
  y = 20;

  addTitle('3. AI Scoring Process', 16);
  addSpace(5);
  addText('The system uses Google\'s Gemini 2.5 Flash model via Lovable AI gateway to analyze call transcriptions and generate scores.');
  addSpace(10);

  addSubtitle('Model Configuration');
  addBullet('Model: google/gemini-2.5-flash');
  addBullet('API Endpoint: Lovable AI Gateway (ai.gateway.lovable.dev)');
  addBullet('Processing: Asynchronous via Supabase Edge Functions');
  addSpace(10);

  addSubtitle('System Prompt');
  addText('The AI receives the following system instruction:', 5);
  addSpace(3);
  addCode('"You are a QA analyst for a PadSplit sales team.');
  addCode('Score the following call transcription based on the QA rubric provided.');
  addCode('Be fair but thorough - reward good behaviors and identify areas');
  addCode('for improvement. Return ONLY valid JSON."');
  addSpace(10);

  checkPageBreak(60);
  addSubtitle('User Prompt Structure');
  addText('Each scoring request includes:', 5);
  addSpace(3);
  addBullet('Complete QA rubric with all 6 categories and scoring criteria', 10);
  addBullet('Full call transcription (speaker-diarized)', 10);
  addBullet('Required JSON output format specification', 10);
  addSpace(10);

  addSubtitle('Expected Output Format');
  addText('The AI must return scores in this exact JSON structure:', 5);
  addSpace(3);
  addCode('{');
  addCode('  "Greeting & Introduction": 8,');
  addCode('  "Needs Discovery": 12,');
  addCode('  "Clarity & Product Knowledge": 15,');
  addCode('  "Handling Objections": 10,');
  addCode('  "Booking Support/CTA": 14,');
  addCode('  "Soft Skills & Tone": 9');
  addCode('}');
  addSpace(15);

  // ============ Section 4 - Score Validation & Storage ============
  checkPageBreak(80);
  addTitle('4. Score Validation & Storage', 16);
  addSpace(5);

  addSubtitle('Validation Rules');
  addText('Before storing, all scores are validated:', 5);
  addSpace(3);
  addBullet('Minimum score: 0 points (scores below 0 are capped at 0)');
  addBullet('Maximum score: Category maxPoints (scores above max are capped)');
  addBullet('Missing categories: Assigned 0 points');
  addBullet('Invalid JSON: Triggers error, no scores saved');
  addSpace(10);

  addSubtitle('Storage Structure');
  addText('Scores are stored in booking_transcriptions.qa_scores as JSONB:', 5);
  addSpace(3);
  addCode('{');
  addCode('  "scores": {');
  addCode('    "Greeting & Introduction": 8,');
  addCode('    "Needs Discovery": 12,');
  addCode('    "Clarity & Product Knowledge": 15,');
  addCode('    "Handling Objections": 10,');
  addCode('    "Booking Support/CTA": 14,');
  addCode('    "Soft Skills & Tone": 9');
  addCode('  },');
  addCode('  "total": 68,');
  addCode('  "maxTotal": 90,');
  addCode('  "percentage": 75.56,');
  addCode('  "rubricId": "uuid-of-active-rubric",');
  addCode('  "scoredAt": "2024-12-08T14:30:00Z"');
  addCode('}');
  addSpace(10);

  addSubtitle('Data Fields Explained');
  addBullet('scores: Individual category scores keyed by category name');
  addBullet('total: Sum of all category scores');
  addBullet('maxTotal: Maximum possible score (sum of all maxPoints)');
  addBullet('percentage: (total / maxTotal) * 100, rounded to 2 decimals');
  addBullet('rubricId: UUID linking to the qa_settings rubric used for scoring');
  addBullet('scoredAt: ISO timestamp of when scoring was performed');
  addSpace(15);

  // ============ Section 5 - Dashboard Calculations ============
  doc.addPage();
  y = 20;

  addTitle('5. Dashboard Calculations', 16);
  addSpace(5);
  addText('The QA Dashboard displays aggregated metrics calculated from stored scores:');
  addSpace(10);

  addSubtitle('Team QA Score');
  addText('Formula: (Sum of all qa_scores.total) / (Count of scored calls) = Average Total', 5);
  addSpace(3);
  addText('Then: (Average Total / maxTotal) * 100 = Team QA Percentage', 5);
  addSpace(10);

  addSubtitle('Average Points Display');
  addText('Shows: "{Average Total} / {maxTotal} pts" (e.g., "68 / 90 pts")', 5);
  addSpace(10);

  addSubtitle('Category Averages');
  addText('For each category:', 5);
  addBullet('Sum all scores for that category across scored calls', 10);
  addBullet('Divide by number of scored calls', 10);
  addBullet('Display average and max (e.g., "12.5 / 15 pts")', 10);
  addSpace(10);

  addSubtitle('Agent Rankings');
  addText('Agents are ranked by their average QA percentage:', 5);
  addSpace(3);
  addBullet('Calculate average percentage for each agent\'s scored calls', 10);
  addBullet('Sort descending by average percentage', 10);
  addBullet('Agents with no scored calls are excluded from rankings', 10);
  addSpace(10);

  addSubtitle('Trend Chart');
  addText('The trend chart displays score progression over time:', 5);
  addSpace(3);
  addBullet('X-axis: Date of booking (booking_date field)', 10);
  addBullet('Y-axis: QA percentage for that call (0-100%)', 10);
  addBullet('Data points: Individual call scores plotted chronologically', 10);
  addBullet('Filtered by selected date range (Today, This Week, etc.)', 10);
  addSpace(15);

  // ============ Section 6 - Rubric Summary Table ============
  checkPageBreak(100);
  addTitle('6. Rubric Summary Table', 16);
  addSpace(10);

  // Table header
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const colWidths = [55, 25, 90];
  const startX = margin;
  let tableY = y;

  doc.text('Category', startX, tableY);
  doc.text('Max Pts', startX + colWidths[0], tableY);
  doc.text('Focus Area', startX + colWidths[0] + colWidths[1], tableY);
  
  tableY += 3;
  doc.line(startX, tableY, startX + contentWidth, tableY);
  tableY += 5;

  doc.setFont('helvetica', 'normal');
  const rows = [
    ['Greeting & Introduction', '10', 'Opening, name, purpose, confirmation'],
    ['Needs Discovery', '15', 'Timeline, budget, location, household'],
    ['Clarity & Product Knowledge', '20', 'Explanations, confidence, accuracy'],
    ['Handling Objections', '15', 'Empathy, solutions, reframing'],
    ['Booking Support/CTA', '20', 'Next steps, urgency, confirmation'],
    ['Soft Skills & Tone', '10', 'Professionalism, rapport, listening'],
  ];

  rows.forEach(row => {
    checkPageBreak(10);
    let x = startX;
    row.forEach((cell, i) => {
      doc.text(cell, x, tableY);
      x += colWidths[i];
    });
    tableY += 6;
    y = tableY;
  });

  // Total row
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', startX, tableY);
  doc.text('90', startX + colWidths[0], tableY);
  y = tableY + 10;
  addSpace(15);

  // ============ Section 7 - Cost Tracking ============
  checkPageBreak(60);
  addTitle('7. Cost Tracking', 16);
  addSpace(5);
  addText('All AI API calls are logged for billing and compliance purposes.');
  addSpace(8);

  addSubtitle('Logged Metrics');
  addBullet('service_provider: "lovable_ai"');
  addBullet('service_type: "text_generation"');
  addBullet('edge_function: "generate-qa-scores"');
  addBullet('input_tokens: Number of tokens in prompt');
  addBullet('output_tokens: Number of tokens in AI response');
  addBullet('estimated_cost_usd: Calculated based on token usage');
  addSpace(8);

  addSubtitle('Pricing Model');
  addBullet('Input tokens: ~$0.0001 per 1,000 tokens');
  addBullet('Output tokens: ~$0.0003 per 1,000 tokens');
  addSpace(8);

  addText('Cost logs are associated with the booking_id, agent_id, and site_id for detailed cost attribution and billing reports.');
  addSpace(15);

  // ============ Section 8 - Rubric Customization ============
  checkPageBreak(60);
  addTitle('8. Rubric Customization', 16);
  addSpace(5);
  addText('Admins can customize the QA rubric via Settings > AI Management > QA Scoring Rubric.');
  addSpace(8);

  addSubtitle('Customizable Elements');
  addBullet('Category names: Rename to match your evaluation criteria');
  addBullet('Maximum points: Adjust weighting per category');
  addBullet('Criteria descriptions: Update scoring guidelines');
  addBullet('Add/remove categories: Modify the rubric structure');
  addSpace(8);

  addSubtitle('Version Tracking');
  addText('Each rubric version is stored with:', 5);
  addBullet('Unique rubric ID (linked to scored calls)', 10);
  addBullet('is_active flag to identify current rubric', 10);
  addBullet('Created/updated timestamps', 10);
  addSpace(8);

  addText('Historical scores maintain their original rubric_id reference, ensuring consistent interpretation of past evaluations even after rubric changes.');

  // Save the PDF
  doc.save('PadSplit-QA-Process-Guide.pdf');
};
