import prisma from './src/config/database';

async function main() {
  const users = await prisma.user.findMany();
  console.log(JSON.stringify(users.map((u: any) => ({ email: u.email, role: u.role, password: u.password })), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
