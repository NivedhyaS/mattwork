const bcrypt = require('bcrypt');

// Get the actual hash from DB
const { PrismaClient } = require('./node_modules/@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('./node_modules/@prisma/adapter-pg');

const pool = new Pool({ connectionString: 'postgresql://postgres:root@localhost:5432/mattwork' });
const adapter = new PrismaPg(pool);
const p = new PrismaClient({ adapter });

const testPasswords = ['Password@123', 'password', 'Password123', 'Admin@123', 'Mattwork@123', 'Client@123', '123456', 'admin', 'Client@123456', 'Admin@123456'];

async function main() {
  const accounts = [
    { email: 'admin@mattwork.com', label: 'ADMIN' },
    { email: 'client@mattwork.com', label: 'CLIENT' },
    { email: 'irene@gmail.com', label: 'CLIENT2' },
  ];

  for (const acct of accounts) {
    const user = await p.user.findUnique({ where: { email: acct.email }, select: { password: true } });
    if (!user) { console.log(`${acct.label}: NOT FOUND`); continue; }
    console.log(`\n=== ${acct.label} (${acct.email}) ===`);
    console.log(`Hash: ${user.password}`);
    for (const pw of testPasswords) {
      const match = await bcrypt.compare(pw, user.password);
      if (match) console.log(`  ✅ MATCH: "${pw}"`);
    }
    console.log('  (tested all passwords, no match = unknown password)');
  }

  await p.$disconnect();
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
