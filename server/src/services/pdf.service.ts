import PDFDocument from 'pdfkit';
import { Writable } from 'stream';

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

    // 1. Premium Header Layout
    // Brand Badge: MW indigo logo
    doc.roundedRect(45, 45, 32, 32, 6).fill('#4f46e5');
    doc.fillColor('#ffffff').fontSize(14).font('Arial-Bold').text('MW', 51, 54);

    // Brand Meta Information
    doc.font('Arial-Bold').fontSize(14).fillColor('#0f172a').text('MATTWORK', 88, 45);
    doc.font('Arial').fontSize(8.5).fillColor('#64748b')
      .text('Premium Post-Production Services', 88, 60)
      .text('billing@mattwork.com  |  www.mattwork.com', 88, 72);

    // Right-aligned Invoice Title
    doc.fontSize(22).font('Arial-Bold').fillColor('#0f172a').text('INVOICE', 380, 45, { align: 'right', width: 170 });

    // Divider Line
    doc.moveTo(45, 95).lineTo(550, 95).strokeColor('#e2e8f0').lineWidth(0.75).stroke();

    // 2. Info Cards Grid (Side-by-Side)
    const cardY = 110;
    const cardHeight = 76;
    
    // Left card: Client details
    doc.roundedRect(45, cardY, 242, cardHeight, 6).fill('#f8fafc');
    doc.roundedRect(45, cardY, 242, cardHeight, 6).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    
    // Right card: Invoice Details
    doc.roundedRect(308, cardY, 242, cardHeight, 6).fill('#f8fafc');
    doc.roundedRect(308, cardY, 242, cardHeight, 6).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

    // Fill Client Info
    doc.fillColor('#64748b').fontSize(7.5).font('Arial-Bold').text('BILLED TO', 57, cardY + 10);
    doc.fillColor('#0f172a').fontSize(10).font('Arial-Bold').text(params.clientName, 57, cardY + 23, { width: 220, ellipsis: true });
    if (params.clientCompany) {
      doc.fillColor('#475569').fontSize(8.5).font('Arial').text(params.clientCompany, 57, cardY + 37, { width: 220, ellipsis: true });
    }
    doc.fillColor('#64748b').fontSize(8).font('Arial').text(`Client Account (${curCode})`, 57, cardY + 51);

    // Fill Invoice Details
    doc.fillColor('#64748b').fontSize(7.5).font('Arial-Bold').text('INVOICE DETAILS', 320, cardY + 10);
    
    let infoRowY = cardY + 23;
    const drawInfoRow = (label: string, val: string, valColor = '#0f172a', valBold = true) => {
      doc.fillColor('#64748b').fontSize(8.5).font('Arial').text(label, 320, infoRowY);
      doc.fillColor(valColor).fontSize(8.5).font(valBold ? 'Arial-Bold' : 'Arial').text(val, 420, infoRowY, { align: 'right', width: 120 });
      infoRowY += 14;
    };
    drawInfoRow('Invoice No:', params.invoiceNumber);
    drawInfoRow('Issued Date:', new Date().toLocaleDateString(cur.locale, { day: 'numeric', month: 'short', year: 'numeric' }), '#0f172a', false);
    drawInfoRow('Due Date:', params.dueDate, '#4f46e5', true);

    // 3. Line Items Table
    let y = 205;
    
    const drawTableHeader = (posY: number) => {
      doc.rect(45, posY, 505, 22).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(8.5).font('Arial-Bold')
        .text('Description', 55, posY + 6)
        .text('Qty', 315, posY + 6, { width: 30, align: 'center' })
        .text(`Unit Price (${curCode})`, 360, posY + 6, { width: 95, align: 'right' })
        .text(`Amount (${curCode})`, 465, posY + 6, { width: 80, align: 'right' });
    };

    drawTableHeader(y);
    y += 22;

    doc.font('Arial');
    params.items.forEach((item, index) => {
      // Dynamic Page Break check
      if (y > 700) {
        doc.addPage();
        y = 50;
        drawTableHeader(y);
        y += 22;
        doc.font('Arial');
      }

      // Alternating row backgrounds for better readability
      if (index % 2 === 1) {
        doc.rect(45, y, 505, 24).fill('#f8fafc');
      }
      
      // Bottom border line for row
      doc.moveTo(45, y + 24).lineTo(550, y + 24).strokeColor('#f1f5f9').lineWidth(0.5).stroke();

      doc.fillColor('#0f172a')
        .text(item.description, 55, y + 7, { width: 250, ellipsis: true })
        .text(item.quantity.toString(), 315, y + 7, { width: 30, align: 'center' })
        .text(item.amount.toLocaleString(cur.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 360, y + 7, { width: 95, align: 'right' })
        .text(item.total.toLocaleString(cur.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 465, y + 7, { width: 80, align: 'right' });
      
      y += 24;
    });

    // 4. Totals Block & Payment Details (Side-by-Side layout)
    y += 18;
    
    // Page break safety before calculations block
    if (y > 670) {
      doc.addPage();
      y = 50;
    }

    const calcWidth = 205;
    const calcX = 345;
    const initialCalcY = y;

    // Subtotal Row
    doc.font('Arial').fontSize(9).fillColor('#64748b').text('Subtotal:', calcX, y);
    doc.font('Arial-Bold').fontSize(9).fillColor('#0f172a').text(`${cur.symbol}${params.subtotal.toLocaleString(cur.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, calcX + 100, y, { align: 'right', width: 100 });
    y += 16;

    // Taxes Row
    doc.font('Arial').fontSize(9).fillColor('#64748b').text('Taxes & Fees:', calcX, y);
    doc.font('Arial-Bold').fontSize(9).fillColor('#0f172a').text(`${cur.symbol}${params.taxAmount.toLocaleString(cur.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, calcX + 100, y, { align: 'right', width: 100 });
    y += 16;

    // Discount Row (Optional)
    if (params.discount && params.discount > 0) {
      doc.font('Arial').fontSize(9).fillColor('#64748b').text('Discount:', calcX, y);
      doc.font('Arial-Bold').fontSize(9).fillColor('#10b981').text(`-${cur.symbol}${params.discount.toLocaleString(cur.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, calcX + 100, y, { align: 'right', width: 100 });
      y += 16;
    }

    // Highlighted Total Row
    y += 6;
    doc.roundedRect(calcX - 10, y - 5, calcWidth + 15, 26, 4).fill('#f5f3ff');
    doc.roundedRect(calcX - 10, y - 5, calcWidth + 15, 26, 4).strokeColor('#e0e7ff').lineWidth(1).stroke();
    
    doc.font('Arial-Bold').fontSize(9.5).fillColor('#0f172a').text('Total Payable:', calcX, y + 4);
    doc.font('Arial-Bold').fontSize(11.5).fillColor('#4f46e5').text(`${cur.symbol}${params.total.toLocaleString(cur.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, calcX + 100, y + 3, { align: 'right', width: 100 });

    // 5. Payment Details Card (Left aligned, parallel to calculations)
    const noteY = initialCalcY;
    const noteHeight = (params.discount && params.discount > 0) ? 80 : 64;
    
    doc.roundedRect(45, noteY, 270, noteHeight, 6).fill('#fafafa');
    doc.roundedRect(45, noteY, 270, noteHeight, 6).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    
    doc.fontSize(7.5).font('Arial-Bold').fillColor('#64748b').text('PAYMENT & BILLING INFO', 55, noteY + 10);
    doc.font('Arial').fontSize(7.5).fillColor('#475569').lineGap(2)
      .text('1. Reconciliations are managed via automated credit accounts.', 55, noteY + 22, { width: 250 })
      .text('2. Email support@mattwork.com for custom queries.', 55, noteY + 34, { width: 250 })
      .text('3. Payment Terms: Under standard agreement, due on statement.', 55, noteY + 46, { width: 250 });

    // 6. Footer
    doc.moveTo(45, 755).lineTo(550, 755).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.fontSize(8).font('Arial').fillColor('#94a3b8')
      .text('Mattwork Inc.  |  Automated Billing Statement', 45, 765)
      .text(`Generated: ${new Date().toLocaleString()}`, 380, 765, { align: 'right', width: 170 });

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

    // 1. Premium Header Layout
    doc.roundedRect(45, 45, 32, 32, 6).fill('#4f46e5');
    doc.fillColor('#ffffff').fontSize(14).font('Arial-Bold').text('MW', 51, 54);

    doc.font('Arial-Bold').fontSize(14).fillColor('#0f172a').text('MATTWORK', 88, 45);
    doc.font('Arial').fontSize(8.5).fillColor('#64748b')
      .text('Editor Service Invoice & Statement', 88, 60)
      .text('support@mattwork.com  |  www.mattwork.com', 88, 72);

    doc.fontSize(18).font('Arial-Bold').fillColor('#0f172a').text('PAYOUT STATEMENT', 320, 45, { align: 'right', width: 230 });

    doc.moveTo(45, 95).lineTo(550, 95).strokeColor('#e2e8f0').lineWidth(0.75).stroke();

    // 2. Info Cards Grid (Side-by-Side)
    const cardY = 110;
    const cardHeight = 76;

    // Left Card: Editor Info
    doc.roundedRect(45, cardY, 242, cardHeight, 6).fill('#f8fafc');
    doc.roundedRect(45, cardY, 242, cardHeight, 6).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

    // Right Card: Payout Details
    doc.roundedRect(308, cardY, 242, cardHeight, 6).fill('#f8fafc');
    doc.roundedRect(308, cardY, 242, cardHeight, 6).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

    // Fill Editor details
    doc.fillColor('#64748b').fontSize(7.5).font('Arial-Bold').text('EDITOR INFORMATION', 57, cardY + 10);
    doc.fillColor('#0f172a').fontSize(10).font('Arial-Bold').text(params.editorName, 57, cardY + 23, { width: 220, ellipsis: true });
    doc.fillColor('#64748b').fontSize(8.5).font('Arial').text('Mattwork Contract Editor', 57, cardY + 39);
    doc.fillColor('#94a3b8').fontSize(7.5).font('Arial').text('Reconciled monthly payout', 57, cardY + 52);

    // Fill Statement details
    doc.fillColor('#64748b').fontSize(7.5).font('Arial-Bold').text('STATEMENT DETAILS', 320, cardY + 10);
    
    let infoRowY = cardY + 23;
    const drawInfoRow = (label: string, val: string, highlight = false) => {
      doc.fillColor('#64748b').fontSize(8.5).font('Arial').text(label, 320, infoRowY);
      doc.fillColor(highlight ? '#4f46e5' : '#0f172a').fontSize(8.5).font(highlight ? 'Arial-Bold' : 'Arial').text(val, 420, infoRowY, { align: 'right', width: 120 });
      infoRowY += 14;
    };
    drawInfoRow('Statement No:', params.invoiceNumber);
    drawInfoRow('Period:', params.month);
    drawInfoRow('Compiled Date:', new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), true);

    // 3. Currency-Grouped Line Items
    const groups = new Map<string, typeof params.completedProjects>();
    params.completedProjects.forEach(proj => {
      const c = (proj.currency || 'USD').toUpperCase();
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c)!.push(proj);
    });

    let y = 205;
    let groupIndex = 0;
    
    for (const [curCode, projects] of groups.entries()) {
      const cur = getCurrencyConfig(curCode);

      // Check if we need to add a page (page boundary safety)
      if (y > 620) {
        doc.addPage();
        y = 50;
      }

      // Group section heading
      doc.fillColor('#0f172a').fontSize(10.5).font('Arial-Bold').text(`${curCode} Projects & Earnings`, 45, y);
      y += 16;

      // Table Header for group
      doc.rect(45, y, 505, 20).fill('#4f46e5');
      doc.fillColor('#ffffff').fontSize(8.5).font('Arial-Bold')
        .text('Project Title', 55, y + 5)
        .text('Completion Date', 320, y + 5, { width: 100, align: 'center' })
        .text(`Amount (${curCode})`, 445, y + 5, { width: 100, align: 'right' });
      y += 20;

      // Table Body
      doc.font('Arial');
      projects.forEach((proj, idx) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
          
          // Redraw table header on new page
          doc.rect(45, y, 505, 20).fill('#4f46e5');
          doc.fillColor('#ffffff').fontSize(8.5).font('Arial-Bold')
            .text('Project Title', 55, y + 5)
            .text('Completion Date', 320, y + 5, { width: 100, align: 'center' })
            .text(`Amount (${curCode})`, 445, y + 5, { width: 100, align: 'right' });
          y += 20;
          doc.font('Arial');
        }

        // Row background line
        doc.moveTo(45, y + 20).lineTo(550, y + 20).strokeColor('#f1f5f9').lineWidth(0.5).stroke();

        if (idx % 2 === 1) {
          doc.rect(45, y, 505, 20).fill('#f8fafc');
        }

        doc.fillColor('#0f172a')
          .text(proj.title, 55, y + 5, { width: 250, ellipsis: true })
          .text(proj.completedDate, 320, y + 5, { width: 100, align: 'center' })
          .text((proj.rate ?? params.ratePerProject).toLocaleString(cur.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 445, y + 5, { width: 100, align: 'right' });
        
        y += 20;
      });

      // Group subtotal highlight block
      y += 6;
      const groupTotal = projects.reduce((sum, p) => sum + Number(p.rate ?? params.ratePerProject), 0);
      
      doc.roundedRect(340, y - 2, 210, 22, 4).fill('#f5f3ff');
      doc.roundedRect(340, y - 2, 210, 22, 4).strokeColor('#e0e7ff').lineWidth(0.5).stroke();
      
      doc.fillColor('#0f172a').fontSize(8.5).font('Arial-Bold').text(`Total ${curCode} Payout:`, 350, y + 4);
      doc.fillColor('#4f46e5').fontSize(9.5).font('Arial-Bold').text(`${cur.symbol}${groupTotal.toLocaleString(cur.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 440, y + 4, { align: 'right', width: 100 });
      
      y += 35;
      groupIndex++;
    }

    // 4. Payment instructions card
    if (params.paymentDetails) {
      if (y > 670) {
        doc.addPage();
        y = 50;
      }
      const noteY = y;
      doc.roundedRect(45, noteY, 270, 56, 6).fill('#fafafa');
      doc.roundedRect(45, noteY, 270, 56, 6).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      
      doc.fontSize(7.5).font('Arial-Bold').fillColor('#64748b').text('BANK INSTRUCTIONS', 55, noteY + 10);
      doc.font('Arial').fontSize(8).fillColor('#475569').text(params.paymentDetails, 55, noteY + 22, { width: 250, lineGap: 1.5 });
    }

    // 5. Footer
    doc.moveTo(45, 755).lineTo(550, 755).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.fontSize(8).font('Arial').fillColor('#94a3b8')
      .text('Mattwork Payout Statement  |  Confidential statement', 45, 765)
      .text(`Generated: ${new Date().toLocaleString()}`, 380, 765, { align: 'right', width: 170 });

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

    const baseCur = getCurrencyConfig('USD');
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
      const color = changeAbs >= 0 ? '#10b981' : '#ef4444'; // Green or Red

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
