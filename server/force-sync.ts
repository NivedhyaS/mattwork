import { prisma } from './src/config/database';
import { formsService } from './src/modules/forms/forms.service';

async function fixAndSync() {
  console.log("1. Finding all connected forms...");
  const forms = await prisma.connectedForm.findMany();
  
  console.log("2. Clearing sync timestamps for all forms...");
  await prisma.connectedForm.updateMany({
    data: {
      lastSyncedAt: null,
      lastProcessedResponseTimestamp: null
    }
  });

  console.log("3. Deleting all processed form responses to force a full fresh retry...");
  await prisma.processedFormResponse.deleteMany({});

  console.log("4. Triggering manual sync for form 1MPN0aQJaT5eTbir6B_Pukbzyvl_kCQNehrSrr_U46z4...");
  try {
    const result = await formsService.processFormResponses('1MPN0aQJaT5eTbir6B_Pukbzyvl_kCQNehrSrr_U46z4');
    console.log("Sync Result:", result);
  } catch (err) {
    console.error("Sync failed:", err);
  }
}

fixAndSync().catch(console.error);
