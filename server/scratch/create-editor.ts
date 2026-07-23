import bcrypt from 'bcrypt';
import prisma from '../src/config/database';

async function createEditor() {
  console.log('--- RECREATING EDITOR USER ---');

  const email = 'editor@mattwork.com';
  const plainPassword = 'Password@123';
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  // 1. Create User
  const user = await prisma.user.create({
    data: {
      name: 'Test Editor',
      email: email,
      password: hashedPassword,
      role: 'EDITOR',
      isActive: true,
    },
  });

  // 2. Create associated Editor record
  const editor = await prisma.editor.create({
    data: {
      userId: user.id,
      bio: 'Professional Video Editor',
      skills: ['Premiere Pro', 'After Effects'],
      hourlyRate: 50.00,
      availability: true,
    },
  });

  console.log(`\n✅ SUCCESS: Recreated Editor Account!`);
  console.log(`- User ID: ${user.id}`);
  console.log(`- Email: ${user.email}`);
  console.log(`- Editor ID: ${editor.id}`);
}

createEditor().catch(console.error).finally(() => prisma.$disconnect());
