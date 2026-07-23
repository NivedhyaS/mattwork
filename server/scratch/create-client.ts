import bcrypt from 'bcrypt';
import prisma from '../src/config/database';

async function createClient() {
  console.log('--- RECREATING CLIENT USER JOHN ---');

  const email = 'john@gmail.com';
  const plainPassword = 'Password@123';
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  // 1. Create User
  const user = await prisma.user.create({
    data: {
      name: 'John',
      email: email,
      password: hashedPassword,
      role: 'CLIENT',
      isActive: true,
    },
  });

  // 2. Create associated Client record
  const client = await prisma.client.create({
    data: {
      userId: user.id,
      company: 'John Co',
      currency: 'USD',
    },
  });

  console.log(`\n✅ SUCCESS: Recreated Client Account!`);
  console.log(`- User ID: ${user.id}`);
  console.log(`- Email: ${user.email}`);
  console.log(`- Client ID: ${client.id}`);
  console.log(`- Company: ${client.company}`);
}

createClient().catch(console.error).finally(() => prisma.$disconnect());
