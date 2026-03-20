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

    console.log('🎯 Generating 6 title options...');

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
${ex.offered_titles.map((t: any, j: number) => `  ${j + 1}. ${t?.text || 'N/A'}`).join('\n')}
✅ ODABRAN: "${ex.selected_title}"
`
          )
          .join('\n')}\n**PATTERN:** Novinar preferira ${preferredPattern}\n`
      : '';

    const prompt = `Ti si Senior Urednik nacionalnog informativnog portala i ekspert za SEO i GEO (Generative Engine Optimization) na srpskom tržištu. Tvoj zadatak je da generišeš tačno 6 opcija SEO naslova za priloženi tekst.
${fewShotExamples}
${similarExamples.length > 0 ? `
**‼️ KRITIČNO: ANALIZIRAJ GORNJE PRIMERE**
Novinar je ranije birao naslove za slične članke. ${preferredPattern}
**TVOJ ZADATAK:** Generiši naslove koji PRATE OVAJ ISTI PATTERN koji novinar preferira!
` : ''}

**KORAK 1: INTERNA ANALIZA (Chain-of-Thought)**
PRE generisanja naslova, obavezno sprovedi sledeću analizu teksta:

1. **Analiza formata i uloga (Subjekat vs. Izvor):** Da li je ovo opšta vest (gde stručnjaci samo komentarišu pojavu) ili je direktan intervju/ekskluzivna izjava? Ko je/šta je stvarna TEMA (Subjekat), a ko je samo STRUČNI IZVOR (analitičar, predsednik udruženja, stručnjak, itd.)?

2. **Pravilo eliminacije imena:** Ako osoba u tekstu samo daje stručno mišljenje i pojašnjava temu, ona je ISKLJUČIVO IZVOR. Njeno ime NE SME biti u klasičnim SEO i GEO naslovima, bez obzira na to koliko je puta citirana. Ime može ići isključivo u E-E-A-T (Discover) naslove.

3. **Definisanje namere:** Šta korisnik zaista ukucava u pretraživač kada ga zanima glavni Subjekat ovog teksta?

**KORAK 2: GENERISANJE 6 NASLOVA**
Na osnovu gornje analize, generiši po 2 unikatne varijacije za sledeća tri stila:

**Opcija 1 i 2 (Stil: informativni):**
- Klasični, oštri SEO naslovi. Fokus isključivo na glavnom problemu, zakonu ili fenomenu (Subjekat).
- STROGO ZABRANJENA imena sagovornika i eksperata (osim globalnih VIP ličnosti).
- Primer: "Novi Zakon o zaštiti potrošača: Zašto se cene na polici i kasi ne poklapaju?"

**Opcija 3 i 4 (Stil: geo_pitanje):**
- Konverzacijska pitanja usmerena na korisnika, optimizovana za AI Overviews (SGE) i glasovnu pretragu.
- STROGO ZABRANJENA imena sagovornika.
- Primer: "Šta da radite kada vam trgovci na kasi naplate veću cenu od istaknute?"

**Opcija 5 i 6 (Stil: discover_hook):**
- E-E-A-T naslovi idealni za Google Discover i intervjue.
- Fokus na Izvoru i Autoritetu. OBAVEZNO stavi Ime i Prezime najistaknutijeg sagovornika na početak, praćeno njegovom udarnom tvrdnjom/citatom ili poentom.
- Primer: "Dejan Gavrilović: Najveći rizik za kupce nije nov zakon, već njegova primena"

**STROGA PRAVILA ZA IZLAZ:**
- ❌ SVI naslovi MORAJU biti kraći od 65 karaktera (uključujući razmake)!
- ❌ ZABRANJENE su clickbait reči (šokantno, neverovatno, haos). Zadrži objektivan novinarski ton.
- ❌ Engleska imena u srpskom tekstu — koristi srpsku transkripciju kako je u tekstu!
- ✅ Puno ime + prezime (ne samo prezime!) u discover_hook naslovima
- ✅ Završena rečenica (ne prekidati na pola!)

**KONTEKST:**
- Primarna ključna reč: ${primaryKeyword}
- Sekundarne: ${secondaryKeywords.join(', ')}
- Teme: ${mainTopics.join(', ')}
- Search intent: ${searchIntent}

**TEKST (KOMPLETAN ČLANAK):**
${articleText}

**FORMAT IZLAZA: Vrati isključivo validan JSON bez markdown formatiranja:**
{
  "titles": [
    {
      "text": "...",
      "style": "informativni",
      "length": 56,
      "reasoning": "CoT: Subjekat je X, Izvor je Y, fokus na problemu..."
    },
    {
      "text": "...",
      "style": "informativni",
      "length": 58,
      "reasoning": "..."
    },
    {
      "text": "...",
      "style": "geo_pitanje",
      "length": 52,
      "reasoning": "..."
    },
    {
      "text": "...",
      "style": "geo_pitanje",
      "length": 54,
      "reasoning": "..."
    },
    {
      "text": "...",
      "style": "discover_hook",
      "length": 60,
      "reasoning": "..."
    },
    {
      "text": "...",
      "style": "discover_hook",
      "length": 62,
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

    console.log('📄 Raw Gemini response:', responseText.substring(0, 300));

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
    if (!Array.isArray(titles) || titles.length < 3) {
      throw new Error(`Expected 6 titles from Gemini, got ${titles?.length || 0}`);
    }

    // Fix: Recalculate length field to ensure accuracy (LLM sometimes miscounts)
    titles.forEach((title, idx) => {
      title.length = title.text.length; // Overwrite LLM's length with actual character count
      if (!title.text || title.text.length > 65) {
        console.warn(`⚠️ Title ${idx + 1} too long: ${title.text?.length || 0} chars (limit: 65)`);
      }
    });

    console.log('✅ Generated titles:', titles.map((t) => `[${t.style}] ${t.text} (${t.length}ch)`).join(' | '));

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
