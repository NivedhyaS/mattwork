import { formatCurrency, formatEditorCurrency } from '@/lib/utils';

export const COMPLETED_STATUSES = ['COMPLETED', 'FINAL_DRAFT', 'UPLOADED'];

// PRD §11 Automations 4–6: Revenue AND Editor Payable are both recognized
// at the same trigger: "Project Approval" (any Completed/Uploaded/Final status).
// Using the same set for both eliminates timing mismatch & artificially negative margins.
export const REVENUE_RECOGNIZED_STATUSES = ['COMPLETED', 'FINAL_DRAFT', 'UPLOADED'];

export const ACTIVE_STATUSES = [
  'NEW_VIDEO',
  'EDITING',
  'EDITING_REVIEW',
  'REVISION_1',
  'REVISION_1_REVIEW',
  'REVISION_2',
  'REVISION_2_REVIEW',
  'REVISION_3',
  'REVISION_3_REVIEW'
];

export interface ClientBreakdown {
  clientId: string;
  clientName: string;
  totalRevenue: number;
  advanceReceived: number;
  remainingCredit: number;
  completedVideos: number;
}

export interface EditorBreakdown {
  editorId: string;
  editorName: string;
  amountPayable: number;
  completedProjectsCount: number;
  pendingPaymentsAmount: number;
}

export interface FinancialMetrics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  otherProjects: number;
  upcomingDeadlines: number;
  totalRevenueUsd: number;
  totalCostsInr: number;
  totalCostsUsd: number;
  totalNetMarginUsd: number;
  totalNetMarginInr: number;
  marginPct: string;
  clientBalances: number;
  pendingEditorPayouts: number;
  clientBreakdowns: ClientBreakdown[];
  editorBreakdowns: EditorBreakdown[];
  pendingRevisionsCount: number;
  pendingRevisions: any[];
}

export function calculateFinancialMetrics(
  projects: any[],
  invoices: any[],
  clients: any[],
  editors: any[],
  rate: number
): FinancialMetrics {
  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => ACTIVE_STATUSES.includes(p.status)).length;
  const completedProjectsList = projects.filter(p => COMPLETED_STATUSES.includes(p.status));
  const completedProjects = completedProjectsList.length;
  const otherProjects = totalProjects - activeProjects - completedProjects;

  const deadlineThresholdDays = 7;
  const upcomingDeadlines = projects.filter(p => {
    if (!p.dueDate) return false;
    if (COMPLETED_STATUSES.includes(p.status)) return false;
    const diffDays = Math.ceil((new Date(p.dueDate).getTime() - Date.now()) / 86_400_000);
    return diffDays >= 0 && diffDays <= deadlineThresholdDays;
  }).length;

  const pendingRevisions = projects.filter(p => p.hasPendingRevisionRequest);
  const pendingRevisionsCount = pendingRevisions.length;

  // PRD §11 Automations 4–6:
  // Revenue is recognized at the same trigger as Editor Cost — project Approval/Completion.
  // This is accrual/billed revenue, NOT collected revenue.
  // Using the same status set for both eliminates timing mismatch.
  const approvedProjects = projects.filter(p => REVENUE_RECOGNIZED_STATUSES.includes(p.status));

  // All non-cancelled projects — used for per-client/editor table breakdowns (shows full pipeline)
  const revenueProjects = projects.filter(p => p.status !== 'CANCELLED');

  // Revenue = sum of Client Budget (clientPrice field) for approved/completed projects (accrual basis)
  // NOTE: The DB has both `budget` and `clientPrice` fields. The project creation/edit form
  // saves into `clientPrice`; `budget` is a legacy/separate field. We read clientPrice primarily.
  const totalRevenueUsd = approvedProjects.reduce((s, p) => s + Number(p.clientPrice || p.budget || 0), 0);

  // Cost = sum of Editor Price for approved/completed projects (same trigger as Revenue)
  const totalCostsInr = approvedProjects.reduce((s, p) => s + Number(p.editorPrice || 0), 0);
  const totalCostsUsd = totalCostsInr / rate;

  const totalNetMarginUsd = totalRevenueUsd - totalCostsUsd;
  const totalNetMarginInr = (totalRevenueUsd * rate) - totalCostsInr;
  const marginPct = totalRevenueUsd > 0 ? ((totalNetMarginUsd / totalRevenueUsd) * 100).toFixed(1) : 'N/A';

  // Client Breakdown
  const clientBreakdowns: ClientBreakdown[] = clients.map(client => {
    const clientProjects = revenueProjects.filter(p => p.clientId === client.id);
    // Read clientPrice (the field the UI saves into), fall back to budget
    const clientTotalRevenue = clientProjects.reduce((s, p) => s + Number(p.clientPrice || p.budget || 0), 0);
    const clientInvoices = invoices.filter(inv => inv.clientId === client.id && inv.status !== 'CANCELLED');
    const advanceReceived = clientInvoices.reduce((s, inv) => s + Number(inv.amountPaid || 0), 0);
    const remainingCredit = advanceReceived - clientTotalRevenue;
    
    return {
      clientId: client.id,
      clientName: client.company || client.user?.name || 'Unknown Client',
      totalRevenue: clientTotalRevenue,
      advanceReceived,
      remainingCredit,
      completedVideos: clientProjects.filter(p => COMPLETED_STATUSES.includes(p.status)).length,
    };
  });

  // Editor Breakdown
  const editorBreakdowns: EditorBreakdown[] = editors.map(editor => {
    const editorProjects = revenueProjects.filter(p => p.editorId === editor.id);
    const amountPayable = editorProjects.reduce((s, p) => s + Number(p.editorPrice || 0), 0);
    
    // For pending payments, we only count completed projects that haven't been invoiced by the editor yet
    const completedEditorProjects = editorProjects.filter(p => COMPLETED_STATUSES.includes(p.status));
    const pendingProjects = completedEditorProjects.filter(p => !p.editorInvoiced);
    const pendingPaymentsAmount = pendingProjects.reduce((s, p) => s + Number(p.editorPrice || 0), 0);

    return {
      editorId: editor.id,
      editorName: editor.user?.name || 'Unknown Editor',
      amountPayable,
      completedProjectsCount: completedEditorProjects.length,
      pendingPaymentsAmount,
    };
  });

  const outstandingBalanceUsd = invoices
    .filter(inv => !['PAID', 'CANCELLED'].includes(inv.status))
    .reduce((s, inv) => s + (Number(inv.total || 0) - Number(inv.amountPaid || 0)), 0);

  const pendingEditorPayouts = editorBreakdowns.reduce((s, b) => s + b.pendingPaymentsAmount, 0);

  return {
    totalProjects,
    activeProjects,
    completedProjects,
    otherProjects,
    upcomingDeadlines,
    totalRevenueUsd,
    totalCostsInr,
    totalCostsUsd,
    totalNetMarginUsd,
    totalNetMarginInr,
    marginPct,
    clientBalances: outstandingBalanceUsd,
    pendingEditorPayouts,
    clientBreakdowns,
    editorBreakdowns,
    pendingRevisionsCount,
    pendingRevisions
  };
}
