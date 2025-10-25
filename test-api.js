// Test skripta za proveru API endpointa
const http = require('http');

function testEndpoint(path, callback) {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: path,
    method: 'GET'
  };

  console.log(`\n🔍 Testiram: ${path}`);
  
  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log('✅ Status:', res.statusCode);
        console.log('📦 Odgovor:', JSON.stringify(json, null, 2));
        callback(null, json);
      } catch (e) {
        console.log('❌ Greška parsiranja:', e.message);
        console.log('📄 Raw odgovor:', data);
        callback(e);
      }
    });
  });

  req.on('error', (e) => {
    console.log('❌ Greška konekcije:', e.message);
    callback(e);
  });

  req.setTimeout(5000, () => {
    console.log('❌ Timeout nakon 5 sekundi');
    req.destroy();
    callback(new Error('Timeout'));
  });

  req.end();
}

// Čekaj malo pa testiraj
setTimeout(() => {
  console.log('='.repeat(60));
  console.log('🚀 Pokrećem testove API-ja...');
  console.log('='.repeat(60));
  
  testEndpoint('/api/health', (err, data) => {
    if (!err && data) {
      console.log('\n📊 ANALIZA HEALTH ENDPOINTA:');
      console.log('Provider:', data.env?.provider || 'nije postavljen');
      console.log('OpenAI model:', data.env?.openaiModel || 'nije postavljen');
      console.log('Gemini model:', data.env?.geminiModel || 'nije postavljen');
      console.log('Ima OpenAI ključ:', data.env?.hasKeys?.openai ? '✅ DA' : '❌ NE');
      console.log('Ima Gemini ključ:', data.env?.hasKeys?.gemini ? '✅ DA' : '❌ NE');
      console.log('Strict mode:', data.env?.strict ? 'DA' : 'NE');
      console.log('Required mode:', data.env?.required ? 'DA' : 'NE');
      
      // Sledeći test
      console.log('\n' + '='.repeat(60));
      testEndpoint('/api/llm-test?provider=gemini', (err2, data2) => {
        if (!err2) {
          console.log('\n📊 GEMINI TEST:');
          console.log('Radi:', data2.ok ? '✅ DA' : '❌ NE');
          if (data2.error) console.log('Greška:', data2.error);
          if (data2.output) console.log('Output:', data2.output.substring(0, 100));
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Testovi završeni!');
        process.exit(0);
      });
    } else {
      console.log('\n❌ Ne mogu da dobijem health status. Server možda nije pokrenut?');
      process.exit(1);
    }
  });
}, 2000);
