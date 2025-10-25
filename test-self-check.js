// Test self-check endpoint
const http = require('http');

console.log('🔍 Testiram /api/self-check endpoint...\n');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/self-check',
  method: 'GET',
  timeout: 30000
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('✅ Status:', res.statusCode);
      console.log('\n📊 REZULTAT:\n');
      console.log(JSON.stringify(json, null, 2));
      
      if (json.checks) {
        console.log('\n='.repeat(60));
        console.log('ANALIZA PROVERA:');
        console.log('='.repeat(60));
        
        json.checks.forEach((check, i) => {
          console.log(`\nProvera ${i+1}: ${check.provider} (${check.model})`);
          console.log('Status:', check.ok ? '✅ OK' : '❌ GREŠKA');
          if (check.used !== undefined) {
            console.log('LLM korišćen:', check.used ? '✅ DA' : '❌ NE');
          }
          if (check.error) {
            console.log('Greška:', check.error);
          }
          if (check.title) {
            console.log('Title:', check.title);
          }
          if (check.meta) {
            console.log('Meta:', check.meta.substring(0, 100) + '...');
          }
        });
      }
      
      process.exit(0);
    } catch (e) {
      console.log('❌ Greška parsiranja:', e.message);
      console.log('Raw:', data);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.log('❌ Greška konekcije:', e.message);
  console.log('\n⚠️ Server možda nije pokrenut? Pokreni: npm start');
  process.exit(1);
});

req.end();
