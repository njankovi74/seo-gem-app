const http = require('http');

const testText = `Veštačka inteligencija (AI) brzo napreduje u Srbiji. Sve više kompanija ulaže u digitalnu transformaciju i automatizaciju poslovnih procesa. Stručnjaci predviđaju da će AI tehnologije značajno uticati na ekonomiju i zapošljavanje u narednih nekoliko godina. Istraživanja pokazuju da implementacija AI rešenja može povećati produktivnost za 30-40%.`;

const postData = JSON.stringify({
  text: testText,
  title: 'AI napredak u Srbiji'
});

console.log('📤 Šaljem test tekst za SEO analizu...\n');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/analyze-text',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  },
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
      
      if (!json.success) {
        console.log('❌ API greška:', json.error);
        return;
      }
      
      console.log('✅ Analiza uspešna!\n');
      console.log('='.repeat(70));
      
      if (json.data.seoOutputs) {
        console.log('📝 SEO IZLAZ (Gemini generisano):\n');
        console.log('Title:', json.data.seoOutputs.title);
        console.log('Dužina:', json.data.seoOutputs.title.length, 'karaktera');
        console.log('\nMeta:', json.data.seoOutputs.metaDescription);
        console.log('Dužina:', json.data.seoOutputs.metaDescription.length, 'karaktera');
        console.log('\nKljučne reči:', json.data.seoOutputs.keywordsLine);
        console.log('Dužina:', json.data.seoOutputs.keywordsLine.length, 'karaktera');
      } else {
        console.log('⚠️ Nema SEO izlaza');
      }
      
      console.log('\n' + '='.repeat(70));
      console.log('🔍 DIJAGNOSTIKA:\n');
      
      if (json.data.llm) {
        console.log('Provider:', json.data.llm.configuredProvider);
        console.log('Model:', json.data.llm.configuredModel);
        console.log('Strict mode:', json.data.llm.strictModel);
        console.log('LLM korišćen:', json.data.llm.used ? '✅ DA' : '❌ NE');
        console.log('Ima OpenAI ključ:', json.data.llm.hasKeys.openai ? '✅' : '❌');
        console.log('Ima Gemini ključ:', json.data.llm.hasKeys.gemini ? '✅' : '❌');
        
        if (json.data.llm.error) {
          console.log('⚠️ LLM greška:', json.data.llm.error);
        }
      }
      
      console.log('\n' + '='.repeat(70));
      
      if (json.data.llm && json.data.llm.used) {
        console.log('\n🎉 USPEH! Gemini AI generiše SEO sadržaj!');
      } else {
        console.log('\n⚠️ Koristi se deterministički output (fallback)');
      }
      
    } catch (e) {
      console.log('❌ Parse greška:', e.message);
      console.log('Raw response:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.log('❌ Konekcija greška:', e.message);
});

req.write(postData);
req.end();
