/**
 * Sets PRD reference numbers on the test client for balance audit.
 *   advancePaid       = 50,000
 *   One UPLOADED project with clientPrice = 1,000
 *   → completedWorkValue = 1,000
 *   → remainingCredit   = 49,000
 *   → equivalentVideos  = 49
 *
 * NOTE: The PRD example says "45 videos" with "₹5,000 completed" and "₹45,000 remaining".
 * That implies avg clientPrice = 1,000 per video (45,000 / 45 = 1,000).
 * So we use clientPrice = 1,000 on the completed project, advancePaid = 50,000.
 * completedWorkValue = 1,000, remaining = 49,000, videos = 49.
 *
 * To get exactly (50,000 / 5,000 / 45,000 / 45) from PRD:
 *   advancePaid = 50,000
 *   completed projects: clientPrice total = 5,000 across projects averaging 1,000
 *   → 5 projects × 1,000 each, OR set advancePaid = 50,000, completed = 5,000 total, avg = 1,000
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/seed-balance-prd.ts
 */

import prisma from '../src/config/database';
import { ProjectStatus } from '@prisma/client';

async function main() {
  const client = await prisma.client.findFirst({
    where: { user: { email: 'client@mattwork.com' } },
    select: { id: true },
  });
  if (!client) throw new Error('Test client not found — run seed-audit.ts first');

  // Set advancePaid = 50,000
  await prisma.client.update({
    where: { id: client.id },
    data: { advancePaid: 50000 },
  });
  console.log('✅ advancePaid = 50,000');

  // Create 5 completed projects each with clientPrice = 1,000
  // → total completedWorkValue = 5,000; avg = 1,000; equivalentVideos = 45 (remaining 45,000 / 1,000)
  const editor = await prisma.editor.findFirst({ select: { id: true } });

  for (let i = 1; i <= 5; i++) {
    const existing = await prisma.project.findFirst({
      where: { clientId: client.id, title: `PRD Video ${i}` },
      select: { id: true },
    });
    if (!existing) {
      const p = await prisma.project.create({
        data: {
          title: `PRD Video ${i}`,
          status: ProjectStatus.UPLOADED,
          clientPrice: 1000,
          editorPrice: 600,
          priority: 'MEDIUM',
          tags: ['prd-reference'],
          client: { connect: { id: client.id } },
          ...(editor && { editor: { connect: { id: editor.id } } }),
        },
        select: { id: true },
      });
      console.log(`✅ Created UPLOADED project "PRD Video ${i}" clientPrice=1000 (id: ${p.id})`);
    } else {
      await prisma.project.update({
        where: { id: existing.id },
        data: { status: ProjectStatus.UPLOADED, clientPrice: 1000 },
      });
      console.log(`✅ Updated "PRD Video ${i}" → UPLOADED, clientPrice=1000`);
    }
  }

  console.log('\n🎯 Expected balance response:');
  console.log('   advancePaid            = 50000');
  console.log('   completedWorkValue     = 5000   (5 × 1000)');
  console.log('   remainingCredit        = 45000');
  console.log('   equivalentRemainingVideos = 45  (45000 / 1000 avg)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
