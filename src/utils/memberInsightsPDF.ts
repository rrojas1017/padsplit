import jsPDF from 'jspdf';

export interface MemberInsight {
  id: string;
  analysis_period: string;
  date_range_start: string;
  date_range_end: string;
  total_calls_analyzed: number;
  pain_points: any;
  objection_patterns: any;
  sentiment_distribution: any;
  market_breakdown: any;
  ai_recommendations: any;
  member_journey_insights: any;
  created_at: string;
}

// Color palette
const colors = {
  navy: { r: 30, g: 58, b: 95 },        // #1e3a5f
  gold: { r: 212, g: 168, b: 83 },      // #d4a853
  green: { r: 16, g: 185, b: 129 },     // #10b981
  amber: { r: 245, g: 158, b: 11 },     // #f59e0b
  red: { r: 239, g: 68, b: 68 },        // #ef4444
  slate100: { r: 241, g: 245, b: 249 }, // #f1f5f9
  slate200: { r: 226, g: 232, b: 240 }, // #e2e8f0
  slate600: { r: 71, g: 85, b: 105 },   // #475569
  slate800: { r: 30, g: 41, b: 59 },    // #1e293b
  white: { r: 255, g: 255, b: 255 },
};

const setColor = (doc: jsPDF, color: { r: number; g: number; b: number }) => {
  doc.setTextColor(color.r, color.g, color.b);
};

const setFillColor = (doc: jsPDF, color: { r: number; g: number; b: number }) => {
  doc.setFillColor(color.r, color.g, color.b);
};

const setDrawColor = (doc: jsPDF, color: { r: number; g: number; b: number }) => {
  doc.setDrawColor(color.r, color.g, color.b);
};

// Draw rounded rectangle
const drawRoundedRect = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: { r: number; g: number; b: number } | null,
  stroke: { r: number; g: number; b: number } | null = null
) => {
  if (fill) {
    setFillColor(doc, fill);
  }
  if (stroke) {
    setDrawColor(doc, stroke);
    doc.setLineWidth(0.5);
  }
  
  const style = fill && stroke ? 'FD' : fill ? 'F' : stroke ? 'S' : 'S';
  doc.roundedRect(x, y, width, height, radius, radius, style);
};

// Draw progress bar
const drawProgressBar = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  percentage: number,
  barColor: { r: number; g: number; b: number }
) => {
  // Background
  drawRoundedRect(doc, x, y, width, height, 2, colors.slate200);
  
  // Progress
  const progressWidth = Math.max((width * percentage) / 100, 4);
  if (percentage > 0) {
    drawRoundedRect(doc, x, y, progressWidth, height, 2, barColor);
  }
};

// Draw stat card
const drawStatCard = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  value: string,
  label: string,
  iconColor: { r: number; g: number; b: number }
) => {
  drawRoundedRect(doc, x, y, width, height, 4, colors.white, colors.slate200);
  
  // Icon circle
  setFillColor(doc, iconColor);
  doc.circle(x + width / 2, y + 18, 8, 'F');
  
  // Value
  setColor(doc, colors.slate800);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(value, x + width / 2, y + 42, { align: 'center' });
  
  // Label
  setColor(doc, colors.slate600);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(label, x + width / 2, y + 52, { align: 'center' });
};

// Draw section header
const drawSectionHeader = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  icon: string
) => {
  setColor(doc, colors.navy);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${icon}  ${title}`, x, y);
  
  // Underline
  setDrawColor(doc, colors.gold);
  doc.setLineWidth(1);
  doc.line(x, y + 3, x + width, y + 3);
  
  return y + 12;
};

// Draw card with title
const drawCard = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  iconColor: { r: number; g: number; b: number }
) => {
  drawRoundedRect(doc, x, y, width, height, 4, colors.white, colors.slate200);
  
  // Icon circle
  setFillColor(doc, iconColor);
  doc.circle(x + 12, y + 14, 6, 'F');
  
  // Title
  setColor(doc, colors.slate800);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, x + 22, y + 16);
  
  return y + 26;
};

// Draw priority badge
const drawBadge = (
  doc: jsPDF,
  x: number,
  y: number,
  text: string,
  color: { r: number; g: number; b: number }
) => {
  const textWidth = doc.getTextWidth(text) + 8;
  drawRoundedRect(doc, x, y - 4, textWidth, 8, 2, color);
  setColor(doc, colors.white);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(text, x + 4, y + 1);
  return textWidth;
};

export const generateMemberInsightsPDF = (insight: MemberInsight) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // ============================================
  // PAGE 1: Cover & Executive Dashboard
  // ============================================
  
  // Header gradient effect (navy bar)
  setFillColor(doc, colors.navy);
  doc.rect(0, 0, pageWidth, 50, 'F');
  
  // Gold accent line
  setFillColor(doc, colors.gold);
  doc.rect(0, 50, pageWidth, 3, 'F');
  
  // Title
  setColor(doc, colors.white);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('MEMBER INSIGHTS REPORT', margin, 25);
  
  // Subtitle
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  const dateRange = `${new Date(insight.date_range_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(insight.date_range_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  doc.text(`Analysis Period: ${dateRange}`, margin, 35);
  
  // PadSplit branding
  doc.setFontSize(10);
  doc.text('PadSplit Operations Intelligence', pageWidth - margin, 25, { align: 'right' });
  
  let currentY = 65;
  
  // Stat cards row
  const cardWidth = (contentWidth - 20) / 3;
  const sentiment = insight.sentiment_distribution || {};
  const positivePercent = sentiment.positive || 0;
  const neutralPercent = sentiment.neutral || 0;
  const negativePercent = sentiment.negative || 0;
  
  drawStatCard(doc, margin, currentY, cardWidth, 60, String(insight.total_calls_analyzed), 'Calls Analyzed', colors.navy);
  drawStatCard(doc, margin + cardWidth + 10, currentY, cardWidth, 60, `${positivePercent}%`, 'Positive', colors.green);
  drawStatCard(doc, margin + (cardWidth + 10) * 2, currentY, cardWidth, 60, `${neutralPercent}%`, 'Neutral', colors.amber);
  
  currentY += 70;
  
  // Sentiment Breakdown Section
  currentY = drawSectionHeader(doc, margin, currentY, contentWidth, 'SENTIMENT BREAKDOWN', '📊');
  
  // Sentiment bars
  const barHeight = 10;
  const barWidth = contentWidth - 60;
  
  // Positive bar
  setColor(doc, colors.slate800);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Positive', margin, currentY + 7);
  drawProgressBar(doc, margin + 45, currentY, barWidth - 30, barHeight, positivePercent, colors.green);
  doc.text(`${positivePercent}%`, margin + barWidth + 20, currentY + 7);
  currentY += 16;
  
  // Neutral bar
  doc.text('Neutral', margin, currentY + 7);
  drawProgressBar(doc, margin + 45, currentY, barWidth - 30, barHeight, neutralPercent, colors.amber);
  doc.text(`${neutralPercent}%`, margin + barWidth + 20, currentY + 7);
  currentY += 16;
  
  // Negative bar
  doc.text('Negative', margin, currentY + 7);
  drawProgressBar(doc, margin + 45, currentY, barWidth - 30, barHeight, negativePercent, colors.red);
  doc.text(`${negativePercent}%`, margin + barWidth + 20, currentY + 7);
  currentY += 25;
  
  // Top Pain Points Section
  currentY = drawSectionHeader(doc, margin, currentY, contentWidth, 'TOP PAIN POINTS', '🔴');
  
  const painPoints = insight.pain_points || {};
  const allPainPoints: { category: string; item: string; percentage: number }[] = [];
  
  Object.entries(painPoints).forEach(([category, items]: [string, any]) => {
    if (Array.isArray(items)) {
      items.forEach((item: any) => {
        if (item.item && item.percentage) {
          allPainPoints.push({ category, item: item.item, percentage: item.percentage });
        }
      });
    }
  });
  
  allPainPoints.sort((a, b) => b.percentage - a.percentage);
  const topPainPoints = allPainPoints.slice(0, 5);
  
  topPainPoints.forEach((point, index) => {
    const barColors = [colors.red, colors.amber, colors.gold, colors.slate600, colors.slate600];
    
    drawRoundedRect(doc, margin, currentY, contentWidth, 16, 3, colors.slate100);
    
    setColor(doc, colors.slate800);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(point.item, margin + 5, currentY + 6);
    
    doc.setFont('helvetica', 'normal');
    setColor(doc, colors.slate600);
    doc.text(`(${point.category.replace(/_/g, ' ')})`, margin + 5, currentY + 12);
    
    // Progress bar
    drawProgressBar(doc, margin + 90, currentY + 4, contentWidth - 120, 8, point.percentage, barColors[index]);
    
    doc.setFont('helvetica', 'bold');
    setColor(doc, colors.slate800);
    doc.text(`${point.percentage}%`, margin + contentWidth - 20, currentY + 10, { align: 'right' });
    
    currentY += 20;
  });

  // ============================================
  // PAGE 2: Pain Points Analysis
  // ============================================
  doc.addPage();
  
  // Header
  setFillColor(doc, colors.navy);
  doc.rect(0, 0, pageWidth, 25, 'F');
  setFillColor(doc, colors.gold);
  doc.rect(0, 25, pageWidth, 2, 'F');
  
  setColor(doc, colors.white);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PAIN POINTS ANALYSIS', margin, 16);
  
  currentY = 40;
  
  const cardHeight = 60;
  const halfWidth = (contentWidth - 10) / 2;
  
  const categoryConfig: Record<string, { icon: string; color: { r: number; g: number; b: number } }> = {
    payment_flexibility: { icon: '💳', color: colors.green },
    transportation: { icon: '🚌', color: colors.amber },
    property_information: { icon: '🏠', color: colors.navy },
    move_in_barriers: { icon: '📅', color: colors.red },
    price_sensitivity: { icon: '💰', color: colors.gold },
  };
  
  let cardIndex = 0;
  Object.entries(painPoints).forEach(([category, items]: [string, any]) => {
    if (!Array.isArray(items) || items.length === 0) return;
    
    const config = categoryConfig[category] || { icon: '📋', color: colors.slate600 };
    const categoryTitle = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    const xPos = cardIndex % 2 === 0 ? margin : margin + halfWidth + 10;
    const yPos = currentY + Math.floor(cardIndex / 2) * (cardHeight + 10);
    
    if (yPos + cardHeight > pageHeight - 20) {
      doc.addPage();
      currentY = 20;
      cardIndex = 0;
      return;
    }
    
    const contentY = drawCard(doc, xPos, yPos, halfWidth, cardHeight, categoryTitle, config.color);
    
    // List items
    const categoryItems = items.slice(0, 3);
    let itemY = contentY;
    
    categoryItems.forEach((item: any) => {
      if (item.item && item.percentage) {
        setColor(doc, colors.slate600);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        
        const itemText = item.item.length > 25 ? item.item.substring(0, 22) + '...' : item.item;
        doc.text(`• ${itemText}`, xPos + 8, itemY);
        
        doc.setFont('helvetica', 'bold');
        doc.text(`${item.percentage}%`, xPos + halfWidth - 8, itemY, { align: 'right' });
        
        itemY += 8;
      }
    });
    
    cardIndex++;
  });

  // ============================================
  // PAGE 3: Objection Patterns
  // ============================================
  doc.addPage();
  
  // Header
  setFillColor(doc, colors.navy);
  doc.rect(0, 0, pageWidth, 25, 'F');
  setFillColor(doc, colors.gold);
  doc.rect(0, 25, pageWidth, 2, 'F');
  
  setColor(doc, colors.white);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('OBJECTION PATTERNS', margin, 16);
  
  currentY = 40;
  
  const objections = insight.objection_patterns || [];
  
  if (Array.isArray(objections) && objections.length > 0) {
    const sortedObjections = [...objections].sort((a: any, b: any) => (b.frequency || 0) - (a.frequency || 0));
    const topObjections = sortedObjections.slice(0, 8);
    
    topObjections.forEach((objection: any, index: number) => {
      const objectionName = objection.objection || objection.type || 'Unknown';
      const frequency = objection.frequency || 0;
      
      // Objection row
      drawRoundedRect(doc, margin, currentY, contentWidth, 28, 4, colors.white, colors.slate200);
      
      // Rank badge
      setFillColor(doc, index < 3 ? colors.gold : colors.slate200);
      doc.circle(margin + 10, currentY + 14, 6, 'F');
      
      setColor(doc, index < 3 ? colors.white : colors.slate600);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(String(index + 1), margin + 10, currentY + 16, { align: 'center' });
      
      // Objection text
      setColor(doc, colors.slate800);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const displayName = objectionName.length > 40 ? objectionName.substring(0, 37) + '...' : objectionName;
      doc.text(displayName, margin + 22, currentY + 10);
      
      // Progress bar
      const barStartX = margin + 22;
      const barEndX = margin + contentWidth - 35;
      drawProgressBar(doc, barStartX, currentY + 15, barEndX - barStartX, 6, frequency, index < 3 ? colors.navy : colors.slate600);
      
      // Percentage
      setColor(doc, colors.navy);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${frequency}%`, margin + contentWidth - 8, currentY + 16, { align: 'right' });
      
      currentY += 32;
    });
    
    // Suggested responses section
    if (currentY + 60 < pageHeight - 20) {
      currentY += 10;
      currentY = drawSectionHeader(doc, margin, currentY, contentWidth, 'SUGGESTED RESPONSES', '💡');
      
      const objsWithResponses = sortedObjections.filter((o: any) => o.suggested_response);
      objsWithResponses.slice(0, 2).forEach((objection: any) => {
        drawRoundedRect(doc, margin, currentY, contentWidth, 24, 3, colors.slate100);
        
        setColor(doc, colors.slate800);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        const objName = (objection.objection || objection.type || '').substring(0, 30);
        doc.text(objName + ':', margin + 5, currentY + 7);
        
        doc.setFont('helvetica', 'normal');
        setColor(doc, colors.slate600);
        const response = (objection.suggested_response || '').substring(0, 100);
        const responseLines = doc.splitTextToSize(response, contentWidth - 15);
        doc.text(responseLines.slice(0, 2), margin + 5, currentY + 14);
        
        currentY += 28;
      });
    }
  }

  // ============================================
  // PAGE 4: Market Breakdown
  // ============================================
  doc.addPage();
  
  // Header
  setFillColor(doc, colors.navy);
  doc.rect(0, 0, pageWidth, 25, 'F');
  setFillColor(doc, colors.gold);
  doc.rect(0, 25, pageWidth, 2, 'F');
  
  setColor(doc, colors.white);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('MARKET INSIGHTS', margin, 16);
  
  currentY = 40;
  
  const markets = insight.market_breakdown || [];
  
  if (Array.isArray(markets) && markets.length > 0) {
    markets.slice(0, 6).forEach((market: any) => {
      const marketName = market.market || market.name || 'Unknown Market';
      const callCount = market.call_count || market.calls || 0;
      const topConcerns = market.top_concerns || market.concerns || [];
      const uniquePatterns = market.unique_patterns || market.patterns || [];
      
      const cardHeight = 40;
      
      if (currentY + cardHeight > pageHeight - 20) {
        doc.addPage();
        currentY = 20;
      }
      
      drawRoundedRect(doc, margin, currentY, contentWidth, cardHeight, 4, colors.white, colors.slate200);
      
      // Market icon
      setFillColor(doc, colors.navy);
      doc.circle(margin + 12, currentY + 12, 8, 'F');
      
      // Market name
      setColor(doc, colors.slate800);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(marketName, margin + 25, currentY + 12);
      
      // Call count badge
      drawBadge(doc, margin + contentWidth - 45, currentY + 8, `${callCount} calls`, colors.gold);
      
      // Top concern
      if (topConcerns.length > 0) {
        setColor(doc, colors.slate600);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const concern = typeof topConcerns[0] === 'string' ? topConcerns[0] : topConcerns[0].concern || '';
        doc.text(`Top Concern: ${concern.substring(0, 50)}`, margin + 25, currentY + 22);
      }
      
      // Unique pattern
      if (uniquePatterns.length > 0) {
        setColor(doc, colors.slate600);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        const pattern = typeof uniquePatterns[0] === 'string' ? uniquePatterns[0] : uniquePatterns[0].pattern || '';
        doc.text(`Unique: ${pattern.substring(0, 50)}`, margin + 25, currentY + 32);
      }
      
      currentY += cardHeight + 8;
    });
  }

  // ============================================
  // PAGE 5: AI Recommendations
  // ============================================
  doc.addPage();
  
  // Header
  setFillColor(doc, colors.navy);
  doc.rect(0, 0, pageWidth, 25, 'F');
  setFillColor(doc, colors.gold);
  doc.rect(0, 25, pageWidth, 2, 'F');
  
  setColor(doc, colors.white);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('AI RECOMMENDATIONS', margin, 16);
  
  currentY = 40;
  
  const recommendations = insight.ai_recommendations || [];
  
  if (Array.isArray(recommendations) && recommendations.length > 0) {
    recommendations.forEach((rec: any, index: number) => {
      const title = rec.title || rec.recommendation || 'Recommendation';
      const description = rec.description || rec.details || '';
      const priority = rec.priority || (index < 2 ? 'high' : index < 4 ? 'medium' : 'low');
      const impact = rec.expected_impact || rec.impact || '';
      
      const cardHeight = 45;
      
      if (currentY + cardHeight > pageHeight - 20) {
        doc.addPage();
        currentY = 20;
      }
      
      // Card background with priority color accent
      const priorityColors: Record<string, { r: number; g: number; b: number }> = {
        high: colors.red,
        medium: colors.amber,
        low: colors.green,
      };
      const accentColor = priorityColors[priority.toLowerCase()] || colors.slate600;
      
      drawRoundedRect(doc, margin, currentY, contentWidth, cardHeight, 4, colors.white, colors.slate200);
      
      // Priority accent bar
      setFillColor(doc, accentColor);
      doc.rect(margin, currentY, 4, cardHeight, 'F');
      
      // Priority badge
      drawBadge(doc, margin + 10, currentY + 10, priority.toUpperCase(), accentColor);
      
      // Title
      setColor(doc, colors.slate800);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const displayTitle = title.length > 60 ? title.substring(0, 57) + '...' : title;
      doc.text(displayTitle, margin + 10, currentY + 22);
      
      // Description
      if (description) {
        setColor(doc, colors.slate600);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const descLines = doc.splitTextToSize(description, contentWidth - 20);
        doc.text(descLines.slice(0, 2), margin + 10, currentY + 30);
      }
      
      // Impact badge
      if (impact) {
        setColor(doc, colors.green);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.text(`Impact: ${impact.substring(0, 30)}`, margin + contentWidth - 8, currentY + 40, { align: 'right' });
      }
      
      currentY += cardHeight + 8;
    });
  }
  
  // ============================================
  // Footer on last page
  // ============================================
  setColor(doc, colors.slate600);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • Powered by Appendify LLC`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  // Save the PDF
  const filename = `member-insights-${new Date(insight.date_range_start).toISOString().split('T')[0]}_${new Date(insight.date_range_end).toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};
