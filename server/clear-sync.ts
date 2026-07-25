import { prisma } from './src/config/database';

async function main() {
  const forms = await prisma.connectedForm.findMany();
  if (forms.length === 0) return;
  const form = forms[0];
  
  await prisma.connectedForm.updateMany({
    data: {
      lastSyncedAt: null,
      lastProcessedResponseTimestamp: null
    }
  });
  console.log("Cleared sync timestamps for all forms so the UI Sync Now button will fetch the old responses again!");
}

main().catch(console.error);
