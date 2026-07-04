import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import prisma from '../src/config/database';

async function main() {
  console.log('🌱 Starting seed...');

  const adminEmail = 'admin@mattwork.com';
  
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log(`✅ Admin user already exists: ${adminEmail}`);
    return;
  }

  const hashedPassword = await bcrypt.hash('Admin@123456', 12);

  const admin = await prisma.user.create({
    data: {
      name: 'System Admin',
      email: adminEmail,
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  console.log(`🎉 Created default admin account: ${admin.email}`);
  console.log(`🔒 Password: Admin@123456 (Please change immediately!)`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('👋 Seed process finished.');
  });
