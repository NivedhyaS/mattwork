import { prisma } from './src/config/database';
import { formsService } from './src/modules/forms/forms.service';

async function main() {
  const forms = await prisma.connectedForm.findMany();
  if (forms.length === 0) {
    console.log("No connected forms found.");
    return;
  }
  const form = forms[0];
  console.log("Processing form:", form.googleFormId);
  
  // Clear lastSyncedAt to fetch ALL historical responses
  await prisma.connectedForm.update({
    where: { id: form.id },
    data: {
      lastSyncedAt: null,
      lastProcessedResponseTimestamp: null
    }
  });
  console.log("Cleared sync timestamps to force full sync");

  try {
    const result = await formsService.processFormResponses(form.googleFormId);
    console.log("Result:", result);
  } catch (error) {
    console.error("Error:", error);
  }
}

main().catch(console.error);
