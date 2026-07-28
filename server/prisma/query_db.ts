import dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/config/database';

async function main() {
  const forms = await prisma.connectedForm.findMany({
    include: {
      _count: {
        select: { processedResponses: true }
      }
    }
  });

  console.log('CONNECTED FORMS:');
  console.log(JSON.stringify(forms, null, 2));

  const responses = await prisma.processedFormResponse.findMany();
  console.log('PROCESSED RESPONSES:');
  console.log(JSON.stringify(responses, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
