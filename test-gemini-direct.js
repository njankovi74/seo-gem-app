// Direktan test Gemini SDK-a
async function testGeminiDirect() {
  try {
    console.log('🔍 Testiram Gemini SDK direktno...\n');
    
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY; // Load from environment
    
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found in environment');
    }
    
    const client = new GoogleGenerativeAI(apiKey);
    
    // Test 1: Bez JSON mime type
    console.log('Test 1: Normalan tekst odgovor');
    const model1 = client.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: { temperature: 0.4, maxOutputTokens: 100 }
    });
    
    const result1 = await model1.generateContent('Odgovori sa: OK');
    console.log('Result tip:', typeof result1);
    console.log('Result keys:', Object.keys(result1));
    
    // Probaj .text()
    try {
      const text1 = result1.response.text();
      console.log('✅ response.text():', text1);
    } catch (e) {
      console.log('❌ response.text() ne radi:', e.message);
    }
    
    // Pogledaj strukturu
    console.log('\nStruktura response:');
    console.log('response keys:', Object.keys(result1.response));
    console.log('candidates:', result1.response.candidates?.length);
    if (result1.response.candidates?.[0]) {
      console.log('candidate[0] keys:', Object.keys(result1.response.candidates[0]));
      console.log('content keys:', Object.keys(result1.response.candidates[0].content || {}));
      console.log('parts:', result1.response.candidates[0].content?.parts);
    }
    
    // Test 2: Sa JSON mime type
    console.log('\n' + '='.repeat(60));
    console.log('Test 2: JSON response (responseMimeType)');
    const model2 = client.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: { 
        temperature: 0.4, 
        maxOutputTokens: 100,
        responseMimeType: 'application/json'
      }
    });
    
    const result2 = await model2.generateContent('Vrati JSON: {"status":"ok","message":"radi"}');
    console.log('\nResult tip:', typeof result2);
    
    try {
      const text2 = result2.response.text();
      console.log('✅ response.text():', text2);
      console.log('✅ Parsiran JSON:', JSON.parse(text2));
    } catch (e) {
      console.log('❌ response.text() greška:', e.message);
      
      // Pogledaj strukturu
      console.log('\nStruktura sa JSON mime:');
      const cand = result2.response.candidates?.[0];
      if (cand) {
        console.log('parts:', cand.content?.parts);
        const part = cand.content?.parts?.[0];
        if (part) {
          console.log('part keys:', Object.keys(part));
          if (part.inlineData) {
            console.log('inlineData:', part.inlineData);
            try {
              const decoded = Buffer.from(part.inlineData.data, 'base64').toString('utf8');
              console.log('✅ Dekodirano:', decoded);
            } catch (e2) {
              console.log('❌ Dekodiranje failed');
            }
          }
        }
      }
    }
    
    console.log('\n✅ Test završen!');
    
  } catch (error) {
    console.error('❌ Greška:', error.message);
    if (error.status) console.error('Status:', error.status);
    if (error.response) console.error('Response:', error.response);
  }
}

testGeminiDirect();
