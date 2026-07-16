import { pdfService } from './src/services/pdf.service';
import prisma from './src/config/database';
import fs from 'fs';
import path from 'path';

async function main() {
  const artifactDir = 'C:\\Users\\nived\\.gemini\\antigravity-ide\\brain\\519107f6-ee84-431f-b380-4d61af73414d';
  
  // 1. USD Invoice
  const usdInvoice = await prisma.invoice.findUnique({
    where: { number: 'INV-1783570310025' },
    include: { client: { include: { user: true } } }
  });
  if (usdInvoice) {
    const items = typeof usdInvoice.items === 'string' ? JSON.parse(usdInvoice.items) : usdInvoice.items;
    const pdfBuffer = await pdfService.generateClientInvoicePDF({
      invoiceNumber: usdInvoice.number,
      clientName: usdInvoice.client.user.name,
      clientCompany: usdInvoice.client.company || undefined,
      dueDate: usdInvoice.dueDate ? usdInvoice.dueDate.toISOString().split('T')[0] : 'N/A',
      items: items.map((i: any) => ({ description: i.description, quantity: i.quantity, amount: i.unitPrice || i.amount, total: i.total })),
      subtotal: Number(usdInvoice.subtotal),
      taxAmount: Number(usdInvoice.taxAmount),
      discount: Number(usdInvoice.discount),
      total: Number(usdInvoice.total),
      currency: 'USD'
    });
    fs.writeFileSync(path.join(artifactDir, 'invoice_INV-1783570310025_USD.pdf'), pdfBuffer);
    console.log('USD Invoice saved.');
  }

  // 2. GBP Invoice
  const gbpClient = await prisma.client.findFirst({ where: { currency: 'GBP' } });
  if (gbpClient) {
    const gbpInvoice = await prisma.invoice.findFirst({
      where: { clientId: gbpClient.id },
      include: { client: { include: { user: true } } }
    });
    if (gbpInvoice) {
      const items = typeof gbpInvoice.items === 'string' ? JSON.parse(gbpInvoice.items) : gbpInvoice.items;
      const pdfBuffer = await pdfService.generateClientInvoicePDF({
        invoiceNumber: gbpInvoice.number,
        clientName: gbpInvoice.client.user.name,
        clientCompany: gbpInvoice.client.company || undefined,
        dueDate: gbpInvoice.dueDate ? gbpInvoice.dueDate.toISOString().split('T')[0] : 'N/A',
        items: items.map((i: any) => ({ description: i.description, quantity: i.quantity, amount: i.unitPrice || i.amount, total: i.total })),
        subtotal: Number(gbpInvoice.subtotal),
        taxAmount: Number(gbpInvoice.taxAmount),
        discount: Number(gbpInvoice.discount),
        total: Number(gbpInvoice.total),
        currency: 'GBP'
      });
      fs.writeFileSync(path.join(artifactDir, `invoice_${gbpInvoice.number}_GBP.pdf`), pdfBuffer);
      console.log('GBP Invoice saved.');
    }
  }

  // 3. Editor Statement
  const editor = await prisma.editor.findFirst({ include: { user: true } });
  if (editor) {
    const projects = await prisma.project.findMany({
      where: { editorId: editor.id, status: 'UPLOADED' }
    });
    const pdfBuffer = await pdfService.generateEditorInvoicePDF({
      editorName: editor.user.name,
      invoiceNumber: `EST-${Date.now()}`,
      month: 'Jan 2026',
      completedProjects: projects.map(p => ({
        title: p.title,
        completedDate: p.updatedAt.toISOString().split('T')[0],
        rate: Number(p.editorPrice),
        currency: 'USD' // Ensure it's passed here properly, or GBP
      })),
      ratePerProject: 0,
      totalAmount: projects.reduce((acc, p) => acc + Number(p.editorPrice), 0)
    });
    fs.writeFileSync(path.join(artifactDir, 'Editor_Payout_Statement.pdf'), pdfBuffer);
    console.log('Editor Statement saved.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
