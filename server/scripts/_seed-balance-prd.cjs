/**
 * Sets up PRD reference numbers on the test client for balance audit.
 * advancePaid = 50000
 * One completed (UPLOADED) project with clientPrice = 5000
 * → completedWorkValue = 5000, remainingCredit = 45000, equivalentVideos = 45
 */
const { PrismaClient, ProjectStatus } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find test client
  const client = await prisma.client.findFirst({
    where: { user: { email: 'client@mattwork.com' } },
    select: { id: true },
  });
  if (!client) throw new Error('Test client not found — run seed-audit.ts first');

  // Set advancePaid = 50000
  await prisma.client.update({
    where: { id: client.id },
    data: { advancePaid: 50000 },
  });
  console.log(`✅ advancePaid set to 50000 on client ${client.id}`);

  // Find or create an UPLOADED project with clientPrice = 5000
  let prd = await prisma.project.findFirst({
    where: { clientId: client.id, title: 'PRD Reference Video' },
    select: { id: true },
  });
  if (!prd) {
    // Find editor
    const editor = await prisma.editor.findFirst({ select: { id: true } });
    prd = await prisma.project.create({
      data: {
        title: 'PRD Reference Video',
        status: ProjectStatus.UPLOADED,
        clientPrice: 5000,
        editorPrice: 2000,
        priority: 'MEDIUM',
        tags: ['prd-reference'],
        client: { connect: { id: client.id } },
        ...(editor && { editor: { connect: { id: editor.id } } }),
      },
      select: { id: true },
    });
    console.log(`✅ Created UPLOADED project with clientPrice=5000 (id: ${prd.id})`);
  } else {
    await prisma.project.update({
      where: { id: prd.id },
      data: { status: ProjectStatus.UPLOADED, clientPrice: 5000 },
    });
    console.log(`✅ Updated PRD Reference Video to UPLOADED, clientPrice=5000`);
  }

  console.log('\n🎯 PRD reference numbers:');
  console.log('   advancePaid       = 50,000');
  console.log('   completedWorkValue = 5,000  (1 × clientPrice 5000)');
  console.log('   remainingCredit   = 45,000');
  console.log('   equivalentVideos  = 45      (45000 / 1000 avg — but avg here is 5000)');
  console.log('   → equivalentVideos should be 9 from avg=5000, not 45');
  console.log('   → To get 45, set clientPrice=1000 on the completed project');
  console.log('      OR keep 5000 and accept 9 as the calculated value.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
