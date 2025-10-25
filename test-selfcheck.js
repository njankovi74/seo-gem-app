// Test self-check endpointa
const http = require('http');

function testSelfCheck() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/self-check',
    method: 'GET'
  };

  console.log('🔍 Testiram /api/self-check (pravi SEO pipeline)...\n');
  
  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      try {
        const json = JSON.parse(data);
        console.log('\n📦 Odgovor:');
        console.log(JSON.stringify(json, null, 2));
        
        console.log('\n📊 ANALIZA:');
        console.log('Provider:', json.env?.provider);
        console.log('Gemini model:', json.env?.geminiModel);
        console.log('Strict:', json.env?.strict);
        console.log('Required:', json.env?.required);
        
        if (json.checks) {
          json.checks.forEach((check, idx) => {
            console.log(`\n${idx + 1}. ${check.provider} (${check.model}):`);
            console.log('   OK:', check.ok ? '✅' : '❌');
            console.log('   Used LLM:', check.used ? '✅ DA' : '❌ NE');
            if (check.error) console.log('   Error:', check.error);
            if (check.title) console.log('   Title:', check.title.substring(0, 60));
            if (check.meta) console.log('   Meta:', check.meta.substring(0, 60));
          });
        }
        
        process.exit(0);
      } catch (e) {
        console.log('❌ Parse error:', e.message);
        console.log('Raw:', data);
        process.exit(1);
      }
    });
  });

  req.on('error', (e) => {
    console.log('❌ Connection error:', e.message);
    console.log('\n⚠️  Server možda nije pokrenut? Pokreni: npm start');
    process.exit(1);
  });

  req.setTimeout(30000, () => {
    console.log('❌ Timeout nakon 30 sekundi');
    req.destroy();
    process.exit(1);
  });

  req.end();
}

// Sačekaj malo pa testiraj
setTimeout(testSelfCheck, 1000);
