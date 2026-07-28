import dotenv from 'dotenv';
dotenv.config();

import { formsService } from '../src/modules/forms/forms.service';
import prisma from '../src/config/database';

async function main() {
  const formId = 'cms1o9cml0009lshwpr3po0b6'; // Form ID in DB
  console.log(`Querying form from database for id=${formId}...`);
  const form = await prisma.connectedForm.findUnique({
    where: { id: formId },
    include: { mappings: true }
  });
  console.log('FORM MAPPINGS AND DETAILS:');
  console.log(JSON.stringify(form, null, 2));

  console.log('\nRunning formsService.processFormResponses...');
  try {
    const result = await formsService.processFormResponses(formId);
    console.log('SYNC SUMMARY RESULT:');
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error('SYNC EXCEPTION THROWN:', err?.stack || err?.message || err);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
