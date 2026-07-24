const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    where: { status: 'UPLOADED' },
    select: { id: true, clientPrice: true, editorPrice: true }
  });
  
  let rev = 0;
  let cost = 0;
  for(let p of projects.slice(0,3)) {
    rev += Number(p.clientPrice || 0);
    cost += Number(p.editorPrice || 0);
    console.log(`Project ${p.id} - Rev: ${p.clientPrice}, Cost: ${p.editorPrice}`);
  }
  console.log('Totals for first 3: Revenue:', rev, 'Cost:', cost, 'Profit:', rev - cost);
}

main().finally(() => prisma.$disconnect());
