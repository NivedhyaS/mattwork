const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany({ select: { email: true, role: true, name: true }, take: 20 })
  .then(u => { console.log(JSON.stringify(u, null, 2)); return p.$disconnect(); })
  .catch(e => { console.error(e.message); return p.$disconnect(); });
