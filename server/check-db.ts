import { prisma } from './src/config/database';

async function checkDb() {
  const forms = await prisma.connectedForm.findMany();
  console.log("Connected Forms:");
  forms.forEach(f => console.log(f.id, f.googleFormId, f.formTitle, f.lastSyncedAt, f.lastProcessedResponseTimestamp));
}
checkDb().catch(console.error);
