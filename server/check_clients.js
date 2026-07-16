const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();
  const users = await p.user.findMany({
    where: { role: 'CLIENT' },
    select: { id: true, email: true, isActive: true, password: true }
  });
  console.log('=== CLIENT USERS ===');
  users.forEach(u => {
    const hashValid = u.password.startsWith('$2b$') || u.password.startsWith('$2a$');
    console.log(`email: ${u.email}`);
    console.log(`  isActive: ${u.isActive}`);
    console.log(`  hash_prefix: ${u.password.substring(0, 7)}`);
    console.log(`  valid_bcrypt: ${hashValid}`);
    console.log('---');
  });
  await p.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
