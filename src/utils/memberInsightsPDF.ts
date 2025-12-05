import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface MemberInsight {
  id: string;
  analysis_period: string;
  date_range_start: string;
  date_range_end: string;
  total_calls_analyzed: number;
  pain_points: any[];
  payment_insights: any[];
  transportation_insights: any[];
  price_sensitivity: any[];
  move_in_barriers: any[];
  property_preferences: any[];
  objection_patterns: any[];
  market_breakdown: Record<string, any>;
  sentiment_distribution: { positive: number; neutral: number; negative: number };
  ai_recommendations: any[];
  member_journey_insights: any[];
  created_at: string;
}

export const generateMemberInsightsPDF = (insight: MemberInsight) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  const addSectionHeader = (title: string) => {
    checkPageBreak(20);
    doc.setFillColor(37, 99, 235);
    doc.rect(margin, yPosition, contentWidth, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 5, yPosition + 7);
    doc.setTextColor(0, 0, 0);
    yPosition += 15;
  };

  const addText = (text: string, indent: number = 0, fontSize: number = 10) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    lines.forEach((line: string) => {
      checkPageBreak(7);
      doc.text(line, margin + indent, yPosition);
      yPosition += 5;
    });
  };

  const addBulletPoint = (text: string, indent: number = 5) => {
    checkPageBreak(7);
    doc.setFontSize(10);
    doc.text('•', margin + indent, yPosition);
    const lines = doc.splitTextToSize(text, contentWidth - indent - 10);
    lines.forEach((line: string, index: number) => {
      if (index > 0) checkPageBreak(5);
      doc.text(line, margin + indent + 5, yPosition);
      yPosition += 5;
    });
  };

  // === Cover Page ===
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 80, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Member Insights Report', pageWidth / 2, 40, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('PadSplit Call Analysis', pageWidth / 2, 55, { align: 'center' });
  
  doc.setTextColor(0, 0, 0);
  yPosition = 100;

  // Report Details
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Report Details', margin, yPosition);
  yPosition += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const details = [
    `Analysis Period: ${insight.analysis_period.charAt(0).toUpperCase() + insight.analysis_period.slice(1)}`,
    `Date Range: ${format(new Date(insight.date_range_start), 'MMM d, yyyy')} - ${format(new Date(insight.date_range_end), 'MMM d, yyyy')}`,
    `Total Calls Analyzed: ${insight.total_calls_analyzed}`,
    `Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`
  ];
  
  details.forEach(detail => {
    doc.text(detail, margin, yPosition);
    yPosition += 7;
  });

  // Executive Summary
  yPosition += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Executive Summary', margin, yPosition);
  yPosition += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  const sentiment = insight.sentiment_distribution || { positive: 0, neutral: 0, negative: 0 };
  doc.text(`Sentiment Distribution:`, margin, yPosition);
  yPosition += 7;
  doc.text(`  • Positive: ${sentiment.positive}%`, margin, yPosition);
  yPosition += 5;
  doc.text(`  • Neutral: ${sentiment.neutral}%`, margin, yPosition);
  yPosition += 5;
  doc.text(`  • Negative: ${sentiment.negative}%`, margin, yPosition);
  yPosition += 10;

  if (insight.pain_points?.length > 0) {
    doc.text('Top Pain Points:', margin, yPosition);
    yPosition += 7;
    insight.pain_points.slice(0, 3).forEach((point: any) => {
      doc.text(`  • ${point.category || point.pain_point}: ${point.frequency || point.percentage}%`, margin, yPosition);
      yPosition += 5;
    });
  }

  // === Page 2: Pain Points ===
  doc.addPage();
  yPosition = margin;

  addSectionHeader('Pain Points Analysis');
  
  if (insight.pain_points?.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('General Pain Points', margin, yPosition);
    yPosition += 8;
    
    insight.pain_points.forEach((point: any) => {
      addBulletPoint(`${point.category || point.pain_point} (${point.frequency || point.percentage}%): ${point.description || ''}`);
      if (point.examples?.length > 0) {
        addText(`Example: "${point.examples[0]}"`, 15, 9);
      }
      yPosition += 3;
    });
  }

  if (insight.payment_insights?.length > 0) {
    yPosition += 5;
    checkPageBreak(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Payment Insights', margin, yPosition);
    yPosition += 8;
    
    insight.payment_insights.forEach((point: any) => {
      addBulletPoint(`${point.pattern || point.insight} (${point.frequency || point.percentage}%)`);
    });
  }

  if (insight.transportation_insights?.length > 0) {
    yPosition += 5;
    checkPageBreak(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Transportation Insights', margin, yPosition);
    yPosition += 8;
    
    insight.transportation_insights.forEach((point: any) => {
      addBulletPoint(`${point.pattern || point.insight} (${point.frequency || point.percentage}%)`);
    });
  }

  if (insight.move_in_barriers?.length > 0) {
    yPosition += 5;
    checkPageBreak(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Move-In Barriers', margin, yPosition);
    yPosition += 8;
    
    insight.move_in_barriers.forEach((point: any) => {
      addBulletPoint(`${point.barrier || point.pattern} (${point.frequency || point.percentage}%)`);
    });
  }

  // === Objection Patterns ===
  if (insight.objection_patterns?.length > 0) {
    doc.addPage();
    yPosition = margin;
    
    addSectionHeader('Objection Patterns');
    
    insight.objection_patterns.forEach((obj: any, index: number) => {
      checkPageBreak(15);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${index + 1}. ${obj.objection}`, margin, yPosition);
      yPosition += 6;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Frequency: ${obj.frequency}%`, margin + 5, yPosition);
      yPosition += 5;
      
      if (obj.suggested_response) {
        const responseLines = doc.splitTextToSize(`Response: ${obj.suggested_response}`, contentWidth - 10);
        responseLines.forEach((line: string) => {
          checkPageBreak(5);
          doc.text(line, margin + 5, yPosition);
          yPosition += 5;
        });
      }
      yPosition += 3;
    });
  }

  // === Market Breakdown ===
  if (insight.market_breakdown && Object.keys(insight.market_breakdown).length > 0) {
    doc.addPage();
    yPosition = margin;
    
    addSectionHeader('Market Breakdown');
    
    Object.entries(insight.market_breakdown).forEach(([market, data]: [string, any]) => {
      checkPageBreak(25);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(market, margin, yPosition);
      yPosition += 7;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      if (data.call_count) {
        doc.text(`Calls: ${data.call_count}`, margin + 5, yPosition);
        yPosition += 5;
      }
      if (data.top_concern) {
        addText(`Top Concern: ${data.top_concern}`, 5);
      }
      if (data.unique_pattern) {
        addText(`Unique Pattern: ${data.unique_pattern}`, 5);
      }
      yPosition += 5;
    });
  }

  // === AI Recommendations ===
  if (insight.ai_recommendations?.length > 0) {
    doc.addPage();
    yPosition = margin;
    
    addSectionHeader('AI Recommendations');
    
    const sortedRecs = [...insight.ai_recommendations].sort((a, b) => {
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });
    
    sortedRecs.forEach((rec: any, index: number) => {
      checkPageBreak(25);
      
      const priorityLabel = rec.priority ? `[${rec.priority.toUpperCase()}]` : '';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${index + 1}. ${priorityLabel} ${rec.category || 'General'}`, margin, yPosition);
      yPosition += 7;
      
      doc.setFont('helvetica', 'normal');
      addText(rec.recommendation || rec.action, 5);
      
      if (rec.expected_impact) {
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        addText(`Expected Impact: ${rec.expected_impact}`, 5, 9);
        doc.setTextColor(0, 0, 0);
      }
      yPosition += 5;
    });
  }

  // === Member Journey Insights ===
  if (insight.member_journey_insights?.length > 0) {
    checkPageBreak(50);
    yPosition += 10;
    
    addSectionHeader('Member Journey Insights');
    
    insight.member_journey_insights.forEach((journey: any) => {
      checkPageBreak(20);
      addBulletPoint(`${journey.pattern || journey.insight} (${journey.frequency || journey.percentage}%)`);
      if (journey.implication) {
        addText(`Implication: ${journey.implication}`, 10, 9);
      }
    });
  }

  // Footer on last page
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Generated by PadSplit Operations Dashboard • ${format(new Date(), 'MMMM d, yyyy')}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  // Save
  const filename = `member-insights-${format(new Date(insight.created_at), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
};
