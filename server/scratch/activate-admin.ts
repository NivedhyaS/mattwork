import prisma from '../src/config/database';

async function activateAdmin() {
  console.log('--- ACTIVATING ADMIN ACCOUNT ---');
  
  const user = await prisma.user.findUnique({
    where: { email: 'admin@mattwork.com' },
  });

  if (!user) {
    console.error('❌ Error: admin@mattwork.com user not found in the database!');
    return;
  }

  const updated = await prisma.user.update({
    where: { email: 'admin@mattwork.com' },
    data: { isActive: true },
  });

  console.log(`\n✅ SUCCESS: Reactivated admin account!`);
  console.log(`- ID: ${updated.id}`);
  console.log(`- Email: ${updated.email}`);
  console.log(`- Active Status: ${updated.isActive}`);
}

activateAdmin().catch(console.error).finally(() => prisma.$disconnect());
