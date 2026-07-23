import prisma from '../src/config/database';

async function clean() {
  console.log('--- CLEANING DATABASE FOR DEMO ---');
  
  // 1. Delete dependent transactional records
  const payments = await prisma.payment.deleteMany();
  const invoices = await prisma.invoice.deleteMany();
  const notifications = await prisma.notification.deleteMany();
  const projectFiles = await prisma.projectFile.deleteMany();
  const projectComments = await prisma.projectComment.deleteMany();
  const logs = await prisma.editorAssignmentLog.deleteMany();
  
  // 2. Delete projects
  const projects = await prisma.project.deleteMany();

  // 3. Delete clients and editors
  const clients = await prisma.client.deleteMany();
  const editors = await prisma.editor.deleteMany();

  // 4. Delete users (except ADMIN role)
  const users = await prisma.user.deleteMany({
    where: {
      role: {
        in: ['CLIENT', 'EDITOR']
      }
    }
  });

  console.log('\n✅ Deletion complete:');
  console.log(`- Payments deleted: ${payments.count}`);
  console.log(`- Invoices deleted: ${invoices.count}`);
  console.log(`- Notifications deleted: ${notifications.count}`);
  console.log(`- Project Files deleted: ${projectFiles.count}`);
  console.log(`- Project Comments deleted: ${projectComments.count}`);
  console.log(`- Editor Assignment Logs deleted: ${logs.count}`);
  console.log(`- Projects deleted: ${projects.count}`);
  console.log(`- Clients deleted: ${clients.count}`);
  console.log(`- Editors deleted: ${editors.count}`);
  console.log(`- Client/Editor Users deleted: ${users.count}`);
}

clean().catch(console.error).finally(() => prisma.$disconnect());
