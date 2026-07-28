import dotenv from 'dotenv';
dotenv.config();

import { googleFormsService } from '../src/services/googleForms';

async function main() {
  const formId = '17m9Ie7JzfgGK7-stVpsCMIPOpq1FlAktoI7AJP_Xt_Q';
  console.log(`Fetching form structure for formId=${formId}...`);
  try {
    const details = await googleFormsService.getForm(formId);
    console.log('FORM DETAILS:');
    console.log(JSON.stringify(details, null, 2));
  } catch (err: any) {
    console.error('getForm failed:', err?.message || err);
  }

  console.log('\nFetching responses (no filter) for formId=${formId}...');
  try {
    const responses = await googleFormsService.listResponses(formId);
    console.log('RESPONSES:');
    console.log(JSON.stringify(responses, null, 2));
  } catch (err: any) {
    console.error('listResponses failed:', err?.message || err);
  }
}

main().catch(console.error);
