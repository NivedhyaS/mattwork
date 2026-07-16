import prisma from './src/config/database';
async function main() {
  const inv = await prisma.invoice.findUnique({ where: { number: 'INV-1783570310025' } });
  console.log({subtotal: inv?.subtotal, taxAmount: inv?.taxAmount, discount: inv?.discount, total: inv?.total});
}
main().finally(() => prisma.$disconnect());
