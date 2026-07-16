import prisma from './src/config/database';
async function main() {
  const logs = await prisma.editorAssignmentLog.findMany({
    where: { projectId: 'cmrmeth3j0000owhw8cyjfepb' },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(JSON.stringify(logs, null, 2));
  console.log(`TOTAL_LOGS: ${logs.length}`);
}
main().finally(() => prisma.$disconnect());
