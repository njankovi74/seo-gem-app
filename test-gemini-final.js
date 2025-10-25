// Direktan Gemini test - FINALNA DIJAGNOZA
require('dotenv').config({ path: '.env.local' });

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('API Key prisutan:', !!apiKey);
  console.log('Model:', process.env.GEMINI_MODEL);

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const client = new GoogleGenerativeAI(apiKey);

  const prompt = `Ti si SEO asistent za srpski jezik (latinica). Generiši JSON:
{
  "title": "Optimizovan SEO naslov (≤ 60 karaktera)",
  "meta": "Detaljan meta opis (150–160 karaktera)",
  "keywords": ["ključna reč 1", "ključna reč 2", "ključna reč 3"]
}

Tema: AI u Srbiji, digitalna transformacija
Intent: informational

Vrati SAMO JSON.`;

  console.log('\n📤 Slanje prompta...\n');

  const model = client.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-pro',
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2000,  // Povećano sa 1000 na 2000
      responseMimeType: 'application/json'
    }
  });

  const result = await model.generateContent(prompt);
  
  console.log('📥 Odgovor primljen!\n');
  console.log('='.repeat(60));
  console.log('STRUKTURA:');
  console.log('- Has response:', !!result?.response);
  console.log('- Has response.text:', typeof result?.response?.text);
  console.log('- Candidates:', result?.response?.candidates?.length);
  console.log('- Finish reason:', result?.response?.candidates?.[0]?.finishReason);
  
  console.log('\n' + '='.repeat(60));
  console.log('TEKST RESPONSE:');
  
  let text = '';
  if (typeof result?.response?.text === 'function') {
    text = result.response.text();
    console.log('response.text():', text);
  } else if (typeof result?.response?.text === 'string') {
    text = result.response.text;
    console.log('response.text (property):', text);
  } else {
    console.log('❌ response.text nije dostupan!');
  }
  
  if (text) {
    console.log('\n' + '='.repeat(60));
    console.log('PARSIRAN JSON:');
    try {
      const json = JSON.parse(text);
      console.log(JSON.stringify(json, null, 2));
      
      console.log('\n' + '='.repeat(60));
      console.log('✅ USPEH! Gemini generiše JSON pravilno!');
      console.log('Title:', json.title);
      console.log('Meta:', json.meta);
      console.log('Keywords:', json.keywords);
    } catch (e) {
      console.log('❌ JSON parse greška:', e.message);
    }
  } else {
    console.log('\n❌ PROBLEM: response.text() vraća prazan string!');
    console.log('Full result:', JSON.stringify(result, null, 2).substring(0, 1000));
  }
}

test().catch(e => {
  console.error('❌ GREŠKA:', e.message);
  console.error(e.stack);
});
