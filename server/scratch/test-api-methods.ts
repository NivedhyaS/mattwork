import { clientService } from '../src/modules/clients/client.service';
import { editorService } from '../src/modules/editors/editor.service';
import prisma from '../src/config/database';

async function testApi() {
  console.log('--- TESTING CLIENT AND EDITOR SERVICE LIST CALLS ---');
  
  try {
    console.log('Calling clientService.listClients...');
    const clients = await clientService.listClients({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' });
    console.log(`✅ Success! Retrieved ${clients.data.length} clients.`);
  } catch (err: any) {
    console.error('❌ Client service call failed:', err);
  }

  try {
    console.log('Calling editorService.listEditors...');
    const editors = await editorService.listEditors({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' });
    console.log(`✅ Success! Retrieved ${editors.data.length} editors.`);
  } catch (err: any) {
    console.error('❌ Editor service call failed:', err);
  }
}

testApi().catch(console.error).finally(() => prisma.$disconnect());
