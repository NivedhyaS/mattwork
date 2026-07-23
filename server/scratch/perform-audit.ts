import http from 'http';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/database';
import { env } from '../src/config/env';

const PROJECT_ID = 'cmrsyvubj0000zghwj8e2j49i'; // The seeded audit project

async function getAuthToken(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`User not found: ${email}`);
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function makeRequest(
  path: string,
  token: string,
  method: string = 'GET'
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode || 500, body: data });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function audit() {
  console.log('=== STARTING SECURITY AND VISIBILITY AUDIT ===\n');

  const adminToken = await getAuthToken('admin@mattwork.com');
  const editorToken = await getAuthToken('editor@mattwork.com');
  const clientToken = await getAuthToken('john@gmail.com');

  const endpoints = [
    {
      name: 'Project Detail (Admin)',
      path: `/api/v1/projects/${PROJECT_ID}`,
      token: adminToken,
      role: 'ADMIN',
    },
    {
      name: 'Project Detail (Editor)',
      path: `/api/v1/projects/${PROJECT_ID}`,
      token: editorToken,
      role: 'EDITOR',
    },
    {
      name: 'Project Detail (Client)',
      path: `/api/v1/projects/${PROJECT_ID}`,
      token: clientToken,
      role: 'CLIENT',
    },
    {
      name: 'Project Comments (Editor)',
      path: `/api/v1/projects/${PROJECT_ID}/comments`,
      token: editorToken,
      role: 'EDITOR',
    },
    {
      name: 'Invoices List (Editor)',
      path: '/api/v1/invoices?limit=100',
      token: editorToken,
      role: 'EDITOR',
    },
    {
      name: 'Reports (Editor)',
      path: '/api/v1/reports?limit=100',
      token: editorToken,
      role: 'EDITOR',
    },
  ];

  for (const ep of endpoints) {
    console.log(`Checking [${ep.name}] -> GET ${ep.path}...`);
    try {
      const res = await makeRequest(ep.path, ep.token);
      console.log(`  - Status: ${res.status}`);
      if (res.status === 200) {
        let json;
        try {
          json = JSON.parse(res.body);
        } catch {
          console.log('  - Error: Response is not JSON');
          continue;
        }

        // Search response body recursively for properties
        const checkLeaks = (obj: any, keys: string[]): Record<string, { found: boolean; value?: any }> => {
          const results: Record<string, { found: boolean; value?: any }> = {};
          for (const key of keys) {
            results[key] = { found: false };
          }

          const traverse = (current: any) => {
            if (current == null || typeof current !== 'object') return;
            for (const k in current) {
              if (keys.includes(k)) {
                results[k] = { found: true, value: current[k] };
              }
              traverse(current[k]);
            }
          };

          traverse(obj);
          return results;
        };

        const leakStatus = checkLeaks(json, ['rawMaterialsFolder', 'driveFolder']);
        console.log(`  - rawMaterialsFolder: ${leakStatus.rawMaterialsFolder.found ? 'FOUND (' + leakStatus.rawMaterialsFolder.value + ')' : 'ABSENT'}`);
        console.log(`  - driveFolder: ${leakStatus.driveFolder.found ? 'FOUND (' + leakStatus.driveFolder.value + ')' : 'ABSENT'}`);
      } else {
        console.log(`  - Body: ${res.body.slice(0, 100)}`);
      }
      console.log();
    } catch (e) {
      console.error(`  - Failed to fetch:`, e);
    }
  }
}

audit().catch(console.error).finally(() => prisma.$disconnect());
