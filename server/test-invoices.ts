import prisma from './src/config/database';

async function main() {
  const invoices = await prisma.invoice.findMany({ include: { client: true } });
  console.log(JSON.stringify(invoices.map(i => ({ id: i.id, number: i.number, clientCurrency: i.client.currency, total: i.total })), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
