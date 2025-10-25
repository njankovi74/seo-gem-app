// Test bez responseMimeType
async function testGeminiWithoutJsonMime() {
  try {
    console.log('🔍 Test 1: BEZ responseMimeType (plain text)...\n');
    
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const apiKey = 'AIzaSyA5KObzEPB51hPyDeviz1NfGeXspTncbdY';
    
    const client = new GoogleGenerativeAI(apiKey);
    
    const prompt = `Ti si SEO asistent za srpski jezik. Generiši JSON objekat sa poljima:
title (max 60 karaktera), meta (max 160 karaktera), keywords (array od 10-12), slug.

Kontekst: test sadržaj, srpski jezik, SEO optimizacija

Odgovori SAMO sa JSON objektom.`;

    const model1 = client.getGenerativeModel({ 
      model: 'gemini-2.5-pro',
      generationConfig: { 
        temperature: 0.4, 
        maxOutputTokens: 500
        // BEZ responseMimeType
      }
    });
    
    const result1 = await model1.generateContent(prompt);
    const text1 = result1.response.text();
    
    console.log('✅ Odgovor (bez mime):');
    console.log(text1);
    console.log('\nDužina:', text1.length);
    
    // Sada test SA responseMimeType ali jednostavniji prompt
    console.log('\n' + '='.repeat(60));
    console.log('🔍 Test 2: SA responseMimeType (application/json)...\n');
    
    const model2 = client.getGenerativeModel({ 
      model: 'gemini-2.5-pro',
      generationConfig: { 
        temperature: 0.4, 
        maxOutputTokens: 500,
        responseMimeType: 'application/json'
      }
    });
    
    const result2 = await model2.generateContent(prompt);
    const text2 = result2.response.text();
    
    console.log('✅ Odgovor (sa mime):');
    console.log(text2);
    console.log('\nDužina:', text2.length);
    
    if (text2.length > 0) {
      const json = JSON.parse(text2);
      console.log('\n📊 Parsiran JSON:');
      console.log(JSON.stringify(json, null, 2));
    } else {
      console.log('\n❌ PRAZAN ODGOVOR SA responseMimeType!');
      console.log('Provera response strukture:');
      console.log('candidates:', result2.response.candidates?.length);
      if (result2.response.candidates?.[0]) {
        const cand = result2.response.candidates[0];
        console.log('finishReason:', cand.finishReason);
        console.log('content:', cand.content);
      }
    }
    
  } catch (error) {
    console.error('❌ Greška:', error.message);
    console.error('Stack:', error.stack);
  }
}

testGeminiWithoutJsonMime();
