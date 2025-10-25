import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY missing' }, { status: 400 });
    }

    const mod: any = await import('@google/generative-ai').catch(() => null);
    if (!mod || !mod.GoogleGenerativeAI) {
      return NextResponse.json({ error: 'Gemini SDK not installed' }, { status: 500 });
    }

    const client = new mod.GoogleGenerativeAI(apiKey);
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
    
    const prompt = `Ti si SEO asistent za srpski jezik (latinica). Na osnovu ulaza generiši striktno JSON sa sledećim poljima:
{
  "title": "SEO naslov (≤ 60 karaktera)",
  "meta": "Meta opis (150–160 karaktera)",
  "keywords": ["ključna1", "ključna2", "ključna3"],
  "slug": "seo-slug"
}

Ulaz:
- Primarna ključna reč: test sadržaj
- Tema: AI testiranje
- Intent: informational

Vrati SAMO JSON, bez objašnjenja.`;

    console.log('📤 Slanje prompt-a Gemini-ju...');
    
    const genConfig = {
      temperature: 0.4,
      maxOutputTokens: 1000,
      responseMimeType: 'application/json'
    };

    const geminiModel = client.getGenerativeModel({ model, generationConfig: genConfig });
    const result = await geminiModel.generateContent(prompt);

    console.log('📥 Gemini odgovor primljen!');
    console.log('Result type:', typeof result);
    console.log('Has response:', !!result?.response);
    
    const responseObj = result?.response;
    console.log('Response type:', typeof responseObj);
    console.log('Response keys:', Object.keys(responseObj || {}));
    
    // Pokušaj da dobijem tekst na sve načine
    let text1 = null, text2 = null, text3 = null;
    
    try {
      if (typeof responseObj?.text === 'function') {
        text1 = responseObj.text();
        console.log('✅ response.text() radi, length:', text1?.length);
      }
    } catch (e: any) {
      console.log('❌ response.text() greška:', e.message);
    }

    try {
      if (typeof responseObj?.text === 'string') {
        text2 = responseObj.text;
        console.log('✅ response.text property radi, length:', text2?.length);
      }
    } catch (e: any) {
      console.log('❌ response.text property greška:', e.message);
    }

    try {
      const candidates = responseObj?.candidates;
      if (Array.isArray(candidates) && candidates[0]) {
        const content = candidates[0].content;
        const parts = content?.parts;
        console.log('Candidates:', candidates.length);
        console.log('Parts:', parts);
        console.log('Finish reason:', candidates[0].finishReason);
      }
    } catch (e: any) {
      console.log('❌ candidates greška:', e.message);
    }

    // Takođe probaj direktan stringify
    let fullResult: string;
    try {
      fullResult = JSON.stringify(result, null, 2);
    } catch {
      fullResult = String(result);
    }

    return NextResponse.json({
      success: true,
      model,
      text1_length: text1?.length || 0,
      text2_length: text2?.length || 0,
      text1_sample: text1?.substring(0, 200) || 'EMPTY',
      text2_sample: text2?.substring(0, 200) || 'EMPTY',
      fullResult: fullResult.substring(0, 2000),
      parsed: text1 ? (function() {
        try { return JSON.parse(text1); } catch { return null; }
      })() : null
    });

  } catch (e: any) {
    console.error('❌ GREŠKA:', e);
    return NextResponse.json({
      error: e?.message || 'Unknown error',
      stack: e?.stack?.substring(0, 500)
    }, { status: 500 });
  }
}
