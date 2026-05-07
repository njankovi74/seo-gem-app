import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateCmsRequest, corsHeaders, cmsErrorResponse } from '@/lib/cms-auth';
import { getSimilarTitleExamples, analyzePattern, type TitleOption } from '@/lib/title-history';
import { TFIDFAnalyzer } from '@/lib/tfidf-analyzer';
import { LSAAnalyzer } from '@/lib/lsa-analyzer';
import { prioritizeKeywords } from '@/lib/keyword-prioritizer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  // Authenticate
  const auth = authenticateCmsRequest(request);
  if (!auth.valid) {
    return cmsErrorResponse(auth.error || 'Unauthorized', 401, origin);
  }

  try {
    const body = await request.json();
    const { title, body: articleBody, lead } = body;

    if (!articleBody || articleBody.trim().length < 100) {
      return cmsErrorResponse('Tekst članka mora imati najmanje 100 karaktera.', 400, origin);
    }

    const text = (lead ? lead + '\n\n' : '') + articleBody;
    const effectiveTitle = title || '';
    const fullText = effectiveTitle ? `${effectiveTitle}. ${text}` : text;

    console.log(`🏢 [CMS/titles] Portal: ${auth.portalId}, title: "${effectiveTitle.substring(0, 50)}...", text: ${text.length} chars`);

    // Run TF-IDF + LSA analysis (same as analyze-text route)
    const tfidfAnalyzer = new TFIDFAnalyzer();
    const lsaAnalyzer = new LSAAnalyzer();

    const tfidfAnalysis = tfidfAnalyzer.analyze(fullText);
    const lsaAnalysis = lsaAnalyzer.analyzeSemantics(fullText);
    const searchIntent = lsaAnalyzer.classifySearchIntent(fullText, tfidfAnalysis.semanticCore);

    let mainTopics = lsaAnalysis.topicClusters.map((c: any) => c.name);
    if (mainTopics.length === 0 && tfidfAnalysis.semanticCore.length > 0) {
      mainTopics = tfidfAnalysis.semanticCore.slice(0, 5).map((t: any) => t.word).filter((w: string) => w.length > 3);
    }

    // Prioritize keywords
    const prioritized = prioritizeKeywords(text, tfidfAnalysis, lsaAnalysis, searchIntent);
    const primaryKW = prioritized[0]?.term || '';
    const secondaryKWs = prioritized.slice(1, 6).map(p => p.term);

    // Get RAG examples
    const similarExamples = await getSimilarTitleExamples(text, 3);
    const preferredPattern = analyzePattern(similarExamples);

    // Build few-shot examples
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

    // Title generation prompt (same as generate-title-options)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const prompt = `Ti si Senior Urednik nacionalnog informativnog portala i ekspert za SEO i GEO (Generative Engine Optimization) na srpskom tržištu. Tvoj zadatak je da generišeš tačno 6 opcija SEO naslova za priloženi tekst.
${fewShotExamples}
${similarExamples.length > 0 ? `
**‼️ KRITIČNO: ANALIZIRAJ GORNJE PRIMERE**
Novinar je ranije birao naslove za slične članke. ${preferredPattern}
**TVOJ ZADATAK:** Generiši naslove koji PRATE OVAJ ISTI PATTERN koji novinar preferira!
` : ''}

**KORAK 1: INTERNA ANALIZA (Chain-of-Thought)**
PRE generisanja naslova, obavezno sprovedi sledeću analizu teksta:

1. **Analiza formata i uloga (Subjekat vs. Izvor):** Da li je ovo opšta vest (gde stručnjaci samo komentarišu pojavu) ili je direktan intervju/ekskluzivna izjava? Ko je/šta je stvarna TEMA (Subjekat), a ko je samo STRUČNI IZVOR?

2. **Pravilo eliminacije imena:** Ako osoba u tekstu samo daje stručno mišljenje i pojašnjava temu, ona je ISKLJUČIVO IZVOR. Njeno ime NE SME biti u klasičnim SEO i GEO naslovima. Ime može ići isključivo u E-E-A-T (Discover) naslove.

3. **Definisanje namere:** Šta korisnik zaista ukucava u pretraživač kada ga zanima glavni Subjekat ovog teksta?

**KORAK 2: GENERISANJE 6 NASLOVA**
Na osnovu gornje analize, generiši po 2 unikatne varijacije za sledeća tri stila:

**Opcija 1 i 2 (Stil: informativni):** Klasični SEO naslovi. Fokus na glavnom problemu (Subjekat). ZABRANJENA imena sagovornika.
**Opcija 3 i 4 (Stil: geo_pitanje):** Konverzacijska pitanja za AI Overviews i glasovnu pretragu. ZABRANJENA imena.
**Opcija 5 i 6 (Stil: discover_hook):** E-E-A-T naslovi za Google Discover. OBAVEZNO Ime i Prezime najistaknutijeg sagovornika + udarna tvrdnja.

**PRAVILA:**
- ❌ SVI naslovi MORAJU biti kraći od 70 karaktera!
- ❌ ZABRANJENE clickbait reči (šokantno, neverovatno, haos)
- ✅ Puno ime + prezime u discover_hook naslovima
- ✅ Završena rečenica

**KONTEKST:**
- Primarna ključna reč: ${primaryKW}
- Sekundarne: ${secondaryKWs.join(', ')}
- Teme: ${mainTopics.join(', ')}
- Search intent: ${searchIntent.type}

**TEKST:**
${text.substring(0, 6000)}

**FORMAT: Vrati isključivo validan JSON:**
{
  "titles": [
    { "text": "...", "style": "informativni", "length": 56, "reasoning": "CoT: ..." },
    { "text": "...", "style": "informativni", "length": 58, "reasoning": "..." },
    { "text": "...", "style": "geo_pitanje", "length": 52, "reasoning": "..." },
    { "text": "...", "style": "geo_pitanje", "length": 54, "reasoning": "..." },
    { "text": "...", "style": "discover_hook", "length": 60, "reasoning": "..." },
    { "text": "...", "style": "discover_hook", "length": 62, "reasoning": "..." }
  ]
}`;

    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      generationConfig: { temperature: 0.6 },
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON
    const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanedText);
    const titles: TitleOption[] = parsed.titles;

    if (!Array.isArray(titles) || titles.length < 3) {
      throw new Error(`Expected 6 titles, got ${titles?.length || 0}`);
    }

    // Fix lengths
    titles.forEach(t => { t.length = t.text.length; });

    console.log(`✅ [CMS/titles] Generated ${titles.length} titles for ${auth.portalId}`);

    return NextResponse.json({
      success: true,
      titles,
      usedRAG: similarExamples.length > 0,
    }, { headers });

  } catch (error) {
    console.error('❌ [CMS/titles] Error:', error);
    return cmsErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500, origin
    );
  }
}
