const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: 'postgresql://postgres:root@localhost:5432/mattwork' });
const adapter = new PrismaPg(pool);
const p = new PrismaClient({ adapter });

async function main() {
  const admin = await p.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    console.error('No admin found');
    return;
  }
  
  const project = await p.project.findFirst({ where: { title: 'PRD Video 5' } });
  if (!project) {
    console.error('PRD Video 5 project not found');
    return;
  }
  
  console.log(`Adding test file to project: ${project.title} (${project.id})`);
  
  const testFile = await p.projectFile.create({
    data: {
      projectId: project.id,
      uploadedById: admin.id,
      filename: 'PRD_Video_5_Final_v1.mp4',
      originalName: 'PRD_Video_5_Final_v1.mp4',
      url: 'https://www.w3schools.com/html/mov_bbb.mp4',
      fileType: 'VIDEO',
      mimeType: 'video/mp4',
      size: 1048576,
      version: 1
    }
  });
  
  console.log('Added ProjectFile:', testFile);
  
  await p.$disconnect();
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
