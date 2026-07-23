import prisma from '../src/config/database';

async function findProject() {
  console.log('--- SEARCHING FOR PROJECT "Something in the hand" ---');
  const projects = await prisma.project.findMany({
    where: {
      title: { contains: 'Something in the hand', mode: 'insensitive' }
    },
    include: {
      client: { include: { user: true } },
      editor: { include: { user: true } }
    }
  });

  console.log(`Found ${projects.length} matching project(s):`);
  console.log(JSON.stringify(projects, null, 2));
}

findProject().catch(console.error).finally(() => prisma.$disconnect());
