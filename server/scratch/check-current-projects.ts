import http from 'http';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/database';
import { env } from '../src/config/env';

async function checkProjects() {
  console.log('--- FETCHING CURRENT PROJECTS FROM LOCAL PORT 5000 ---');
  
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });
  if (!admin) {
    console.error('No admin user found!');
    return;
  }
  
  const token = jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const options = {
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/projects?limit=100',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      console.log(`Status Code: ${res.statusCode}`);
      try {
        const json = JSON.parse(data);
        console.log(`Projects Count returned by API: ${json.data ? json.data.length : 'undefined'}`);
        if (json.data && json.data.length > 0) {
          console.log('Sample Projects returned:');
          json.data.slice(0, 3).forEach((p: any) => {
            console.log(`- Project ID: ${p.id}, Title: "${p.title}"`);
          });
        }
      } catch {
        console.log('Raw Body:', data);
      }
    });
  });

  req.on('error', err => console.error(err));
  req.end();
}

checkProjects().catch(console.error);
