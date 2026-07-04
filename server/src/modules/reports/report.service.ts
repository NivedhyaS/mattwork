import prisma from '../../config/database';
import { PaymentStatus, ProjectStatus } from '@prisma/client';
import { COMPLETED_STATUSES } from '../clients/client.service';

export class ReportService {
  private getMonthDateRange(month: string) {
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10) - 1; // 0-indexed

    const startDate = new Date(Date.UTC(year, monthIndex, 1));
    const endDate = new Date(Date.UTC(year, monthIndex + 1, 1));

    return { startDate, endDate };
  }

  // 1. Revenue Report
  async getRevenueReport(month: string) {
    const { startDate, endDate } = this.getMonthDateRange(month);

    // Fetch all completed payments in the date range
    const payments = await prisma.payment.findMany({
      where: {
        status: PaymentStatus.COMPLETED,
        paidAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        invoice: {
          include: {
            client: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    const clientMap = new Map<string, { clientName: string; company?: string; totalRevenue: number }>();
    let totalRevenue = 0;

    payments.forEach((payment) => {
      const client = payment.invoice.client;
      const clientName = client.user.name;
      const company = client.company || undefined;
      const amount = Number(payment.amount);

      totalRevenue += amount;

      const existing = clientMap.get(client.id);
      if (existing) {
        existing.totalRevenue += amount;
      } else {
        clientMap.set(client.id, {
          clientName,
          company,
          totalRevenue: amount,
        });
      }
    });

    const clientBreakdown = Array.from(clientMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);

    return {
      month,
      clientBreakdown,
      totalRevenue,
    };
  }

  // 2. Editor Payments Report
  async getEditorPaymentsReport(month: string) {
    const { startDate, endDate } = this.getMonthDateRange(month);

    // Fetch all completed projects in the date range
    const projects = await prisma.project.findMany({
      where: {
        status: { in: COMPLETED_STATUSES },
        editorId: { not: null },
        updatedAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        editor: {
          include: {
            user: true,
          },
        },
      },
    });

    const editorMap = new Map<string, { editorName: string; completedCount: number; totalPayout: number }>();
    let totalPayout = 0;

    projects.forEach((project) => {
      const editor = project.editor!;
      const editorName = editor.user.name;
      const editorPrice = Number(project.editorPrice ?? 0);

      totalPayout += editorPrice;

      const existing = editorMap.get(editor.id);
      if (existing) {
        existing.completedCount += 1;
        existing.totalPayout += editorPrice;
      } else {
        editorMap.set(editor.id, {
          editorName,
          completedCount: 1,
          totalPayout: editorPrice,
        });
      }
    });

    // Sort by editor payouts
    const editorPayments = Array.from(editorMap.values())
      .map((item) => ({
        ...item,
        averageRate: item.completedCount > 0 ? Number((item.totalPayout / item.completedCount).toFixed(2)) : null,
      }))
      .sort((a, b) => b.totalPayout - a.totalPayout);

    return {
      month,
      editorPayments,
      totalPayout,
    };
  }

  // 3. Client Utilization Report
  async getClientUtilizationReport(month: string) {
    const { startDate, endDate } = this.getMonthDateRange(month);

    // Fetch projects submitted (created) or completed in this month
    const submittedProjects = await prisma.project.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
      },
    });

    const completedProjects = await prisma.project.findMany({
      where: {
        status: { in: COMPLETED_STATUSES },
        updatedAt: {
          gte: startDate,
          lt: endDate,
        },
      },
    });

    // Load all clients to ensure we return 0/null instead of omitting clients
    const clients = await prisma.client.findMany({
      include: {
        user: true,
      },
    });

    const clientMap = new Map<string, { clientName: string; company?: string; projectsSubmitted: number; projectsCompleted: number; totalTurnaroundMs: number }>();

    clients.forEach((c) => {
      clientMap.set(c.id, {
        clientName: c.user.name,
        company: c.company || undefined,
        projectsSubmitted: 0,
        projectsCompleted: 0,
        totalTurnaroundMs: 0,
      });
    });

    submittedProjects.forEach((p) => {
      const item = clientMap.get(p.clientId);
      if (item) {
        item.projectsSubmitted += 1;
      }
    });

    completedProjects.forEach((p) => {
      const item = clientMap.get(p.clientId);
      if (item) {
        item.projectsCompleted += 1;
        // Turnaround: submission (createdAt) to completed (updatedAt)
        const diffMs = p.updatedAt.getTime() - p.createdAt.getTime();
        item.totalTurnaroundMs += diffMs;
      }
    });

    const clientUtilization = Array.from(clientMap.values()).map((item) => {
      const avgTurnaroundDays = item.projectsCompleted > 0
        ? Number((item.totalTurnaroundMs / item.projectsCompleted / (1000 * 60 * 60 * 24)).toFixed(2))
        : null;

      const { totalTurnaroundMs, ...rest } = item;
      return {
        ...rest,
        avgTurnaroundDays,
      };
    });

    return {
      month,
      clientUtilization,
    };
  }

  // 4. Profitability Report
  async getProfitabilityReport(month: string) {
    const { startDate, endDate } = this.getMonthDateRange(month);

    // 1. Current Month Revenue
    const revenueAgg = await prisma.payment.aggregate({
      where: {
        status: PaymentStatus.COMPLETED,
        paidAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      _sum: { amount: true },
    });
    const revenue = Number(revenueAgg._sum.amount ?? 0);

    // 2. Current Month Editor Costs
    const editorCostsAgg = await prisma.project.aggregate({
      where: {
        status: { in: COMPLETED_STATUSES },
        updatedAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      _sum: { editorPrice: true },
    });
    const editorCosts = Number(editorCostsAgg._sum.editorPrice ?? 0);

    const profit = revenue - editorCosts;

    // 3. Prior Month Calculation
    const [yearStr, monthStr] = month.split('-');
    let priorYear = parseInt(yearStr, 10);
    let priorMonthNum = parseInt(monthStr, 10) - 1; // 1-indexed (1-12) minus 1
    if (priorMonthNum === 0) {
      priorMonthNum = 12;
      priorYear -= 1;
    }
    const priorMonth = `${priorYear}-${String(priorMonthNum).padStart(2, '0')}`;
    const { startDate: priorStart, endDate: priorEnd } = this.getMonthDateRange(priorMonth);

    // Prior Revenue
    const priorRevenueAgg = await prisma.payment.aggregate({
      where: {
        status: PaymentStatus.COMPLETED,
        paidAt: {
          gte: priorStart,
          lt: priorEnd,
        },
      },
      _sum: { amount: true },
    });
    const priorRevenue = Number(priorRevenueAgg._sum.amount ?? 0);

    // Prior Editor Costs
    const priorEditorCostsAgg = await prisma.project.aggregate({
      where: {
        status: { in: COMPLETED_STATUSES },
        updatedAt: {
          gte: priorStart,
          lt: priorEnd,
        },
      },
      _sum: { editorPrice: true },
    });
    const priorEditorCosts = Number(priorEditorCostsAgg._sum.editorPrice ?? 0);

    const priorMonthProfit = priorRevenue - priorEditorCosts;

    // Check if prior month records exist
    const hasPriorData = await prisma.payment.count({
      where: {
        status: PaymentStatus.COMPLETED,
        paidAt: { gte: priorStart, lt: priorEnd },
      },
    }) > 0 || await prisma.project.count({
      where: {
        status: { in: COMPLETED_STATUSES },
        updatedAt: { gte: priorStart, lt: priorEnd },
      },
    }) > 0;

    let profitChangeAbsolute: number | null = null;
    let profitChangePercentage: number | null = null;

    if (hasPriorData) {
      profitChangeAbsolute = profit - priorMonthProfit;
      if (priorMonthProfit !== 0) {
        profitChangePercentage = Number(((profitChangeAbsolute / Math.abs(priorMonthProfit)) * 100).toFixed(2));
      } else {
        profitChangePercentage = profit !== 0 ? 100 : 0;
      }
    }

    return {
      month,
      profitReport: {
        revenue,
        editorCosts,
        profit,
        priorMonthProfit: hasPriorData ? priorMonthProfit : null,
        profitChangeAbsolute,
        profitChangePercentage,
      },
    };
  }
}

export const reportService = new ReportService();
