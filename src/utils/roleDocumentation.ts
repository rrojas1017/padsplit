import jsPDF from 'jspdf';

export const generateRoleDocumentationPDF = () => {
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

  const addSpace = (space: number = 5) => {
    y += space;
  };

  const checkPageBreak = (needed: number = 30) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
  };

  // Title Page
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('PadSplit Sales Dashboard', pageWidth / 2, 60, { align: 'center' });
  doc.setFontSize(18);
  doc.text('User Roles & Permissions Guide', pageWidth / 2, 75, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 95, { align: 'center' });
  doc.text('Version 1.0', pageWidth / 2, 105, { align: 'center' });

  // Page 2 - Introduction
  doc.addPage();
  y = 20;

  addTitle('1. Introduction');
  addSpace(5);
  addText('This document outlines the user roles and permissions within the PadSplit Sales Dashboard system. The system implements a hierarchical role-based access control (RBAC) model to ensure appropriate data access and security.');
  addSpace(10);

  addSubtitle('Role Hierarchy (Highest to Lowest)');
  addBullet('Super Admin - Full system control');
  addBullet('Admin - Operations management');
  addBullet('Supervisor - Site-scoped team management');
  addBullet('Agent - Individual performance view');
  addSpace(15);

  // Super Admin Section
  checkPageBreak(80);
  addTitle('2. Super Admin Role', 16);
  addSpace(5);
  addText('The Super Admin has complete control over the entire system, including user management, site configuration, and all data operations.');
  addSpace(8);

  addSubtitle('Navigation Access');
  addBullet('Dashboard - Full executive dashboard with all KPIs');
  addBullet('Leaderboard - All agents across all sites');
  addBullet('Reports - Complete reporting with export capabilities');
  addBullet('Add Booking - Create bookings for any agent');
  addBullet('Agent Management - Full CRUD on all agents');
  addBullet('User Management - Create, edit, delete users and assign roles');
  addBullet('Display Links - Generate and manage wallboard tokens');
  addBullet('Audit Log - Full system activity history');
  addBullet('Settings - All system configuration options');
  addSpace(8);

  addSubtitle('Data Permissions');
  addBullet('Bookings: View, Create, Edit, Delete (all sites)');
  addBullet('Agents: View, Create, Edit, Delete (all sites)');
  addBullet('Users/Profiles: View, Create, Edit, Delete');
  addBullet('User Roles: Assign, Change, Remove');
  addBullet('Sites: View, Create, Edit, Delete');
  addBullet('Display Tokens: View, Create, Delete');
  addBullet('Audit Logs: Full read access');
  addSpace(8);

  addSubtitle('Key Responsibilities');
  addBullet('Initial system setup and configuration');
  addBullet('Creating and managing all user accounts');
  addBullet('Defining and managing sites (Vixicom, PadSplit Internal)');
  addBullet('Assigning roles to users');
  addBullet('Data integrity and cleanup (delete capabilities)');
  addBullet('Reviewing audit logs for compliance');
  addSpace(15);

  // Admin Section
  checkPageBreak(80);
  addTitle('3. Admin Role', 16);
  addSpace(5);
  addText('Admins handle day-to-day operations including agent management and booking oversight, but cannot modify system-level configurations.');
  addSpace(8);

  addSubtitle('Navigation Access');
  addBullet('Dashboard - Full executive dashboard with all KPIs');
  addBullet('Leaderboard - All agents across all sites');
  addBullet('Reports - Complete reporting with export capabilities');
  addBullet('Add Booking - Create bookings for any agent');
  addBullet('Agent Management - Full CRUD on all agents');
  addBullet('Display Links - Generate and manage wallboard tokens');
  addBullet('Audit Log - Full system activity history');
  addBullet('Settings - Limited configuration options');
  addSpace(8);

  addSubtitle('Data Permissions');
  addBullet('Bookings: View, Create, Edit (NO delete)');
  addBullet('Agents: View, Create, Edit, Delete');
  addBullet('Users/Profiles: View only');
  addBullet('User Roles: View only (cannot assign or change)');
  addBullet('Sites: View only');
  addBullet('Display Tokens: View, Create, Delete');
  addBullet('Audit Logs: Full read access');
  addSpace(8);

  addSubtitle('Limitations vs Super Admin');
  addBullet('Cannot create or delete user accounts');
  addBullet('Cannot assign or modify user roles');
  addBullet('Cannot create, edit, or delete sites');
  addBullet('Cannot delete bookings (only Super Admin can)');
  addSpace(15);

  // Supervisor Section
  checkPageBreak(80);
  addTitle('4. Supervisor Role', 16);
  addSpace(5);
  addText('Supervisors are scoped to their assigned site and can manage bookings for agents within their team. They are the primary data entry users for the manual booking workflow.');
  addSpace(8);

  addSubtitle('Navigation Access');
  addBullet('Dashboard - Site-filtered view of KPIs');
  addBullet('Leaderboard - Agents within their assigned site');
  addBullet('Reports - Site-scoped reporting');
  addBullet('Add Booking - Create bookings for site agents only');
  addBullet('Settings - Personal preferences only');
  addSpace(8);

  addSubtitle('Data Permissions');
  addBullet('Bookings: View (own site), Create, Edit (NO delete)');
  addBullet('Agents: View all (for reference)');
  addBullet('Users/Profiles: View own profile only');
  addBullet('Sites: View only');
  addSpace(8);

  addSubtitle('Site Scoping');
  addText('Supervisors are assigned to a specific site (e.g., Vixicom or PadSplit Internal) via their profile\'s site_id. This assignment determines:', 5);
  addBullet('Which agents appear in their booking forms', 10);
  addBullet('Which bookings they can view and edit', 10);
  addBullet('Which data appears in their dashboard views', 10);
  addSpace(8);

  addSubtitle('Key Responsibilities');
  addBullet('Real-time booking entry for their team');
  addBullet('Monitoring team performance via dashboard');
  addBullet('Ensuring booking data accuracy');
  addBullet('Move-in day reach-out tracking');
  addSpace(15);

  // Agent Section
  checkPageBreak(80);
  addTitle('5. Agent Role', 16);
  addSpace(5);
  addText('Agents have the most restricted access, focused entirely on viewing their own performance metrics. They cannot create, edit, or delete any data.');
  addSpace(8);

  addSubtitle('Navigation Access');
  addBullet('My Performance - Personal performance dashboard only');
  addBullet('Settings - Personal preferences only');
  addSpace(8);

  addSubtitle('Data Permissions');
  addBullet('Bookings: View own bookings only (linked via agent record)');
  addBullet('Profile: View own profile only');
  addBullet('No create, edit, or delete permissions on any resource');
  addSpace(8);

  addSubtitle('Agent-User Linking');
  addText('Agents are linked to user accounts through the agents.user_id field. This connection:', 5);
  addBullet('Allows the system to identify which bookings belong to the agent', 10);
  addBullet('Enables the "My Performance" view to show only relevant data', 10);
  addBullet('Not all agents require a user account (for historical data)', 10);
  addSpace(15);

  // Permission Matrix
  checkPageBreak(100);
  addTitle('6. Permission Summary Matrix', 16);
  addSpace(10);

  // Table header
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const colWidths = [45, 35, 35, 35, 35];
  const startX = margin;
  let tableY = y;

  doc.text('Resource', startX, tableY);
  doc.text('Super Admin', startX + colWidths[0], tableY);
  doc.text('Admin', startX + colWidths[0] + colWidths[1], tableY);
  doc.text('Supervisor', startX + colWidths[0] + colWidths[1] + colWidths[2], tableY);
  doc.text('Agent', startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableY);
  
  tableY += 3;
  doc.line(startX, tableY, startX + contentWidth, tableY);
  tableY += 5;

  doc.setFont('helvetica', 'normal');
  const rows = [
    ['Bookings', 'Full CRUD', 'CRU (no D)', 'CRU (site)', 'View own'],
    ['Agents', 'Full CRUD', 'Full CRUD', 'View', 'None'],
    ['Users/Profiles', 'Full CRUD', 'View', 'View own', 'View own'],
    ['User Roles', 'Full CRUD', 'View', 'None', 'None'],
    ['Sites', 'Full CRUD', 'View', 'View', 'None'],
    ['Display Tokens', 'Full CRUD', 'Full CRUD', 'None', 'None'],
    ['Audit Logs', 'View', 'View', 'None', 'None'],
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

  addSpace(15);

  // Audit & Compliance
  checkPageBreak(50);
  addTitle('7. Audit & Compliance', 16);
  addSpace(5);
  addText('The system maintains comprehensive audit logs for security and compliance purposes.');
  addSpace(8);

  addSubtitle('Logged Actions');
  addBullet('User login and logout events');
  addBullet('Dashboard and report views');
  addBullet('CSV/data exports');
  addBullet('Role changes');
  addBullet('Data imports');
  addSpace(8);

  addSubtitle('Log Details Captured');
  addBullet('User ID and name');
  addBullet('Action type');
  addBullet('Resource accessed');
  addBullet('Timestamp');
  addBullet('IP address (when available)');
  addSpace(8);

  addText('Only Super Admin and Admin users can access the Audit Log section to review system activity.');

  // Save the PDF
  doc.save('PadSplit-Roles-Permissions-Guide.pdf');
};
