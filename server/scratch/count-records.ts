import prisma from '../src/config/database';

async function count() {
  console.log('=== CURRENT DATABASE STATUS ===\n');

  // Count records
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true }
  });
  const clientsCount = await prisma.client.count();
  const editorsCount = await prisma.editor.count();
  const projectsCount = await prisma.project.count();
  const invoicesCount = await prisma.invoice.count();
  const paymentsCount = await prisma.payment.count();
  const notificationsCount = await prisma.notification.count();
  const projectFilesCount = await prisma.projectFile.count();
  const projectCommentsCount = await prisma.projectComment.count();
  const logsCount = await prisma.editorAssignmentLog.count();

  console.log(`- Users: ${users.length}`);
  for (const u of users) {
    console.log(`  * [${u.role}] ${u.name} (${u.email})`);
  }
  console.log(`- Clients: ${clientsCount}`);
  console.log(`- Editors: ${editorsCount}`);
  console.log(`- Projects: ${projectsCount}`);
  console.log(`- Invoices: ${invoicesCount}`);
  console.log(`- Payments: ${paymentsCount}`);
  console.log(`- Notifications: ${notificationsCount}`);
  console.log(`- Project Files: ${projectFilesCount}`);
  console.log(`- Project Comments: ${projectCommentsCount}`);
  console.log(`- Editor Assignment Logs: ${logsCount}`);
}

count().catch(console.error).finally(() => prisma.$disconnect());
