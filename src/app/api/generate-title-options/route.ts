import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSimilarTitleExamples, analyzePattern, type TitleOption } from '@/lib/title-history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface GenerateTitlesRequest {
  articleText: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  mainTopics: string[];
  searchIntent: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateTitlesRequest = await request.json();
    const { articleText, primaryKeyword, secondaryKeywords, mainTopics, searchIntent } = body;

    console.log('🎯 Generating 3 title options...');

    // Get similar past examples for RAG (if any exist)
    const similarExamples = await getSimilarTitleExamples(articleText, 3);
    console.log(`✅ Found ${similarExamples.length} similar examples`);
    
    if (similarExamples.length > 0) {
      console.log('📚 RAG ACTIVE - Similar articles:', similarExamples.map(ex => ({
        similarity: ex.similarity,
        selectedTitle: ex.selected_title,
        selectionType: ex.selection_type
      })));
    }
    
    const preferredPattern = analyzePattern(similarExamples);

    // Build few-shot examples from similar articles
    const fewShotExamples = similarExamples.length > 0
      ? `\n\n**PRETHODNI IZBORI NOVINARA (slični članci):**\n\n${similarExamples
          .map(
            (ex, i) => `PRIMER ${i + 1}:
Tekst: "${ex.article_text.substring(0, 150)}..."
Ponuđeni:
  1. ${ex.offered_titles[0]?.text || 'N/A'}
  2. ${ex.offered_titles[1]?.text || 'N/A'}
  3. ${ex.offered_titles[2]?.text || 'N/A'}
✅ ODABRAN: "${ex.selected_title}"
`
          )
          .join('\n')}\n**PATTERN:** Novinar preferira ${preferredPattern}\n`
      : '';

    const prompt = `Ti si SEO asistent za Newsmax Balkans - informativni portal fokusiran na FAKTOGRAFIJU i AUTORITET.

**BRAND VOICE: Informativni, bez clickbaita, bez senzacionalizma**
${fewShotExamples}
Generiši 3 različita SEO naslova za sledeći tekst:

**STIL 1: FAKTOGRAFSKI** (Newsmax standard)
- IME + GLAGOL + ČINJENICA
- Primer: "Marko Petrović podneo ostavku u klubu"
- Fokus: Ko + šta + gde (bez emotivnih reči)
- User intent: "Šta se desilo?" - direktan odgovor

**STIL 2: KONTEKSTUALNI** (malo drama, ali fakti)
- AKCIJA + POSLEDICA ili IME + IZJAVA
- Primer: "Petrović klubu: Odlazim zbog nepravde"
- Fokus: User traži "šta je rekao", "zašto se desilo"
- Dodaje dramatični element uz očuvanje faktografije

**STIL 3: DETALJNI** (long-tail SEO optimized)
- IME + DETALJNA AKCIJA + SPECIFIČAN KONTEKST
- Primer: "Marko Petrović (32), kapiten kluba, podneo ostavku nakon spora"
- Fokus: Maksimalan SEO (godine, pozicija, razlog)
- Idealno za Google rank - kompletna informacija

**OBAVEZNA PRAVILA ZA SVA 3:**
- ✅ Srpska transkripcija imena (Tramp, ne Trump; Matijas Lesor, ne Mathias Lessort)
- ✅ Puno ime + prezime (ne samo prezime!)
- ✅ Pozicija/funkcija kada relevantno (centar, premijer, trener...)
- ✅ Prirodan jezik - NE "se vraća na teren Panatinаikosa" (dečije)
- ✅ Naslov < 75 karaktera (OBAVEZNO!)
- ✅ Završena rečenica (ne prekidati na pola!)

**ZABRANJENO:**
- ❌ Clickbait: "Nećete verovati...", "Šok!", "Neverovatno!"
- ❌ Senzacionalizam: "Skandal!", "Užas u..."
- ❌ Emotivne ocene: "Dirljivo", "Inspirativno", "Tužno"
- ❌ Engleska imena u srpskom tekstu

**PROVERA PRE SLANJA:**
1. Da li svaki naslov ima PUNO IME (ne samo prezime)?
2. Da li je < 75 chars?
3. Da li je srpska transkripcija (Tramp, ne Trump)?
4. Da li je prirodan jezik (ne AI smell)?
5. Da li odgovara na user search intent?

**KONTEKST:**
- Primarna ključna reč: ${primaryKeyword}
- Sekundarne: ${secondaryKeywords.join(', ')}
- Teme: ${mainTopics.join(', ')}
- Search intent: ${searchIntent}

**TEKST (KOMPLETAN ČLANAK):**
${articleText}

**VRATI SAMO JSON (bez markdown):**
{
  "titles": [
    {
      "text": "...",
      "style": "faktografski",
      "length": 56,
      "reasoning": "Zašto je ovaj naslov dobar za Newsmax stil"
    },
    {
      "text": "...",
      "style": "kontekstualni",
      "length": 58,
      "reasoning": "..."
    },
    {
      "text": "...",
      "style": "detaljni",
      "length": 60,
      "reasoning": "..."
    }
  ]
}`;

    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log('📄 Raw Gemini response:', responseText.substring(0, 200));

    // Parse JSON response
    let parsedResponse;
    try {
      // Remove markdown code blocks if present
      const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedResponse = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      console.error('Raw response:', responseText);
      throw new Error('Failed to parse Gemini response as JSON');
    }

    const titles: TitleOption[] = parsedResponse.titles;

    // Validate titles
    if (!Array.isArray(titles) || titles.length !== 3) {
      throw new Error('Expected 3 titles from Gemini');
    }

    // Fix: Recalculate length field to ensure accuracy (LLM sometimes miscounts)
    titles.forEach((title, idx) => {
      title.length = title.text.length; // Overwrite LLM's length with actual character count
      if (!title.text || title.text.length > 75) {
        console.warn(`⚠️ Title ${idx + 1} too long: ${title.text?.length || 0} chars`);
      }
    });

    console.log('✅ Generated 3 titles:', titles.map((t) => `${t.text} (${t.length} chars)`).join(' | '));

    return NextResponse.json({
      success: true,
      titles,
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      usedRAG: similarExamples.length > 0,
      similarCount: similarExamples.length,
    });
  } catch (error) {
    console.error('❌ Error generating titles:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
