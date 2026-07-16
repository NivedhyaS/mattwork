import { Request, Response } from 'express';
import { reportService } from './report.service';
import { pdfService } from '../../services/pdf.service';
import { ApiResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import ExcelJS from 'exceljs';

export class ReportController {
  // 1. GET /reports/revenue
  getRevenue = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { month, format } = req.query as { month: string; format: 'json' | 'excel' | 'pdf' };
    const report = await reportService.getRevenueReport(month);

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Revenue Report');

      sheet.columns = [
        { header: 'Client Name', key: 'clientName', width: 25 },
        { header: 'Company', key: 'company', width: 25 },
        { header: 'Total Revenue (USD)', key: 'totalRevenue', width: 20 },
      ];

      // Format Header Row
      sheet.getRow(1).font = { bold: true };

      report.clientBreakdown.forEach((item) => {
        sheet.addRow({
          clientName: item.clientName,
          company: item.company || '—',
          totalRevenue: item.totalRevenue,
        });
      });

      // Add Totals Row
      const totalRow = sheet.addRow({
        clientName: 'TOTAL REVENUE',
        company: '',
        totalRevenue: report.totalRevenue,
      });
      totalRow.font = { bold: true };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=revenue_report_${month}.xlsx`);
      const buffer = await workbook.xlsx.writeBuffer();
      res.send(buffer);
    } else if (format === 'pdf') {
      const buffer = await pdfService.generateRevenueReportPDF(report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=revenue_report_${month}.pdf`);
      res.send(buffer);
    } else {
      ApiResponse.success(res, report, 'Revenue report retrieved successfully');
    }
  });

  // 2. GET /reports/editor-payments
  getEditorPayments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { month, format } = req.query as { month: string; format: 'json' | 'excel' | 'pdf' };
    const report = await reportService.getEditorPaymentsReport(month);

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Editor Payments Report');

      sheet.columns = [
        { header: 'Editor Name', key: 'editorName', width: 25 },
        { header: 'Completed Count', key: 'completedCount', width: 18 },
        { header: 'Average Rate (USD)', key: 'averageRate', width: 20 },
        { header: 'Total Payout (USD)', key: 'totalPayout', width: 20 },
      ];

      sheet.getRow(1).font = { bold: true };

      let totalCompleted = 0;
      report.editorPayments.forEach((item) => {
        totalCompleted += item.completedCount;
        sheet.addRow({
          editorName: item.editorName,
          completedCount: item.completedCount,
          averageRate: item.averageRate || '—',
          totalPayout: item.totalPayout,
        });
      });

      const totalRow = sheet.addRow({
        editorName: 'TOTAL EDITOR COSTS',
        completedCount: totalCompleted,
        averageRate: '',
        totalPayout: report.totalPayout,
      });
      totalRow.font = { bold: true };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=editor_payments_report_${month}.xlsx`);
      const buffer = await workbook.xlsx.writeBuffer();
      res.send(buffer);
    } else if (format === 'pdf') {
      const buffer = await pdfService.generateEditorPaymentsReportPDF(report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=editor_payments_report_${month}.pdf`);
      res.send(buffer);
    } else {
      ApiResponse.success(res, report, 'Editor payments report retrieved successfully');
    }
  });

  // 3. GET /reports/client-utilization
  getClientUtilization = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { month, format } = req.query as { month: string; format: 'json' | 'excel' | 'pdf' };
    const report = await reportService.getClientUtilizationReport(month);

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Client Utilization Report');

      sheet.columns = [
        { header: 'Client Name', key: 'clientName', width: 25 },
        { header: 'Company', key: 'company', width: 25 },
        { header: 'Submitted', key: 'submitted', width: 15 },
        { header: 'Completed', key: 'completed', width: 15 },
        { header: 'Avg Turnaround (Days)', key: 'avgTurnaround', width: 22 },
      ];

      sheet.getRow(1).font = { bold: true };

      let totalSubmitted = 0;
      let totalCompleted = 0;

      report.clientUtilization.forEach((item) => {
        totalSubmitted += item.projectsSubmitted;
        totalCompleted += item.projectsCompleted;
        sheet.addRow({
          clientName: item.clientName,
          company: item.company || '—',
          submitted: item.projectsSubmitted,
          completed: item.projectsCompleted,
          avgTurnaround: item.avgTurnaroundDays !== null ? item.avgTurnaroundDays : '—',
        });
      });

      const totalRow = sheet.addRow({
        clientName: 'TOTALS',
        company: '',
        submitted: totalSubmitted,
        completed: totalCompleted,
        avgTurnaround: '',
      });
      totalRow.font = { bold: true };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=client_utilization_report_${month}.xlsx`);
      const buffer = await workbook.xlsx.writeBuffer();
      res.send(buffer);
    } else if (format === 'pdf') {
      const buffer = await pdfService.generateClientUtilizationReportPDF(report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=client_utilization_report_${month}.pdf`);
      res.send(buffer);
    } else {
      ApiResponse.success(res, report, 'Client utilization report retrieved successfully');
    }
  });

  // 4. GET /reports/profit
  getProfitability = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { month, format } = req.query as { month: string; format: 'json' | 'excel' | 'pdf' };
    const report = await reportService.getProfitabilityReport(month);

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Profitability Report');

      sheet.columns = [
        { header: 'Financial Metric', key: 'metric', width: 35 },
        { header: 'Amount (USD) / Value', key: 'value', width: 25 },
      ];

      sheet.getRow(1).font = { bold: true };

      sheet.addRow({ metric: 'Total Revenue', value: report.profitReport.revenue });
      sheet.addRow({ metric: 'Total Editor Costs', value: report.profitReport.editorCosts });
      
      const profitRow = sheet.addRow({ metric: 'Net Profit', value: report.profitReport.profit });
      profitRow.font = { bold: true };

      if (report.profitReport.priorMonthProfit !== null) {
        sheet.addRow({ metric: 'Prior Month Profit', value: report.profitReport.priorMonthProfit });
        sheet.addRow({ metric: 'Profit Change Absolute', value: report.profitReport.profitChangeAbsolute });
        sheet.addRow({ metric: 'Profit Change Percentage', value: `${report.profitReport.profitChangePercentage}%` });
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=profitability_report_${month}.xlsx`);
      const buffer = await workbook.xlsx.writeBuffer();
      res.send(buffer);
    } else if (format === 'pdf') {
      const buffer = await pdfService.generateProfitReportPDF(report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=profitability_report_${month}.pdf`);
      res.send(buffer);
    } else {
      ApiResponse.success(res, report, 'Profitability report retrieved successfully');
    }
  });
}

export const reportController = new ReportController();
