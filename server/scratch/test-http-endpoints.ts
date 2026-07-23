import http from 'http';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/database';
import { env } from '../src/config/env';

async function testHttp() {
  console.log('--- TESTING HTTP ENDPOINTS WITH ADMIN JWT ---');
  
  // 1. Get Admin user
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });
  if (!admin) {
    console.error('No admin user found!');
    return;
  }
  
  // 2. Sign JWT
  const token = jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // 3. Make HTTP request to /api/v1/clients?limit=100
  const clientsPromise = new Promise<void>((resolve) => {
    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/clients?limit=100',
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`\nResponse for ${options.path}:`);
        console.log(`- Status Code: ${res.statusCode}`);
        try {
          console.log('- Body:', JSON.stringify(JSON.parse(data), null, 2));
        } catch {
          console.log('- Body:', data);
        }
        resolve();
      });
    });
    req.on('error', (err) => {
      console.error('Request failed:', err.message);
      resolve();
    });
    req.end();
  });

  // 4. Make HTTP request to /api/v1/editors?limit=100
  const editorsPromise = new Promise<void>((resolve) => {
    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1/editors?limit=100',
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`\nResponse for ${options.path}:`);
        console.log(`- Status Code: ${res.statusCode}`);
        try {
          console.log('- Body:', JSON.stringify(JSON.parse(data), null, 2));
        } catch {
          console.log('- Body:', data);
        }
        resolve();
      });
    });
    req.on('error', (err) => {
      console.error('Request failed:', err.message);
      resolve();
    });
    req.end();
  });

  await Promise.all([clientsPromise, editorsPromise]);
}

testHttp().catch(console.error);
