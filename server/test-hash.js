const bcrypt = require('bcrypt');
const hash = '$2b$12$GitVy9o0AcwNMXhglA0hjeAT6x9xoEOhJTs2hkiqf5qzuhWdD.H4i';
const words = ['password', 'password123', 'Password123', 'Client@123', 'test', 'client', '123456', 'client123'];

async function test() {
  for (const w of words) {
    const res = await bcrypt.compare(w, hash);
    console.log(`${w}: ${res}`);
    const hashOfHash = await bcrypt.compare(await bcrypt.hash(w, 12), hash);
    if(hashOfHash) console.log(`${w} double hashed: true`);
  }
}
test();
