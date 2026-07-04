import PDFDocument from 'pdfkit';
import { Writable } from 'stream';

export class PDFService {
  /**
   * Helper to turn PDFKit stream generation into a Buffer.
   */
  private streamToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        },
        final(callback) {
          resolve(Buffer.concat(chunks));
          callback();
        }
      });
      doc.pipe(stream);
      doc.end();
    });
  }

  async generateClientInvoicePDF(params: {
    invoiceNumber: string;
    clientName: string;
    clientCompany?: string;
    dueDate: string;
    items: { description: string; quantity: number; amount: number; total: number }[];
    subtotal: number;
    taxAmount: number;
    total: number;
  }): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 45 });

    // Premium Brand Badge: MW indigo logo
    doc.roundedRect(45, 45, 32, 32, 6).fill('#6366f1');
    doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text('MW', 51, 54);

    // Brand Meta
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text('MATTWORK', 88, 45);
    doc.font('Helvetica').fontSize(9).fillColor('#64748b')
      .text('Post-Production Platform', 88, 61)
      .text('billing@mattwork.com  |  www.mattwork.com', 88, 73);

    // Right-aligned Invoice Title
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#0f172a').text('INVOICE', 380, 45, { align: 'right', width: 170 });

    // Divider Line
    doc.moveTo(45, 95).lineTo(550, 95).strokeColor('#e2e8f0').lineWidth(1).stroke();

    // Side-by-Side Billing and Details
    const detailsY = 115;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('BILLED TO', 45, detailsY);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(params.clientName, 45, detailsY + 16);
    if (params.clientCompany) {
      doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(params.clientCompany, 45, detailsY + 31);
    }

    // Invoice details on the right
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('INVOICE DETAILS', 350, detailsY);
    
    // Details key-value grid
    let detailsRowY = detailsY + 16;
    const drawDetailRow = (label: string, val: string) => {
      doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(label, 350, detailsRowY);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text(val, 440, detailsRowY, { align: 'right', width: 110 });
      detailsRowY += 15;
    };
    drawDetailRow('Invoice No:', params.invoiceNumber);
    drawDetailRow('Issued Date:', new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }));
    drawDetailRow('Due Date:', params.dueDate);

    // Table Header
    let y = 205;
    doc.rect(45, y, 505, 24).fill('#f8fafc');
    doc.moveTo(45, y).lineTo(550, y).strokeColor('#e2e8f0').stroke();
    doc.moveTo(45, y + 24).lineTo(550, y + 24).strokeColor('#e2e8f0').stroke();

    doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold')
      .text('Description', 55, y + 7)
      .text('Qty', 320, y + 7, { width: 30, align: 'center' })
      .text('Unit Price (INR)', 370, y + 7, { width: 85, align: 'right' })
      .text('Amount (INR)', 465, y + 7, { width: 80, align: 'right' });

    // Table Body
    y += 24;
    doc.font('Helvetica');
    params.items.forEach((item, index) => {
      // Draw row separator line
      doc.moveTo(45, y + 24).lineTo(550, y + 24).strokeColor('#f1f5f9').stroke();

      doc.fillColor('#0f172a')
        .text(item.description, 55, y + 7, { width: 250, ellipsis: true })
        .text(item.quantity.toString(), 320, y + 7, { width: 30, align: 'center' })
        .text(item.amount.toLocaleString('en-IN'), 370, y + 7, { width: 85, align: 'right' })
        .text(item.total.toLocaleString('en-IN'), 465, y + 7, { width: 80, align: 'right' });
      
      y += 24;
    });

    // Summary calculations block (Right aligned)
    y += 15;
    const calcWidth = 200;
    const calcX = 350;
    
    const drawCalcRow = (label: string, val: string, isTotal = false) => {
      doc.font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(isTotal ? 10 : 9).fillColor(isTotal ? '#0f172a' : '#64748b').text(label, calcX, y);
      doc.font('Helvetica-Bold').fontSize(isTotal ? 11 : 9).fillColor(isTotal ? '#6366f1' : '#0f172a').text(val, calcX + 100, y, { align: 'right', width: 100 });
      y += 18;
    };

    drawCalcRow('Subtotal:', `INR ${params.subtotal.toLocaleString('en-IN')}`);
    drawCalcRow('Taxes & Fees:', `INR ${params.taxAmount.toLocaleString('en-IN')}`);
    
    // Total highlight box
    y += 2;
    doc.rect(calcX - 10, y - 5, calcWidth + 20, 26).fill('#f5f3ff');
    drawCalcRow('Total Payable:', `INR ${params.total.toLocaleString('en-IN')}`, true);

    // Payment details box (Left aligned)
    const noteY = y - 48;
    doc.roundedRect(45, noteY, 270, 68, 6).fill('#fafafa');
    doc.roundedRect(45, noteY, 270, 68, 6).strokeColor('#f1f5f9').stroke();
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b').text('PAYMENT INSTRUCTIONS', 55, noteY + 10);
    doc.font('Helvetica').fontSize(7.5).fillColor('#475569')
      .text('1. Payouts are reconciled via client credit balance.', 55, noteY + 24, { width: 250 })
      .text('2. Please contact support@mattwork.com for support.', 55, noteY + 36, { width: 250 })
      .text('3. Terms: Invoices are compiled under standard billing.', 55, noteY + 48, { width: 250 });

    // Footer
    doc.moveTo(45, 755).lineTo(550, 755).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
      .text('Mattwork Inc.  |  Automated Billing statement', 45, 765)
      .text(`Generated: ${new Date().toLocaleString()}`, 380, 765, { align: 'right', width: 170 });

    return this.streamToBuffer(doc);
  }

  async generateEditorInvoicePDF(params: {
    editorName: string;
    invoiceNumber: string;
    month: string;
    completedProjects: { title: string; completedDate: string }[];
    ratePerProject: number;
    totalAmount: number;
    paymentDetails?: string;
  }): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 45 });

    // Premium Brand Badge: MW indigo logo
    doc.roundedRect(45, 45, 32, 32, 6).fill('#6366f1');
    doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text('MW', 51, 54);

    // Brand Meta
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text('MATTWORK', 88, 45);
    doc.font('Helvetica').fontSize(9).fillColor('#64748b')
      .text('Editor Service Invoice & Statement', 88, 61)
      .text('support@mattwork.com  |  www.mattwork.com', 88, 73);

    // Right-aligned Title
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#0f172a').text('PAYOUT STATEMENT', 320, 45, { align: 'right', width: 230 });

    // Divider Line
    doc.moveTo(45, 95).lineTo(550, 95).strokeColor('#e2e8f0').lineWidth(1).stroke();

    // Editor details side-by-side
    const detailsY = 115;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('EDITOR INFORMATION', 45, detailsY);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(params.editorName, 45, detailsY + 16);
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Contract Editor', 45, detailsY + 31);

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('STATEMENT DETAILS', 350, detailsY);
    let detailsRowY = detailsY + 16;
    const drawDetailRow = (label: string, val: string) => {
      doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(label, 350, detailsRowY);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text(val, 440, detailsRowY, { align: 'right', width: 110 });
      detailsRowY += 15;
    };
    drawDetailRow('Statement No:', params.invoiceNumber);
    drawDetailRow('Period:', params.month);
    drawDetailRow('Compiled Date:', new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }));

    // Table Header
    let y = 205;
    doc.rect(45, y, 505, 24).fill('#6366f1');
    doc.moveTo(45, y).lineTo(550, y).strokeColor('#6366f1').stroke();
    doc.moveTo(45, y + 24).lineTo(550, y + 24).strokeColor('#6366f1').stroke();

    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
      .text('Project Title', 55, y + 7)
      .text('Completion Date', 320, y + 7, { width: 100, align: 'center' })
      .text('Amount (INR)', 445, y + 7, { width: 100, align: 'right' });

    // Table Body
    y += 24;
    doc.font('Helvetica');
    params.completedProjects.forEach((proj, index) => {
      // Row line
      doc.moveTo(45, y + 24).lineTo(550, y + 24).strokeColor('#f1f5f9').stroke();

      // Alternating highlight background
      if (index % 2 === 1) {
        doc.rect(45, y, 505, 24).fill('#fafafa');
      }

      doc.fillColor('#0f172a')
        .text(proj.title, 55, y + 7, { width: 250, ellipsis: true })
        .text(proj.completedDate, 320, y + 7, { width: 100, align: 'center' })
        .text(params.ratePerProject.toLocaleString('en-IN'), 445, y + 7, { width: 100, align: 'right' });
      
      y += 24;
    });

    // Summary calculations block (Right aligned)
    y += 15;
    const calcWidth = 200;
    const calcX = 350;
    
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Completed Count:', calcX, y);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text(params.completedProjects.length.toString(), calcX + 100, y, { align: 'right', width: 100 });
    
    y += 18;
    // Highlight box for total
    doc.rect(calcX - 10, y - 5, calcWidth + 20, 26).fill('#f5f3ff');
    
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text('Total Payout:', calcX, y + 5);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#6366f1').text(`INR ${params.totalAmount.toLocaleString('en-IN')}`, calcX + 100, y + 5, { align: 'right', width: 100 });

    // Bank Payout details (Left aligned)
    if (params.paymentDetails) {
      const noteY = y - 18;
      doc.roundedRect(45, noteY, 270, 56, 6).fill('#fafafa');
      doc.roundedRect(45, noteY, 270, 56, 6).strokeColor('#f1f5f9').stroke();
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b').text('BANK INSTRUCTIONS', 55, noteY + 10);
      doc.font('Helvetica').fontSize(8).fillColor('#475569')
        .text(params.paymentDetails, 55, noteY + 22, { width: 250, lineGap: 2 });
    }

    // Footer
    doc.moveTo(45, 755).lineTo(550, 755).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
      .text('Mattwork Payout Statement  |  Confidential statement', 45, 765)
      .text(`Generated: ${new Date().toLocaleString()}`, 380, 765, { align: 'right', width: 170 });

    return this.streamToBuffer(doc);
  }

  async generateRevenueReportPDF(params: {
    month: string;
    clientBreakdown: { clientName: string; company?: string; totalRevenue: number }[];
    totalRevenue: number;
  }): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 50 });

    doc
      .fillColor('#0f172a')
      .fontSize(20)
      .text('MATTWORK REVENUE REPORT', 50, 50)
      .fontSize(10)
      .fillColor('#64748b')
      .text(`Monthly Business Revenue Statement — ${params.month}`, 50, 75);

    doc.moveTo(50, 100).lineTo(550, 100).strokeColor('#cbd5e1').stroke();

    let y = 130;
    doc.rect(50, y, 500, 25).fill('#0f172a');
    doc.fillColor('#ffffff').fontSize(10)
      .text('Client Name', 60, y + 7)
      .text('Company', 250, y + 7)
      .text('Total Revenue Received', 400, y + 7, { width: 140, align: 'right' });

    y += 25;
    doc.fillColor('#0f172a');

    params.clientBreakdown.forEach((item, index) => {
      if (index % 2 === 0) {
        doc.rect(50, y, 500, 25).fill('#f8fafc');
        doc.fillColor('#0f172a');
      }
      doc
        .text(item.clientName, 60, y + 7)
        .text(item.company || '—', 250, y + 7)
        .text(`INR ${item.totalRevenue.toLocaleString()}`, 400, y + 7, { width: 140, align: 'right' });
      y += 25;
    });

    y += 15;
    doc.rect(290, y, 260, 30).fill('#f1f5f9');
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
      .text('Total Revenue:', 300, y + 10)
      .text(`INR ${params.totalRevenue.toLocaleString()}`, 400, y + 10, { width: 140, align: 'right' })
      .font('Helvetica');

    return this.streamToBuffer(doc);
  }

  async generateEditorPaymentsReportPDF(params: {
    month: string;
    editorPayments: { editorName: string; completedCount: number; totalPayout: number; averageRate: number | null }[];
    totalPayout: number;
  }): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 50 });

    doc
      .fillColor('#4f46e5')
      .fontSize(20)
      .text('MATTWORK EDITOR PAYMENTS REPORT', 50, 50)
      .fontSize(10)
      .fillColor('#64748b')
      .text(`Monthly Editor Payout & Performance — ${params.month}`, 50, 75);

    doc.moveTo(50, 100).lineTo(550, 100).strokeColor('#cbd5e1').stroke();

    let y = 130;
    doc.rect(50, y, 500, 25).fill('#4f46e5');
    doc.fillColor('#ffffff').fontSize(10)
      .text('Editor Name', 60, y + 7)
      .text('Completed Count', 220, y + 7, { width: 100, align: 'center' })
      .text('Average Rate', 330, y + 7, { width: 100, align: 'right' })
      .text('Total Payout', 440, y + 7, { width: 100, align: 'right' });

    y += 25;
    doc.fillColor('#0f172a');

    params.editorPayments.forEach((item, index) => {
      if (index % 2 === 0) {
        doc.rect(50, y, 500, 25).fill('#f5f3ff');
        doc.fillColor('#0f172a');
      }
      doc
        .text(item.editorName, 60, y + 7)
        .text(item.completedCount.toString(), 220, y + 7, { width: 100, align: 'center' })
        .text(item.averageRate !== null ? `INR ${item.averageRate.toLocaleString()}` : '—', 330, y + 7, { width: 100, align: 'right' })
        .text(`INR ${item.totalPayout.toLocaleString()}`, 440, y + 7, { width: 100, align: 'right' });
      y += 25;
    });

    y += 15;
    doc.rect(290, y, 260, 30).fill('#f1f5f9');
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
      .text('Total Editor Costs:', 300, y + 10)
      .text(`INR ${params.totalPayout.toLocaleString()}`, 440, y + 10, { width: 100, align: 'right' })
      .font('Helvetica');

    return this.streamToBuffer(doc);
  }

  async generateClientUtilizationReportPDF(params: {
    month: string;
    clientUtilization: { clientName: string; company?: string; projectsSubmitted: number; projectsCompleted: number; avgTurnaroundDays: number | null }[];
  }): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 50 });

    doc
      .fillColor('#0f172a')
      .fontSize(20)
      .text('MATTWORK CLIENT UTILIZATION', 50, 50)
      .fontSize(10)
      .fillColor('#64748b')
      .text(`Monthly Client Project Volume & Turnaround — ${params.month}`, 50, 75);

    doc.moveTo(50, 100).lineTo(550, 100).strokeColor('#cbd5e1').stroke();

    let y = 130;
    doc.rect(50, y, 500, 25).fill('#0f172a');
    doc.fillColor('#ffffff').fontSize(10)
      .text('Client (Company)', 60, y + 7)
      .text('Submitted', 260, y + 7, { width: 80, align: 'center' })
      .text('Completed', 350, y + 7, { width: 80, align: 'center' })
      .text('Avg Turnaround', 440, y + 7, { width: 100, align: 'right' });

    y += 25;
    doc.fillColor('#0f172a');

    params.clientUtilization.forEach((item, index) => {
      if (index % 2 === 0) {
        doc.rect(50, y, 500, 25).fill('#f8fafc');
        doc.fillColor('#0f172a');
      }
      const displayName = `${item.clientName}${item.company ? ` (${item.company})` : ''}`;
      doc
        .text(displayName, 60, y + 7, { width: 190, ellipsis: true })
        .text(item.projectsSubmitted.toString(), 260, y + 7, { width: 80, align: 'center' })
        .text(item.projectsCompleted.toString(), 350, y + 7, { width: 80, align: 'center' })
        .text(item.avgTurnaroundDays !== null ? `${item.avgTurnaroundDays.toFixed(1)} days` : '—', 440, y + 7, { width: 100, align: 'right' });
      y += 25;
    });

    return this.streamToBuffer(doc);
  }

  async generateProfitReportPDF(params: {
    month: string;
    profitReport: {
      revenue: number;
      editorCosts: number;
      profit: number;
      priorMonthProfit: number | null;
      profitChangeAbsolute: number | null;
      profitChangePercentage: number | null;
    };
  }): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 50 });

    doc
      .fillColor('#4f46e5')
      .fontSize(20)
      .text('MATTWORK PROFITABILITY REPORT', 50, 50)
      .fontSize(10)
      .fillColor('#64748b')
      .text(`Monthly Business Profit & Comparison — ${params.month}`, 50, 75);

    doc.moveTo(50, 100).lineTo(550, 100).strokeColor('#cbd5e1').stroke();

    let y = 130;
    doc.rect(50, y, 500, 25).fill('#4f46e5');
    doc.fillColor('#ffffff').fontSize(10)
      .text('Financial Metric', 60, y + 7)
      .text('Amount (INR)', 400, y + 7, { width: 140, align: 'right' });

    y += 25;
    doc.fillColor('#0f172a');

    // Revenue
    doc.text('Total Monthly Revenue (Received)', 60, y + 7)
      .text(`INR ${params.profitReport.revenue.toLocaleString()}`, 400, y + 7, { width: 140, align: 'right' });
    y += 25;

    // Editor Costs
    doc.rect(50, y, 500, 25).fill('#f5f3ff');
    doc.fillColor('#0f172a')
      .text('Total Editor Costs (Payable/Paid)', 60, y + 7)
      .text(`INR ${params.profitReport.editorCosts.toLocaleString()}`, 400, y + 7, { width: 140, align: 'right' });
    y += 25;

    // Profit
    doc.font('Helvetica-Bold')
      .text('Operating Profit (Net)', 60, y + 7)
      .text(`INR ${params.profitReport.profit.toLocaleString()}`, 400, y + 7, { width: 140, align: 'right' })
      .font('Helvetica');
    y += 35;

    // Month-over-Month Comparison
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#4f46e5')
      .text('MONTH-OVER-MONTH PERFORMANCE', 50, y)
      .font('Helvetica').fontSize(10).fillColor('#0f172a');
    y += 20;

    if (params.profitReport.priorMonthProfit !== null) {
      doc.text('Prior Month Profit:', 60, y)
        .text(`INR ${params.profitReport.priorMonthProfit.toLocaleString()}`, 400, y, { width: 140, align: 'right' });
      y += 20;

      const changeAbs = params.profitReport.profitChangeAbsolute ?? 0;
      const changePct = params.profitReport.profitChangePercentage ?? 0;
      const sign = changeAbs >= 0 ? '+' : '';
      const color = changeAbs >= 0 ? '#10b981' : '#ef4444'; // Green or Red

      doc.text('Net Profit Change:', 60, y)
        .fillColor(color).font('Helvetica-Bold')
        .text(`${sign}INR ${changeAbs.toLocaleString()} (${sign}${changePct.toFixed(1)}%)`, 400, y, { width: 140, align: 'right' })
        .font('Helvetica');
    } else {
      doc.fillColor('#64748b').text('Prior month profit data is unavailable for MoM comparison.', 60, y);
    }

    return this.streamToBuffer(doc);
  }
}

export const pdfService = new PDFService();
