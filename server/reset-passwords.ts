import prisma from './src/config/database';
import bcrypt from 'bcrypt';

async function resetPasswords() {
  const hashedPassword = await bcrypt.hash('Client@123', 12);
  await prisma.user.updateMany({
    where: { email: { in: ['miya@gmail.com', 'shanu@gmail.com'] } },
    data: { password: hashedPassword }
  });
  console.log('Passwords reset to Client@123');
}

resetPasswords().catch(console.error).finally(() => prisma.$disconnect());
