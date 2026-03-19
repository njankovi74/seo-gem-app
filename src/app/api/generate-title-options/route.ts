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

    const prompt = `Ti si Senior Urednik nacionalnog informativnog portala i ekspert za SEO i GEO (Generative Engine Optimization) na srpskom tržištu. Tvoj zadatak je da, na osnovu priloženog teksta i RAG primera, generišeš tačno 3 različite opcije SEO naslova.
${fewShotExamples}
${similarExamples.length > 0 ? `
**‼️ KRITIČNO: ANALIZIRAJ GORNJE PRIMERE**
Novinar je ranije birao naslove za slične članke. ${preferredPattern}
**TVOJ ZADATAK:** Generiši naslove koji PRATE OVAJ ISTI PATTERN koji novinar preferira!
Ako novinar bira faktografske naslove - NE GENERIŠI emotivne!
Ako novinar bira detaljne naslove - dodaj kontekst i specifičnosti!
` : ''}

**PRE nego što ispišeš naslove, moraš interno da uradiš sledeću analizu (Chain-of-Thought):**
1. Ekstrahuj glavni entitet ili fenomen iz teksta. OPREZ: Ako je osoba pomenuta u tekstu samo sagovornik, ekspert ili izvor (koji nije opštepoznata javna ličnost), NJENO IME NIJE GLAVNI ENTITET. U tom slučaju, glavni entitet je tema/fenomen o kom se govori (npr. sajber kriminal, zakon, bolest).
2. Definiši nameru pretrage korisnika (Search Intent).
3. Zatim, generiši 3 opcije naslova prema sledećoj strukturi:

**Opcija 1 — Tradicionalni/Informativni naslov:**
- Fokusiran na glavni entitet
- Jasan, direktan, idealan za klasičnu pretragu
- FORMAT: KO + ŠTA + GDE

**Opcija 2 — GEO/Pitanje-Odgovor:**
- Formulisan tako da direktno pogađa konverzacijski upit korisnika (npr. "Kako da...", "Ko je...", "Zašto je...")
- Idealan za AI Overviews i glasovnu pretragu
- Mora zvučati kao prirodno pitanje koje korisnik postavlja

**Opcija 3 — Discover Hook:**
- Naslov koji budi radoznalost za Google Discover feed
- Apsolutno zadržava novinarski integritet
- Privlači klik bez clickbaita — koristi specifičnost i kontekst umesto senzacionalizma

**STROGA PRAVILA (Negative Prompting):**
- ❌ SVI naslovi MORAJU biti kraći od 70 karaktera (uključujući razmake)!
- ❌ STROGO ZABRANJENO je korišćenje clickbait reči: "šokantno", "neverovatno", "nećete verovati", "haos", "skandal", "užas"
- ❌ ZABRANJENO: Ne stavljaj imena sagovornika, eksperata ili analitičara u naslov (npr. "Džim Fuda:", "Marko Marković:"). Imena u naslovu koristi SAMO ako je reč o opštepoznatim javnim ličnostima od nacionalnog ili globalnog značaja (predsednici, poznati sportisti, estradne zvezde). U suprotnom, fokusiraj naslov isključivo na TEMU ili PROBLEM.
- ❌ Zadrži strog, objektivan novinarski ton. Izbegavaj marketinški jezik i AI floskule.
- ❌ Engleska imena u srpskom tekstu — koristi srpsku transkripciju kako je u tekstu!
- ❌ Emotivne ocene: "dirljivo", "inspirativno", "tužno"
- ✅ Puno ime + prezime (ne samo prezime!)
- ✅ Pozicija/funkcija kada relevantno (centar, premijer, trener...)
- ✅ Završena rečenica (ne prekidati na pola!)

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
      "style": "informativni",
      "length": 56,
      "reasoning": "Chain-of-thought: koji entitet, koji intent, zašto ovaj naslov"
    },
    {
      "text": "...",
      "style": "geo_pitanje",
      "length": 58,
      "reasoning": "..."
    },
    {
      "text": "...",
      "style": "discover_hook",
      "length": 60,
      "reasoning": "..."
    }
  ]
}`;

    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      generationConfig: { temperature: 0.6 },
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
      if (!title.text || title.text.length > 70) {
        console.warn(`⚠️ Title ${idx + 1} too long: ${title.text?.length || 0} chars (limit: 70)`);
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
