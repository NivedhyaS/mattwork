import prisma from '../src/config/database';

async function main() {
  console.log('\n========================================');
  console.log('  editorPrice AUDIT REPORT');
  console.log('  (read-only — no data modified)');
  console.log('========================================\n');

  const projects = await prisma.project.findMany({
    select: {
      id: true,
      title: true,
      editorPrice: true,
      client: {
        select: {
          company: true,
          user: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const withPrice = projects.filter((p) => p.editorPrice != null);
  const withoutPrice = projects.filter((p) => p.editorPrice == null);

  console.log(`Total projects: ${projects.length}`);
  console.log(`  With editorPrice set:    ${withPrice.length}`);
  console.log(`  Without editorPrice set: ${withoutPrice.length}\n`);

  if (withPrice.length === 0) {
    console.log('No projects have an editorPrice set. Nothing to review.');
    return;
  }

  console.log('Projects WITH editorPrice (review currency intent manually):');
  console.log('-'.repeat(100));
  console.log(
    'ID'.padEnd(30) +
    'Title'.padEnd(30) +
    'Client'.padEnd(25) +
    'editorPrice (raw)'
  );
  console.log('-'.repeat(100));

  for (const p of withPrice) {
    const clientLabel = p.client?.company || p.client?.user?.name || 'Unknown';
    const priceLabel = p.editorPrice != null ? Number(p.editorPrice).toFixed(2) : '-';
    console.log(
      p.id.padEnd(30) +
      p.title.substring(0, 28).padEnd(30) +
      clientLabel.substring(0, 23).padEnd(25) +
      priceLabel
    );
  }

  console.log('-'.repeat(100));
  console.log(
    '\nWARNING: These values have no currency tag in the database.\n' +
    '   Admin must review each one and confirm or correct the INR\n' +
    '   amount via the Board drawer (Editor Payout field).\n'
  );
}

main().catch(console.error);
