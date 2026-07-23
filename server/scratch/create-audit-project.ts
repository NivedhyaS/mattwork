import prisma from '../src/config/database';

async function createAuditProject() {
  console.log('--- CREATING TEST PROJECT FOR AUDIT ---');

  const clientUser = await prisma.user.findUnique({
    where: { email: 'john@gmail.com' },
    include: { client: true },
  });
  if (!clientUser || !clientUser.client) {
    console.error('Client John not found!');
    return;
  }

  const editorUser = await prisma.user.findUnique({
    where: { email: 'editor@mattwork.com' },
    include: { editor: true },
  });
  if (!editorUser || !editorUser.editor) {
    console.error('Editor not found!');
    return;
  }

  const project = await prisma.project.create({
    data: {
      title: 'Audit Test Project',
      description: 'Audit description',
      clientId: clientUser.client.id,
      editorId: editorUser.editor.id,
      status: 'EDITING',
      rawMaterialsFolder: 'https://drive.google.com/drive/folders/client-raw-materials-url-abc123xyz',
      driveFolder: 'https://drive.google.com/drive/folders/internal-mattwork-copy-def456uvw',
      clientPrice: 100.00,
      editorPrice: 60.00,
    },
  });

  console.log(`\n✅ SUCCESS: Created Audit Project!`);
  console.log(`- Project ID: ${project.id}`);
  console.log(`- Title: ${project.title}`);
}

createAuditProject().catch(console.error).finally(() => prisma.$disconnect());
