import PDFDocument from 'pdfkit';
import { Writable } from 'stream';
import fs from 'fs';
import path from 'path';

export function getCurrencyConfig(isoCode?: string) {
  switch (isoCode?.toUpperCase()) {
    case 'INR': return { symbol: '₹', locale: 'en-IN' };
    case 'USD': return { symbol: '$', locale: 'en-US' };
    case 'GBP': return { symbol: '£', locale: 'en-GB' };
    case 'EUR': return { symbol: '€', locale: 'en-IE' };
    default: return { symbol: '$', locale: 'en-US' };
  }
}

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
    discount?: number;
    total: number;
    currency?: string;
  }): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 45 });
    doc.registerFont('Arial', 'C:\\Windows\\Fonts\\arial.ttf');
    doc.registerFont('Arial-Bold', 'C:\\Windows\\Fonts\\arialbd.ttf');

    const cur = getCurrencyConfig(params.currency);
    const curCode = (params.currency || 'USD').toUpperCase();
    const formatCurrency = (val: number) =>
      `${cur.symbol}${val.toLocaleString(cur.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // 1. Header Section (Invoice Generator style)
    const logoPath = path.join(__dirname, '../assets/logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 45, 38, { fit: [150, 48] });
    } else {
      doc.roundedRect(45, 40, 32, 32, 6).fill('#4f46e5');
      doc.fillColor('#ffffff').fontSize(14).font('Arial-Bold').text('MW', 51, 49);
      doc.font('Arial-Bold').fontSize(14).fillColor('#0f172a').text('MATTWORK', 88, 40);
    }

    doc.fontSize(26).font('Arial-Bold').fillColor('#0f172a').text('INVOICE', 350, 36, { align: 'right', width: 200 });

    doc.moveTo(45, 98).lineTo(550, 98).strokeColor('#e2e8f0').lineWidth(0.75).stroke();

    // 2. Info Cards Grid (Side-by-Side 245pt each)
    const cardY = 112;
    const cardHeight = 78;
    const cardWidth = 245;

    doc.roundedRect(45, cardY, cardWidth, cardHeight, 6).fill('#f8fafc');
    doc.roundedRect(45, cardY, cardWidth, cardHeight, 6).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

    doc.roundedRect(305, cardY, cardWidth, cardHeight, 6).fill('#f8fafc');
    doc.roundedRect(305, cardY, cardWidth, cardHeight, 6).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

    // Left card: Client Info
    doc.fillColor('#64748b').fontSize(7.5).font('Arial-Bold').text('BILLED TO', 57, cardY + 10);
    doc.fillColor('#0f172a').fontSize(11).font('Arial-Bold').text(params.clientName, 57, cardY + 23, { width: 220, ellipsis: true });
    if (params.clientCompany) {
      doc.fillColor('#475569').fontSize(8.5).font('Arial').text(params.clientCompany, 57, cardY + 39, { width: 220, ellipsis: true });
    }
    doc.fillColor('#94a3b8').fontSize(7.5).font('Arial').text(`Account Currency: ${curCode}`, 57, cardY + 54);

    // Right card: Invoice Meta & Balance Due
    let infoRowY = cardY + 10;
    doc.fillColor('#64748b').fontSize(8.5).font('Arial').text('Date:', 317, infoRowY);
    doc.fillColor('#0f172a').fontSize(8.5).font('Arial').text(new Date().toLocaleDateString(cur.locale, { day: 'numeric', month: 'short', year: 'numeric' }), 415, infoRowY, { align: 'right', width: 123 });
    infoRowY += 14;

    doc.fillColor('#64748b').fontSize(8.5).font('Arial').text('Due Date:', 317, infoRowY);
    doc.fillColor('#4f46e5').fontSize(8.5).font('Arial-Bold').text(params.dueDate, 415, infoRowY, { align: 'right', width: 123 });

    const balY = cardY + 46;
    doc.roundedRect(315, balY, 225, 24, 4).fill('#f5f3ff');
    doc.roundedRect(315, balY, 225, 24, 4).strokeColor('#e0e7ff').lineWidth(0.5).stroke();
    doc.fillColor('#0f172a').fontSize(9).font('Arial-Bold').text('Balance Due:', 323, balY + 6);
    doc.fillColor('#4f46e5').fontSize(11).font('Arial-Bold').text(formatCurrency(params.total), 415, balY + 5, { align: 'right', width: 117 });

    // 3. Line Items Table
    let y = 208;
    const drawTableHeader = (posY: number) => {
      doc.rect(45, posY, 505, 22).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8.5).font('Arial-Bold')
        .text('Description', 55, posY + 6)
        .text('Qty', 295, posY + 6, { width: 50, align: 'center' })
        .text(`Unit Price (${curCode})`, 350, posY + 6, { width: 95, align: 'right' })
        .text(`Amount (${curCode})`, 450, posY + 6, { width: 95, align: 'right' });
    };

    drawTableHeader(y);
    y += 22;

    doc.font('Arial');
    params.items.forEach((item, index) => {
      if (y > 680) {
        doc.addPage();
        y = 50;
        drawTableHeader(y);
        y += 22;
        doc.font('Arial');
      }

      if (index % 2 === 1) {
        doc.rect(45, y, 505, 24).fill('#f8fafc');
      }
      doc.moveTo(45, y + 24).lineTo(550, y + 24).strokeColor('#f1f5f9').lineWidth(0.5).stroke();

      doc.fillColor('#0f172a')
        .text(item.description, 55, y + 7, { width: 235, ellipsis: true })
        .text(item.quantity.toString(), 295, y + 7, { width: 50, align: 'center' })
        .text(formatCurrency(item.amount), 350, y + 7, { width: 95, align: 'right' })
        .text(formatCurrency(item.total), 450, y + 7, { width: 95, align: 'right' });

      y += 24;
    });

    // 4. Parallel Grid: Payment Details (Left) & Totals Block (Right)
    y += 20;
    if (y > 650) {
      doc.addPage();
      y = 50;
    }

    const calcY = y;

    // Right Block (Subtotal, Tax, Discount, Total)
    doc.font('Arial').fontSize(9).fillColor('#64748b').text('Subtotal:', 315, y);
    doc.font('Arial-Bold').fontSize(9).fillColor('#0f172a').text(formatCurrency(params.subtotal), 445, y, { align: 'right', width: 95 });
    y += 16;

    doc.font('Arial').fontSize(9).fillColor('#64748b').text('Taxes & Fees:', 315, y);
    doc.font('Arial-Bold').fontSize(9).fillColor('#0f172a').text(formatCurrency(params.taxAmount), 445, y, { align: 'right', width: 95 });
    y += 16;

    if (params.discount && params.discount > 0) {
      doc.font('Arial').fontSize(9).fillColor('#64748b').text('Discount:', 315, y);
      doc.font('Arial-Bold').fontSize(9).fillColor('#10b981').text(`-${formatCurrency(params.discount)}`, 445, y, { align: 'right', width: 95 });
      y += 16;
    }

    // Total Container
    y += 4;
    doc.roundedRect(305, y - 4, 245, 26, 6).fill('#f5f3ff');
    doc.roundedRect(305, y - 4, 245, 26, 6).strokeColor('#e0e7ff').lineWidth(0.5).stroke();

    doc.font('Arial-Bold').fontSize(9.5).fillColor('#0f172a').text('Total Payable:', 317, y + 3);
    doc.font('Arial-Bold').fontSize(11.5).fillColor('#4f46e5').text(formatCurrency(params.total), 445, y + 2, { align: 'right', width: 95 });

    // Left Payment Instructions Card
    const noteHeight = (params.discount && params.discount > 0) ? 78 : 62;
    doc.roundedRect(45, calcY, 245, noteHeight, 6).fill('#fafafa');
    doc.roundedRect(45, calcY, 245, noteHeight, 6).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

    doc.fontSize(7.5).font('Arial-Bold').fillColor('#64748b').text('PAYMENT & BILLING INFO', 57, calcY + 10);
    doc.font('Arial').fontSize(7.5).fillColor('#475569').lineGap(2)
      .text('1. Reconciliations managed via credit accounts.', 57, calcY + 22, { width: 220 })
      .text('2. Email billing@mattwork.com for custom queries.', 57, calcY + 34, { width: 220 })
      .text('3. Terms: Payment due upon invoice receipt.', 57, calcY + 46, { width: 220 });

    // 5. Footer
    doc.moveTo(45, 760).lineTo(550, 760).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.fontSize(8).font('Arial').fillColor('#94a3b8')
      .text('Mattwork Inc.  |  Automated Billing Statement', 45, 768)
      .text(`Generated: ${new Date().toLocaleString()}`, 380, 768, { align: 'right', width: 170 });

    return this.streamToBuffer(doc);
  }

  async generateEditorInvoicePDF(params: {
    editorName: string;
    invoiceNumber: string;
    month: string;
    completedProjects: { title: string; completedDate: string; rate?: number; currency?: string }[];
    ratePerProject: number;
    totalAmount: number;
    paymentDetails?: string;
  }): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 45 });
    doc.registerFont('Arial', 'C:\\Windows\\Fonts\\arial.ttf');
    doc.registerFont('Arial-Bold', 'C:\\Windows\\Fonts\\arialbd.ttf');

    const formatINR = (val: number) =>
      `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const totalINR = params.completedProjects.reduce(
      (sum, p) => sum + Number(p.rate ?? params.ratePerProject ?? 0),
      0
    );
    const finalTotal = totalINR > 0 ? totalINR : params.totalAmount;

    // 1. Header Layout with Mattwork Logo (Invoice Generator style)
    const logoPath = path.join(__dirname, '../assets/logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 45, 38, { fit: [150, 48] });
    } else {
      doc.roundedRect(45, 40, 32, 32, 6).fill('#4f46e5');
      doc.fillColor('#ffffff').fontSize(14).font('Arial-Bold').text('MW', 51, 49);
      doc.font('Arial-Bold').fontSize(14).fillColor('#0f172a').text('MATTWORK', 88, 40);
    }

    doc.fontSize(26).font('Arial-Bold').fillColor('#0f172a').text('INVOICE', 350, 36, { align: 'right', width: 200 });

    doc.moveTo(45, 98).lineTo(550, 98).strokeColor('#e2e8f0').lineWidth(0.75).stroke();

    // 2. Info Cards Grid (Equal Width: 245pt each with 15pt gap)
    const cardY = 112;
    const cardHeight = 78;
    const cardWidth = 245;

    doc.roundedRect(45, cardY, cardWidth, cardHeight, 6).fill('#f8fafc');
    doc.roundedRect(45, cardY, cardWidth, cardHeight, 6).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

    doc.roundedRect(305, cardY, cardWidth, cardHeight, 6).fill('#f8fafc');
    doc.roundedRect(305, cardY, cardWidth, cardHeight, 6).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

    // Fill Left Card (Bill To)
    doc.fillColor('#64748b').fontSize(7.5).font('Arial-Bold').text('BILL TO', 57, cardY + 14);
    doc.fillColor('#0f172a').fontSize(11).font('Arial-Bold').text(params.editorName, 57, cardY + 30, { width: 220, ellipsis: true });

    // Fill Right Card details (Date / Due Date / Balance Due)
    let infoRowY = cardY + 10;
    doc.fillColor('#64748b').fontSize(8.5).font('Arial').text('Date:', 317, infoRowY);
    doc.fillColor('#0f172a').fontSize(8.5).font('Arial').text(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), 415, infoRowY, { align: 'right', width: 123 });
    infoRowY += 14;

    doc.fillColor('#64748b').fontSize(8.5).font('Arial').text('Due Date:', 317, infoRowY);
    doc.fillColor('#0f172a').fontSize(8.5).font('Arial').text('Upon Receipt', 415, infoRowY, { align: 'right', width: 123 });

    // Highlighted Balance Due inside Card
    const balY = cardY + 46;
    doc.roundedRect(315, balY, 225, 24, 4).fill('#f5f3ff');
    doc.roundedRect(315, balY, 225, 24, 4).strokeColor('#e0e7ff').lineWidth(0.5).stroke();
    doc.fillColor('#0f172a').fontSize(9).font('Arial-Bold').text('Balance Due:', 323, balY + 6);
    doc.fillColor('#4f46e5').fontSize(11).font('Arial-Bold').text(formatINR(finalTotal), 415, balY + 5, { align: 'right', width: 117 });

    // 3. Line Items Table (Sleek Dark Header #1e293b, 100% INR)
    let y = 208;

    const drawTableHeader = (posY: number) => {
      doc.rect(45, posY, 505, 22).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8.5).font('Arial-Bold')
        .text('Item', 55, posY + 6)
        .text('Quantity', 295, posY + 6, { width: 50, align: 'center' })
        .text('Rate', 350, posY + 6, { width: 95, align: 'right' })
        .text('Amount', 450, posY + 6, { width: 95, align: 'right' });
    };

    drawTableHeader(y);
    y += 22;

    doc.font('Arial');
    params.completedProjects.forEach((proj, idx) => {
      if (y > 680) {
        doc.addPage();
        y = 50;
        drawTableHeader(y);
        y += 22;
        doc.font('Arial');
      }

      if (idx % 2 === 1) {
        doc.rect(45, y, 505, 24).fill('#f8fafc');
      }

      doc.moveTo(45, y + 24).lineTo(550, y + 24).strokeColor('#f1f5f9').lineWidth(0.5).stroke();

      const rateVal = Number(proj.rate ?? params.ratePerProject ?? 0);

      doc.fillColor('#0f172a')
        .text(proj.title, 55, y + 7, { width: 235, ellipsis: true })
        .text('1', 295, y + 7, { width: 50, align: 'center' })
        .text(formatINR(rateVal), 350, y + 7, { width: 95, align: 'right' })
        .text(formatINR(rateVal), 450, y + 7, { width: 95, align: 'right' });

      y += 24;
    });

    // 4. Parallel Grid: Payment Details Card (Left) & Totals Block (Right)
    y += 20;
    if (y > 650) {
      doc.addPage();
      y = 50;
    }

    const calcY = y;

    // Right Block (Subtotal, Tax, Total)
    doc.font('Arial').fontSize(9).fillColor('#64748b').text('Subtotal:', 315, y);
    doc.font('Arial-Bold').fontSize(9).fillColor('#0f172a').text(formatINR(finalTotal), 445, y, { align: 'right', width: 95 });
    y += 16;

    doc.font('Arial').fontSize(9).fillColor('#64748b').text('Tax (0%):', 315, y);
    doc.font('Arial-Bold').fontSize(9).fillColor('#0f172a').text('₹0.00', 445, y, { align: 'right', width: 95 });
    y += 16;

    // Highlighted Total Box (Right)
    y += 4;
    doc.roundedRect(305, y - 4, 245, 26, 6).fill('#f5f3ff');
    doc.roundedRect(305, y - 4, 245, 26, 6).strokeColor('#e0e7ff').lineWidth(0.5).stroke();

    doc.font('Arial-Bold').fontSize(9.5).fillColor('#0f172a').text('Total:', 317, y + 3);
    doc.font('Arial-Bold').fontSize(11.5).fillColor('#4f46e5').text(formatINR(finalTotal), 445, y + 2, { align: 'right', width: 95 });

    // Left Bank & Payout Details Card (Parallel to Totals Block)
    if (params.paymentDetails) {
      doc.roundedRect(45, calcY, 245, 62, 6).fill('#fafafa');
      doc.roundedRect(45, calcY, 245, 62, 6).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

      doc.fontSize(7.5).font('Arial-Bold').fillColor('#64748b').text('BANK & PAYOUT DETAILS', 57, calcY + 10);
      doc.font('Arial').fontSize(8).fillColor('#475569').text(params.paymentDetails, 57, calcY + 23, { width: 220, lineGap: 2 });
    }

    // 5. Footer (Tightened bottom whitespace)
    doc.moveTo(45, 760).lineTo(550, 760).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.fontSize(8).font('Arial').fillColor('#94a3b8')
      .text('Mattwork Editor Payout Statement  |  All amounts in INR (₹)', 45, 768)
      .text(`Generated: ${new Date().toLocaleString('en-IN')}`, 380, 768, { align: 'right', width: 170 });

    return this.streamToBuffer(doc);
  }

  async generateRevenueReportPDF(params: {
    month: string;
    clientBreakdown: { clientName: string; company?: string; totalRevenue: number; currency?: string }[];
    totalRevenue: number;
  }): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 50 });
    doc.registerFont('Arial', 'C:\\Windows\\Fonts\\arial.ttf');
    doc.registerFont('Arial-Bold', 'C:\\Windows\\Fonts\\arialbd.ttf');

    doc
      .fillColor('#0f172a')
      .fontSize(20)
      .font('Arial-Bold')
      .text('MATTWORK REVENUE REPORT', 50, 50)
      .fontSize(10)
      .fillColor('#64748b')
      .font('Arial')
      .text(`Monthly Business Revenue Statement — ${params.month}`, 50, 75);

    doc.moveTo(50, 100).lineTo(550, 100).strokeColor('#cbd5e1').stroke();

    let y = 130;
    doc.rect(50, y, 500, 25).fill('#0f172a');
    doc.fillColor('#ffffff').fontSize(10).font('Arial-Bold')
      .text('Client Name', 60, y + 7)
      .text('Company', 250, y + 7)
      .text('Total Revenue Received', 400, y + 7, { width: 140, align: 'right' });

    y += 25;
    doc.fillColor('#0f172a').font('Arial');

    params.clientBreakdown.forEach((item, index) => {
      const cur = getCurrencyConfig(item.currency || 'USD');
      if (index % 2 === 0) {
        doc.rect(50, y, 500, 25).fill('#f8fafc');
        doc.fillColor('#0f172a');
      }
      doc
        .text(item.clientName, 60, y + 7)
        .text(item.company || '—', 250, y + 7)
        .text(`${cur.symbol}${item.totalRevenue.toLocaleString(cur.locale)}`, 400, y + 7, { width: 140, align: 'right' });
      y += 25;
    });

    const baseCur = getCurrencyConfig('USD');
    y += 15;
    doc.rect(290, y, 260, 30).fill('#f1f5f9');
    doc.fillColor('#0f172a').fontSize(11).font('Arial-Bold')
      .text('Total Revenue:', 300, y + 10)
      .text(`${baseCur.symbol}${params.totalRevenue.toLocaleString(baseCur.locale)}`, 400, y + 10, { width: 140, align: 'right' })
      .font('Arial');

    return this.streamToBuffer(doc);
  }

  async generateEditorPaymentsReportPDF(params: {
    month: string;
    editorPayments: { editorName: string; completedCount: number; totalPayout: number; averageRate: number | null }[];
    totalPayout: number;
  }): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 50 });
    doc.registerFont('Arial', 'C:\\Windows\\Fonts\\arial.ttf');
    doc.registerFont('Arial-Bold', 'C:\\Windows\\Fonts\\arialbd.ttf');

    doc
      .fillColor('#4f46e5')
      .fontSize(20)
      .font('Arial-Bold')
      .text('MATTWORK EDITOR PAYMENTS REPORT', 50, 50)
      .fontSize(10)
      .fillColor('#64748b')
      .font('Arial')
      .text(`Monthly Editor Payout & Performance — ${params.month}`, 50, 75);

    doc.moveTo(50, 100).lineTo(550, 100).strokeColor('#cbd5e1').stroke();

    let y = 130;
    doc.rect(50, y, 500, 25).fill('#4f46e5');
    doc.fillColor('#ffffff').fontSize(10).font('Arial-Bold')
      .text('Editor Name', 60, y + 7)
      .text('Completed Count', 220, y + 7, { width: 100, align: 'center' })
      .text('Average Rate', 330, y + 7, { width: 100, align: 'right' })
      .text('Total Payout', 440, y + 7, { width: 100, align: 'right' });

    y += 25;
    doc.fillColor('#0f172a').font('Arial');

    const baseCur = getCurrencyConfig('INR');
    params.editorPayments.forEach((item, index) => {
      if (index % 2 === 0) {
        doc.rect(50, y, 500, 25).fill('#f5f3ff');
        doc.fillColor('#0f172a');
      }
      doc
        .text(item.editorName, 60, y + 7)
        .text(item.completedCount.toString(), 220, y + 7, { width: 100, align: 'center' })
        .text(item.averageRate !== null ? `${baseCur.symbol}${item.averageRate.toLocaleString(baseCur.locale)}` : '—', 330, y + 7, { width: 100, align: 'right' })
        .text(`${baseCur.symbol}${item.totalPayout.toLocaleString(baseCur.locale)}`, 440, y + 7, { width: 100, align: 'right' });
      y += 25;
    });

    y += 15;
    doc.rect(290, y, 260, 30).fill('#f1f5f9');
    doc.fillColor('#0f172a').fontSize(11).font('Arial-Bold')
      .text('Total Editor Costs:', 300, y + 10)
      .text(`${baseCur.symbol}${params.totalPayout.toLocaleString(baseCur.locale)}`, 440, y + 10, { width: 100, align: 'right' })
      .font('Arial');

    return this.streamToBuffer(doc);
  }

  async generateClientUtilizationReportPDF(params: {
    month: string;
    clientUtilization: { clientName: string; company?: string; projectsSubmitted: number; projectsCompleted: number; avgTurnaroundDays: number | null }[];
  }): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 50 });
    doc.registerFont('Arial', 'C:\\Windows\\Fonts\\arial.ttf');
    doc.registerFont('Arial-Bold', 'C:\\Windows\\Fonts\\arialbd.ttf');

    doc
      .fillColor('#0891b2')
      .fontSize(20)
      .font('Arial-Bold')
      .text('MATTWORK CLIENT UTILIZATION', 50, 50)
      .fontSize(10)
      .fillColor('#64748b')
      .font('Arial')
      .text(`Monthly Client Resource & Turnaround Report — ${params.month}`, 50, 75);

    doc.moveTo(50, 100).lineTo(550, 100).strokeColor('#cbd5e1').stroke();

    let y = 130;
    doc.rect(50, y, 500, 25).fill('#0891b2');
    doc.fillColor('#ffffff').fontSize(9).font('Arial-Bold')
      .text('Client Name', 60, y + 8)
      .text('Company', 190, y + 8)
      .text('Submitted', 310, y + 8, { width: 60, align: 'center' })
      .text('Completed', 380, y + 8, { width: 60, align: 'center' })
      .text('Avg Turnaround', 450, y + 8, { width: 90, align: 'right' });

    y += 25;
    doc.fillColor('#0f172a').font('Arial');

    params.clientUtilization.forEach((item, index) => {
      if (index % 2 === 0) {
        doc.rect(50, y, 500, 25).fill('#ecfeff');
        doc.fillColor('#0f172a');
      }

      const avgTurnaroundDays = item.avgTurnaroundDays;
      const avgStr = avgTurnaroundDays !== null
        ? `${avgTurnaroundDays.toFixed(1)} ${avgTurnaroundDays === 1 ? 'day' : 'days'}`
        : '—';

      doc
        .text(item.clientName, 60, y + 8)
        .text(item.company || '—', 190, y + 8)
        .text(item.projectsSubmitted.toString(), 310, y + 8, { width: 60, align: 'center' })
        .text(item.projectsCompleted.toString(), 380, y + 8, { width: 60, align: 'center' })
        .text(avgStr, 450, y + 8, { width: 90, align: 'right' });
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
    doc.registerFont('Arial', 'C:\\Windows\\Fonts\\arial.ttf');
    doc.registerFont('Arial-Bold', 'C:\\Windows\\Fonts\\arialbd.ttf');

    doc
      .fillColor('#4f46e5')
      .fontSize(20)
      .font('Arial-Bold')
      .text('MATTWORK PROFITABILITY REPORT', 50, 50)
      .fontSize(10)
      .fillColor('#64748b')
      .font('Arial')
      .text(`Monthly Business Profit & Comparison — ${params.month}`, 50, 75);

    doc.moveTo(50, 100).lineTo(550, 100).strokeColor('#cbd5e1').stroke();

    let y = 130;
    doc.rect(50, y, 500, 25).fill('#4f46e5');
    doc.fillColor('#ffffff').fontSize(10).font('Arial-Bold')
      .text('Financial Metric', 60, y + 7)
      .text('Amount', 400, y + 7, { width: 140, align: 'right' });

    y += 25;
    doc.fillColor('#0f172a').font('Arial');

    const baseCur = getCurrencyConfig('USD');

    // Revenue
    doc.text('Total Monthly Revenue (Received)', 60, y + 7)
      .text(`${baseCur.symbol}${params.profitReport.revenue.toLocaleString(baseCur.locale)}`, 400, y + 7, { width: 140, align: 'right' });
    y += 25;

    // Editor Costs
    doc.rect(50, y, 500, 25).fill('#f5f3ff');
    doc.fillColor('#0f172a')
      .text('Total Editor Costs (Payable/Paid)', 60, y + 7)
      .text(`${baseCur.symbol}${params.profitReport.editorCosts.toLocaleString(baseCur.locale)}`, 400, y + 7, { width: 140, align: 'right' });
    y += 25;

    // Profit
    doc.font('Arial-Bold')
      .text('Operating Profit (Net)', 60, y + 7)
      .text(`${baseCur.symbol}${params.profitReport.profit.toLocaleString(baseCur.locale)}`, 400, y + 7, { width: 140, align: 'right' })
      .font('Arial');
    y += 35;

    // Month-over-Month Comparison
    doc.font('Arial-Bold').fontSize(12).fillColor('#4f46e5')
      .text('MONTH-OVER-MONTH PERFORMANCE', 50, y)
      .font('Arial').fontSize(10).fillColor('#0f172a');
    y += 20;

    if (params.profitReport.priorMonthProfit !== null) {
      doc.text('Prior Month Profit:', 60, y)
        .text(`${baseCur.symbol}${params.profitReport.priorMonthProfit.toLocaleString(baseCur.locale)}`, 400, y, { width: 140, align: 'right' });
      y += 20;

      const changeAbs = params.profitReport.profitChangeAbsolute ?? 0;
      const changePct = params.profitReport.profitChangePercentage ?? 0;
      const sign = changeAbs >= 0 ? '+' : '';
      const color = changeAbs >= 0 ? '#10b981' : '#ef4444';

      doc.text('Net Profit Change:', 60, y)
        .fillColor(color).font('Arial-Bold')
        .text(`${sign}${baseCur.symbol}${changeAbs.toLocaleString(baseCur.locale)} (${sign}${changePct.toFixed(1)}%)`, 400, y, { width: 140, align: 'right' })
        .font('Arial');
    } else {
      doc.fillColor('#64748b').text('Prior month profit data is unavailable for MoM comparison.', 60, y);
    }

    return this.streamToBuffer(doc);
  }
}

export const pdfService = new PDFService();
