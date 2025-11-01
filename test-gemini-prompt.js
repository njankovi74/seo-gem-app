// Test Gemini LLM poziva sa pravim promptom
async function testGeminiPrompt() {
  try {
    console.log('🔍 Testiram Gemini sa pravim SEO promptom...\n');
    
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not found in environment');
    }
    
    const client = new GoogleGenerativeAI(apiKey);
    
    const primaryKW = 'test sadržaj';
    const secondaryKWs = ['srpski jezik', 'seo generisanje'];
    const bannedTokens = ['kliknite ovde','odmah','besplatno'];
    
    const prompt = `Ti si SEO asistent za srpski jezik (latinica). Na osnovu ulaza generiši striktno JSON sa sledećim poljima:
{
  "title": string,          // ≤ 60 karaktera, uključi primarnu ključnu reč, bez clickbaita, pravilna kapitalizacija, bez navodnika i brenda sajta
  "meta": string,           // 150–160 karaktera, informativan sažetak vrednosti teksta (bez CTA), uključi primarnu i 1 sekundarnu ključnu reč, bez navodnika/emodžija
  "keywords": string[],     // 10–14 komada, 70–90% long‑tail (2–4 reči), mala slova, bez duplikata/stop reči/ličnih imena/brenda, relevantne i precizne
  "slug": string            // kratko, kebab-case, 4–8 reči, samo [a-z0-9-]
}

Pravila:
- Jezik: srpski (latinica). Ton: stručan i koristan, bez senzacionalizma.
- Zabranjene fraze: ${bannedTokens.join(', ')}.
- Meta opis: bez eksplicitnog CTA; fokus na suštinskim informacijama i vrednosti teksta.
- Ključne reči: prednost long‑tail frazama (2–4 reči); uključi varijante primarne fraze sa modifikatorima (lokacija, problem/rešenje, namera), izbegni generike ("autor", "društvo"), bez datuma/vremena.
- Ukupna dužina finalnog stringa sa ključnim rečima (spojenih zarezima i razmacima: ", ") treba biti ≤ 300 karaktera; skrati listu po potrebi.
- Poštuj ograničenja dužine. Ako mora skraćivanje, zadrži smisao i ključne reči.

Ulaz (sažetak):
- Primarna ključna reč: ${primaryKW}
- Sekundarne: ${secondaryKWs.join(', ')}
- Glavne teme: seo test
- Intent: informational
- Naslov dokumenta: Test naslov
- Uzorak teksta: Ovo je kratak test sadržaj za proveru LLM generisanja naslova i meta opisa na srpskom jeziku.

Vrati SAMO JSON, bez objašnjenja i bez code fences.`;

    console.log('📤 PROMPT (prvih 200 karaktera):');
    console.log(prompt.substring(0, 200) + '...\n');
    
    const model = client.getGenerativeModel({ 
      model: 'gemini-2.5-pro',
      generationConfig: { 
        temperature: 0.4, 
        maxOutputTokens: 350,
        responseMimeType: 'application/json'
      }
    });
    
    console.log('⏳ Pozivam Gemini...\n');
    const result = await model.generateContent(prompt);
    
    console.log('📥 ODGOVOR:');
    console.log('Result type:', typeof result);
    console.log('Has response:', !!result.response);
    console.log('Response has text():', typeof result.response.text === 'function');
    
    const text = result.response.text();
    console.log('\n✅ response.text():');
    console.log(text);
    console.log('\n📊 Parsiran JSON:');
    const json = JSON.parse(text);
    console.log(JSON.stringify(json, null, 2));
    
    console.log('\n🎯 REZULTAT:');
    console.log('Title:', json.title);
    console.log('Meta:', json.meta);
    console.log('Keywords (count):', json.keywords?.length);
    console.log('Slug:', json.slug);
    
    // Uporedi sa determinističkim
    const detTitle = 'Test sadržaj: Sve što treba da znate';
    const detMeta = 'Test sadržaj utiče na vašu publiku i rezultate. Saznajte kako se odnosi na srpski jezik i zašto je važno za SEO. Pročitajte kompletnu analizu.';
    
    console.log('\n📊 POREĐENJE SA DETERMINISTIČKIM:');
    console.log('Title isti:', json.title === detTitle);
    console.log('Meta isti:', json.meta === detMeta);
    
    if (json.title !== detTitle) {
      console.log('\n✅ GEMINI GENERIŠE RAZLIČIT NASLOV! LLM RADI!');
    } else {
      console.log('\n❌ GEMINI VRAĆA ISTI NASLOV KAO DETERMINISTIČKO! Možda cache ili problem sa promptom?');
    }
    
  } catch (error) {
    console.error('❌ Greška:', error.message);
    if (error.response) console.error('Response:', JSON.stringify(error.response, null, 2));
  }
}

testGeminiPrompt();
