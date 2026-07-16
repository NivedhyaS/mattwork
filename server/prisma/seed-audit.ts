/**
 * Mattwork — Dev seed for serialization audit
 *
 * Creates:
 *   - admin@mattwork.com   (already exists if you ran the main seed)
 *   - editor@mattwork.com  (EDITOR role)
 *   - client@mattwork.com  (CLIENT role)
 *   - One sample project with clientPrice=500, editorPrice=200
 *
 * Run once:
 *   npx ts-node -e "require('./prisma/seed-audit.ts')"
 * or via ts-node directly:
 *   npx ts-node prisma/seed-audit.ts
 */

import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import prisma from '../src/config/database';

async function main() {
  console.log('🌱 Seeding audit test accounts...');

  const hashedAdmin  = await bcrypt.hash('Admin@123456', 12);
  const hashedEditor = await bcrypt.hash('Editor@123456', 12);
  const hashedClient = await bcrypt.hash('Client@123456', 12);

  // ── Admin ─────────────────────────────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@mattwork.com' },
    update: {},
    create: { name: 'System Admin', email: 'admin@mattwork.com', password: hashedAdmin, role: Role.ADMIN },
  });
  console.log('✅ Admin:', adminUser.email);

  // ── Editor ────────────────────────────────────────────────────────────────
  const editorUser = await prisma.user.upsert({
    where: { email: 'editor@mattwork.com' },
    update: {},
    create: { name: 'Test Editor', email: 'editor@mattwork.com', password: hashedEditor, role: Role.EDITOR, phone: '555-1234' },
  });
  let editorProfile = await prisma.editor.findUnique({ where: { userId: editorUser.id } });
  if (!editorProfile) {
    editorProfile = await prisma.editor.create({ data: { userId: editorUser.id, skills: ['editing', 'color-grading'] } });
  }
  console.log('✅ Editor:', editorUser.email, '/ Editor profile id:', editorProfile.id);

  // ── Client ────────────────────────────────────────────────────────────────
  const clientUser = await prisma.user.upsert({
    where: { email: 'client@mattwork.com' },
    update: {},
    create: { name: 'Test Client', email: 'client@mattwork.com', password: hashedClient, role: Role.CLIENT, phone: '555-9999' },
  });
  let clientProfile = await prisma.client.findUnique({ where: { userId: clientUser.id } });
  if (!clientProfile) {
    clientProfile = await prisma.client.create({ data: { userId: clientUser.id, company: 'Test Channel LLC' } });
  }
  console.log('✅ Client:', clientUser.email, '/ Client profile id:', clientProfile.id);

  // ── Project ───────────────────────────────────────────────────────────────
  const existingProject = await prisma.project.findFirst({ where: { clientId: clientProfile.id } });
  if (!existingProject) {
    const project = await prisma.project.create({
      data: {
        title: 'Audit Test Project',
        description: 'Used for serialization auditing',
        clientPrice: 500.00,
        editorPrice: 200.00,
        tags: ['audit', 'test'],
        client: { connect: { id: clientProfile.id } },
        editor: { connect: { id: editorProfile.id } },
      },
    });
    console.log('✅ Project created:', project.id, '| clientPrice=500, editorPrice=200');
  } else {
    console.log('✅ Project already exists:', existingProject.id);
  }

  console.log('\n🎉 Seed complete!');
  console.log('   Admin  : admin@mattwork.com   / Admin@123456');
  console.log('   Editor : editor@mattwork.com  / Editor@123456');
  console.log('   Client : client@mattwork.com  / Client@123456');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
