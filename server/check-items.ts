import prisma from './src/config/database';
async function main() {
  const invoice = await prisma.invoice.findUnique({ where: { number: 'INV-1783570310025' } });
  console.log(JSON.stringify(invoice?.items, null, 2));
}
main().finally(() => prisma.$disconnect());
