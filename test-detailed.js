// Detaljan test Gemini API-ja
const http = require('http');

function testGeminiDetailed() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/llm-test?provider=gemini&model=gemini-2.5-pro',
    method: 'GET'
  };

  console.log('\n🔍 Testiram Gemini detaljno...\n');
  
  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Status kod:', res.statusCode);
      console.log('\nOdgovor:');
      try {
        const json = JSON.parse(data);
        console.log(JSON.stringify(json, null, 2));
        
        if (json.ok) {
          console.log('\n✅ Gemini odgovara!');
          if (json.output) {
            console.log('📝 Output:', json.output);
          } else {
            console.log('⚠️  ALI - nema output polja! To znači da response.text() nije radio.');
          }
        } else {
          console.log('\n❌ Gemini vratio grešku:', json.error);
        }
        
        // Sada testiraj pravi SEO poziv
        testSEOAnalysis();
        
      } catch (e) {
        console.log('Raw:', data);
      }
    });
  });

  req.on('error', (e) => {
    console.log('❌ Greška:', e.message);
  });

  req.end();
}

function testSEOAnalysis() {
  const testText = 'Digitalna transformacija u Srbiji brzo napreduje. Sve više kompanija ulaže u veštačku inteligenciju i automatizaciju poslovnih procesa. AI tehnologija postaje ključni faktor konkurentnosti na tržištu.';
  
  const postData = JSON.stringify({
    text: testText,
    title: 'AI transformacija u Srbiji',
    provider: 'gemini',
    model: 'gemini-2.5-pro'
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/analyze-text',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  console.log('\n' + '='.repeat(60));
  console.log('🔍 Testiram /api/analyze-text sa Gemini...\n');
  
  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      try {
        const json = JSON.parse(data);
        
        if (json.success) {
          console.log('\n✅ Analiza uspešna!\n');
          
          // Proveri da li ima seoOutputs
          if (json.data.seoOutputs) {
            console.log('📊 SEO OUTPUTS:');
            console.log('Title:', json.data.seoOutputs.title);
            console.log('Meta:', json.data.seoOutputs.metaDescription.substring(0, 80) + '...');
            console.log('Keywords:', json.data.seoOutputs.keywordsLine.substring(0, 80) + '...');
            
            // Proveri LLM diagnostiku
            if (json.data.llm) {
              console.log('\n🤖 LLM DIJAGNOSTIKA:');
              console.log('Provider:', json.data.llm.configuredProvider);
              console.log('Model:', json.data.llm.configuredModel);
              console.log('LLM korišćen:', json.data.llm.used ? '✅ DA' : '❌ NE (determinističko)');
              if (json.data.llm.error) {
                console.log('❌ LLM greška:', json.data.llm.error);
              }
            }
          } else {
            console.log('⚠️  Nema seoOutputs u odgovoru!');
          }
          
          console.log('\n' + '='.repeat(60));
          console.log('✅ Testovi završeni!');
          process.exit(0);
          
        } else {
          console.log('❌ Analiza neuspešna:', json.error);
          process.exit(1);
        }
      } catch (e) {
        console.log('❌ Greška parsiranja:', e.message);
        console.log('Raw response:', data.substring(0, 500));
        process.exit(1);
      }
    });
  });

  req.on('error', (e) => {
    console.log('❌ Greška:', e.message);
    process.exit(1);
  });

  req.write(postData);
  req.end();
}

// Pokreni testove
setTimeout(testGeminiDetailed, 1000);
