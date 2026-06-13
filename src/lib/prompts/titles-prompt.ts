import { getLanguageConfig, type SupportedLanguage } from '../i18n';

/**
 * Returns the full LLM prompt for generating 6 SEO title options,
 * written entirely in the target language for native-quality output.
 */
export function getTitlesPrompt(
  language: SupportedLanguage,
  params: {
    primaryKW: string;
    secondaryKWs: string[];
    mainTopics: string[];
    searchIntentType: string;
    text: string;
    fewShotExamples?: string;
    preferredPattern?: string;
    googleSuggestions?: string[];
    styleAnalysis?: string;
  }
): string {
  const { primaryKW, secondaryKWs, mainTopics, searchIntentType, text, fewShotExamples, preferredPattern, googleSuggestions, styleAnalysis } = params;

  const ragBlock = fewShotExamples
    ? `${fewShotExamples}\n${preferredPattern ? `**PATTERN:** ${preferredPattern}\n` : ''}`
    : '';

  const ragInstruction = fewShotExamples
    ? getRAGInstruction(language, preferredPattern || '')
    : '';

  const suggestBlock = googleSuggestions && googleSuggestions.length > 0
    ? getSuggestBlock(language, googleSuggestions)
    : '';

  const styleBlock = styleAnalysis ? `\n${styleAnalysis}\n` : '';

  const basePrompt = getBasePrompt(language);
  const formatBlock = getFormatBlock(language);

  return `${basePrompt}
${ragBlock}
${ragInstruction}
${suggestBlock}
${styleBlock}
${getAnalysisStep(language)}

${getGenerationStep(language)}

${getRules(language)}

**${getContextLabel(language)}:**
- ${getPrimaryKWLabel(language)}: ${primaryKW}
- ${getSecondaryLabel(language)}: ${secondaryKWs.join(', ')}
- ${getTopicsLabel(language)}: ${mainTopics.join(', ')}
- Search intent: ${searchIntentType}

**${getTextLabel(language)}:**
${text.substring(0, 6000)}

${formatBlock}`;
}

// ── Per-language prompt components ──

function getBasePrompt(lang: SupportedLanguage): string {
  switch (lang) {
    case 'en':
      return `You are a Senior Editor at a major international news portal and an expert in SEO and GEO (Generative Engine Optimization) for the English-speaking market. Your task is to generate exactly 6 SEO title options for the provided text.

**CRITICAL LANGUAGE RULE:** All titles MUST be written in flawless, native-level American English. The grammar, syntax, and word choice must be indistinguishable from a native English-speaking journalist.`;

    case 'pl':
      return `Jesteś starszym redaktorem ogólnopolskiego portalu informacyjnego i ekspertem SEO oraz GEO (Generative Engine Optimization) na rynku polskim. Twoim zadaniem jest wygenerowanie dokładnie 6 opcji tytułów SEO dla dostarczonego tekstu.

**KRYTYCZNA ZASADA JĘZYKOWA:** Wszystkie tytuły MUSZĄ być napisane w bezbłędnym, natywnym języku polskim. Gramatyka, składnia, odmiana wyrazów (przypadki, rodzaje, liczby) i interpunkcja muszą być perfekcyjne. Użyj prawidłowych polskich znaków diakrytycznych (ą, ć, ę, ł, ń, ó, ś, ź, ż). Tekst musi brzmieć tak, jakby napisał go doświadczony polski dziennikarz.`;

    case 'sq':
      return `Ju jeni Redaktor i Lartë në një portal të madh informativ kombëtar dhe ekspert i SEO dhe GEO (Generative Engine Optimization) për tregun shqiptar. Detyra juaj është të gjeneroni saktësisht 6 opsione titujsh SEO për tekstin e dhënë.

**RREGULL KRITIK GJUHËSOR:** Të gjithë titujt DUHET të jenë shkruar në shqip të pastër dhe të saktë gramatikisht. Gramatika, sintaksa, përdorimi i nyjës shquese (i/e/të/së) dhe drejtshkrimi duhet të jenë të përsosura. Përdorni saktë shkronjat ç dhe ë. Teksti duhet të tingëllojë sikur ta ketë shkruar një gazetar profesionist shqiptar.`;

    default: // sr
      return `Ti si Senior Urednik nacionalnog informativnog portala i ekspert za SEO i GEO (Generative Engine Optimization) na srpskom tržištu. Tvoj zadatak je da generišeš tačno 6 opcija SEO naslova za priloženi tekst.`;
  }
}

function getAnalysisStep(lang: SupportedLanguage): string {
  switch (lang) {
    case 'en':
      return `**STEP 1: INTERNAL ANALYSIS (Chain-of-Thought)**
Before generating titles, conduct the following analysis:

1. **Format and Role Analysis (Subject vs. Source):** Is this general news (where experts merely comment) or a direct interview/exclusive statement? Who/what is the actual TOPIC (Subject), and who is merely an EXPERT SOURCE?

2. **Name Elimination Rule:** If a person only provides expert commentary, they are EXCLUSIVELY a SOURCE. Their name MUST NOT appear in standard SEO/GEO titles. Names may only appear in E-E-A-T (Discover) titles.

3. **Intent Definition:** What does the user actually type into Google when interested in the main Subject of this text?`;

    case 'pl':
      return `**KROK 1: ANALIZA WEWNĘTRZNA (Chain-of-Thought)**
Przed wygenerowaniem tytułów przeprowadź następującą analizę:

1. **Analiza formatu i roli (Podmiot vs. Źródło):** Czy to jest ogólna wiadomość (eksperci jedynie komentują) czy bezpośredni wywiad/ekskluzywne oświadczenie? Kto/co jest rzeczywistym TEMATEM (Podmiotem), a kto jest jedynie ŹRÓDŁEM eksperckim?

2. **Zasada eliminacji nazwisk:** Jeśli osoba jedynie wydaje ekspercką opinię, jest WYŁĄCZNIE ŹRÓDŁEM. Jej nazwisko NIE MOŻE pojawić się w klasycznych tytułach SEO/GEO. Nazwiska mogą pojawić się wyłącznie w tytułach E-E-A-T (Discover).

3. **Określenie intencji:** Co użytkownik faktycznie wpisuje w wyszukiwarkę Google, gdy interesuje go główny Podmiot tego tekstu?`;

    case 'sq':
      return `**HAPI 1: ANALIZA E BRENDSHME (Chain-of-Thought)**
Para se të gjeneroni titujt, kryeni analizën e mëposhtme:

1. **Analiza e formatit dhe rolit (Subjekti vs. Burimi):** A është kjo lajm i përgjithshëm (ku ekspertët vetëm komentojnë) apo intervistë e drejtpërdrejtë/deklaratë ekskluzive? Kush/çfarë është TEMA e vërtetë (Subjekti) dhe kush është thjesht BURIM EKSPERT?

2. **Rregulli i eliminimit të emrave:** Nëse një person vetëm jep mendim ekspert, ai/ajo është EKSKLUZIVISHT BURIM. Emri i tij/saj NUK DUHET të shfaqet në titujt standard SEO/GEO. Emrat mund të shfaqen vetëm në titujt E-E-A-T (Discover).

3. **Përcaktimi i qëllimit:** Çfarë shkruan përdoruesi në Google kur interesohet për Subjektin kryesor të këtij teksti?`;

    default: // sr
      return `**KORAK 1: INTERNA ANALIZA (Chain-of-Thought)**
PRE generisanja naslova, obavezno sprovedi sledeću analizu teksta:

1. **Analiza formata i uloga (Subjekat vs. Izvor):** Da li je ovo opšta vest (gde stručnjaci samo komentarišu pojavu) ili je direktan intervju/ekskluzivna izjava? Ko je/šta je stvarna TEMA (Subjekat), a ko je samo STRUČNI IZVOR?

2. **Pravilo eliminacije imena:** Ako osoba u tekstu samo daje stručno mišljenje i pojašnjava temu, ona je ISKLJUČIVO IZVOR. Njeno ime NE SME biti u klasičnim SEO i GEO naslovima. Ime može ići isključivo u E-E-A-T (Discover) naslove.

3. **Definisanje namere:** Šta korisnik zaista ukucava u pretraživač kada ga zanima glavni Subjekat ovog teksta?`;
  }
}

function getGenerationStep(lang: SupportedLanguage): string {
  switch (lang) {
    case 'en':
      return `**STEP 2: GENERATE 6 TITLES**
Based on the analysis above, generate 2 unique variations for each of the following 3 styles:

**Options 1 & 2 (Style: informativni):** Classic SEO titles. Focus on the main problem (Subject). Names of commentators FORBIDDEN. Titles MUST be fluid, natural sentences — NO colon (:) format. Write them as a journalist would write a compelling headline, not as "Label: explanation".
**Options 3 & 4 (Style: geo_pitanje):** Conversational questions for AI Overviews and voice search. Names FORBIDDEN.
**Options 5 & 6 (Style: discover_hook):** E-E-A-T titles for Google Discover.

⚠️ COLON LIMIT: Out of all 6 titles, MAXIMUM 1 may use the colon (:) format "X: Y". The remaining 5 MUST be fluid, natural sentences or questions. Variety of structures is CRITICAL.

DISCOVER HOOK FORMAT RULE:
A) If the text features a PUBLICLY KNOWN figure (politician, athlete, celebrity, minister, president, CEO of a major company) → Format: "Full Name: bold claim" (this counts as the 1 allowed colon title)
B) If the text features an expert/blogger/doctor who is NOT publicly known to the portal's audience → Format: Fluid, engaging sentence about the benefit. Example: "The Kitchen Hack That Eliminates Grease Without Any Chemicals"
⚠️ NEVER use the name of a person who only provides everyday advice (cleaning, cooking, health, fitness) unless they are a PUBLIC FIGURE known to readers.`;

    case 'pl':
      return `**KROK 2: WYGENERUJ 6 TYTUŁÓW**
Na podstawie powyższej analizy wygeneruj po 2 unikalne warianty dla każdego z 3 następujących stylów:

**Opcje 1 i 2 (Styl: informativni):** Klasyczne tytuły SEO. Skupienie na głównym problemie (Podmiocie). Nazwiska komentatorów ZABRONIONE. Tytuły MUSZĄ być płynne, naturalne zdania — BEZ formatu z dwukropkiem (:). Pisz jak doświadczony dziennikarz pisze angażujący nagłówek, a nie jak "Etykieta: wyjaśnienie".
**Opcje 3 i 4 (Styl: geo_pitanje):** Konwersacyjne pytania dla AI Overviews i wyszukiwania głosowego. Nazwiska ZABRONIONE.
**Opcje 5 i 6 (Styl: discover_hook):** Tytuły E-E-A-T dla Google Discover.

⚠️ LIMIT DWUKROPKÓW: Ze wszystkich 6 tytułów, MAKSYMALNIE 1 może używać formatu z dwukropkiem (:) "X: Y". Pozostałe 5 MUSZĄ być płynnymi, naturalnymi zdaniami lub pytaniami. Różnorodność struktur jest KLUCZOWA.

ZASADA FORMATU DISCOVER HOOK:
A) Jeśli w tekście występuje PUBLICZNIE ZNANA osoba (polityk, sportowiec, celebryta, minister, prezes dużej firmy) → Format: "Imię Nazwisko: odważne stwierdzenie" (to liczy się jako 1 dozwolony tytuł z dwukropkiem)
B) Jeśli w tekście występuje ekspert/bloger/lekarz, który NIE jest publicznie znany czytelnikom portalu → Format: Płynne, angażujące zdanie o korzyści. Przykład: "Trik na kuchnię bez tłuszczu, który działa bez żadnej chemii"
⚠️ NIGDY nie używaj nazwiska osoby, która jedynie udziela codziennych porad (sprzątanie, gotowanie, zdrowie, fitness), chyba że jest OSOBĄ PUBLICZNĄ znaną czytelnikom.`;

    case 'sq':
      return `**HAPI 2: GJENERO 6 TITUJ**
Bazuar në analizën e mësipërme, gjenero 2 variacione unike për secilin nga 3 stilet e mëposhtme:

**Opsionet 1 dhe 2 (Stili: informativni):** Tituj klasikë SEO. Fokusi te problemi kryesor (Subjekti). Emrat e komentuesve TË NDALUARA. Titujt DUHET të jenë fjali të rrjedhshme dhe natyrale — PA formatin me dy pika (:). Shkruani si një gazetar profesionist që shkruan një titull tërheqës, jo si "Etiketë: shpjegim".
**Opsionet 3 dhe 4 (Stili: geo_pitanje):** Pyetje konverzacionale për AI Overviews dhe kërkimin me zë. Emrat TË NDALUARA.
**Opsionet 5 dhe 6 (Stili: discover_hook):** Tituj E-E-A-T për Google Discover.

⚠️ LIMITI I DY PIKAVE: Nga të gjithë 6 titujt, MAKSIMUMI 1 mund të përdorë formatin me dy pika (:) "X: Y". 5 të tjerët DUHET të jenë fjali të rrjedhshme, natyrale ose pyetje. Shumëllojshmëria e strukturave është THELBËSORE.

RREGULLI I FORMATIT DISCOVER HOOK:
A) Nëse në tekst paraqitet një FIGURË PUBLIKE e njohur (politikan, sportist, personazh i njohur, ministër, president, drejtor i kompanisë së madhe) → Formati: "Emri i plotë: deklaratë e guximshme" (kjo llogaritet si 1 titulli i lejuar me dy pika)
B) Nëse në tekst paraqitet një ekspert/bloger/mjek që NUK është i njohur publikisht për lexuesit e portalit → Formati: Fjali e rrjedhshme dhe tërheqëse për përfitimin. Shembull: "Truku i kuzhinës pa yndyrë që funksionon pa asnjë kimik"
⚠️ ASNJËHERË mos përdorni emrin e një personi që vetëm jep këshilla të përditshme (pastrim, gatim, shëndet, fitnes) përveç nëse është FIGURË PUBLIKE e njohur për lexuesit.`;

    default: // sr
      return `**KORAK 2: GENERISANJE 6 NASLOVA**
Na osnovu gornje analize, generiši po 2 unikatne varijacije za sledeća tri stila:

**Opcija 1 i 2 (Stil: informativni):** Klasični SEO naslovi. Fokus na glavnom problemu (Subjekat). ZABRANJENA imena sagovornika. Naslovi MORAJU biti fluidne, prirodne rečenice — BEZ dvotačke (:). Piši kao što iskusan novinar piše privlačan naslov, ne kao "Etiketa: objašnjenje".
**Opcija 3 i 4 (Stil: geo_pitanje):** Konverzacijska pitanja za AI Overviews i glasovnu pretragu. ZABRANJENA imena.
**Opcija 5 i 6 (Stil: discover_hook):** E-E-A-T naslovi za Google Discover.

⚠️ LIMIT DVOTAČKE: Od svih 6 naslova, MAKSIMALNO 1 sme da koristi format sa dvotačkom (:) "X: Y". Preostalih 5 MORAJU biti fluidne, prirodne rečenice ili pitanja. Raznovrsnost struktura je KLJUČNA.

PRAVILO ZA FORMAT DISCOVER HOOK:
A) Ako je u tekstu JAVNO POZNATA ličnost (političar, sportista, celebrity, ministar, predsednik, direktor poznate kompanije) → Format: "Ime Prezime: udarna tvrdnja" (ovo se računa kao 1 dozvoljeni naslov sa dvotačkom)
B) Ako je u tekstu stručnjak/bloger/lekar koji NIJE javno poznat čitaocima portala → Format: Fluidna, privlačna rečenica o benefitu. Primer: "Trik za kuhinju bez masnoće koji funkcioniše bez hemije"
⚠️ NIKADA ne koristi ime osobe koja samo daje savete za svakodnevne teme (čišćenje, kuvanje, zdravlje, fitness) osim ako nije JAVNO POZNATA LIČNOST čitaocima portala.`;
  }
}

function getRules(lang: SupportedLanguage): string {
  switch (lang) {
    case 'en':
      return `**RULES:**
- ❌ ALL titles MUST be shorter than 70 characters!
- ❌ FORBIDDEN clickbait words (shocking, unbelievable, mind-blowing)
- ❌ MAXIMUM 1 title out of 6 may use the colon (:) format! The rest must be fluid sentences or questions.
- ✅ Full first and last name in discover_hook titles
- ✅ Complete sentence
- ✅ Use American English spelling and AP Stylebook conventions`;

    case 'pl':
      return `**ZASADY:**
- ❌ WSZYSTKIE tytuły MUSZĄ być krótsze niż 70 znaków!
- ❌ ZABRONIONE słowa clickbaitowe (szokujące, niewiarygodne, sensacja)
- ❌ MAKSYMALNIE 1 tytuł z 6 może używać formatu z dwukropkiem (:)! Reszta musi być płynnymi zdaniami lub pytaniami.
- ✅ Pełne imię i nazwisko w tytułach discover_hook
- ✅ Zakończone zdanie
- ✅ Prawidłowe polskie znaki diakrytyczne (ą, ć, ę, ł, ń, ó, ś, ź, ż)
- ✅ Poprawna odmiana przypadków i gramatyka polska`;

    case 'sq':
      return `**RREGULLAT:**
- ❌ TË GJITHË titujt DUHET të jenë më të shkurtër se 70 karaktere!
- ❌ TË NDALUARA fjalë clickbait (tronditëse, e pabesueshme, sensacion)
- ❌ MAKSIMUMI 1 titull nga 6 mund të përdorë formatin me dy pika (:)! Të tjerët duhet të jenë fjali të rrjedhshme ose pyetje.
- ✅ Emri dhe mbiemri i plotë në titujt discover_hook
- ✅ Fjali e plotë e përfunduar
- ✅ Përdorimi i saktë i shkronjave ç dhe ë
- ✅ Gramatikë e saktë shqipe me nyje shquese të sakta`;

    default: // sr
      return `**PRAVILA:**
- ❌ SVI naslovi MORAJU biti kraći od 70 karaktera!
- ❌ ZABRANJENE clickbait reči (šokantno, neverovatno, haos)
- ❌ MAKSIMALNO 1 naslov od 6 sme koristiti dvotačku (:)! Ostali moraju biti fluidne rečenice ili pitanja.
- ✅ Puno ime + prezime u discover_hook naslovima
- ✅ Završena rečenica`;
  }
}

function getRAGInstruction(lang: SupportedLanguage, pattern: string): string {
  switch (lang) {
    case 'en':
      return `\n**‼️ CRITICAL: ANALYZE THE EXAMPLES ABOVE**
The journalist has previously chosen titles for similar articles. ${pattern}
**YOUR TASK:** Follow the journalist's preferred TONE and TOPIC focus, but DO NOT copy structural patterns like colons (:). Generate fluid, diverse title structures!\n`;
    case 'pl':
      return `\n**‼️ KRYTYCZNE: ANALIZUJ POWYŻSZE PRZYKŁADY**
Dziennikarz wcześniej wybierał tytuły do podobnych artykułów. ${pattern}
**TWOJE ZADANIE:** Podążaj za preferowanym TONEM i FOKUSEM TEMATYCZNYM dziennikarza, ale NIE kopiuj wzorców strukturalnych takich jak dwukropki (:). Generuj płynne, zróżnicowane struktury tytułów!\n`;
    case 'sq':
      return `\n**‼️ KRITIKE: ANALIZONI SHEMBUJT E MËSIPËRM**
Gazetari ka zgjedhur më parë tituj për artikuj të ngjashëm. ${pattern}
**DETYRA JUAJ:** Ndiqni TONIN dhe FOKUSIN TEMATIK të preferuar të gazetarit, por MOS kopjoni modele strukturore si dy pikat (:). Gjeneroni struktura titujsh të rrjedhshme dhe të larmishme!\n`;
    default:
      return `\n**‼️ KRITIČNO: ANALIZIRAJ GORNJE PRIMERE**
Novinar je ranije birao naslove za slične članke. ${pattern}
**TVOJ ZADATAK:** Prati novinarev preferirani TON i TEMATSKI FOKUS, ali NE kopiraj strukturne obrasce poput dvotačke (:). Generiši fluidne, raznovrsne strukture naslova!\n`;
  }
}

function getFormatBlock(lang: SupportedLanguage): string {
  const note = lang === 'en' ? 'Return ONLY valid JSON:' :
    lang === 'pl' ? 'Zwróć WYŁĄCZNIE prawidłowy JSON:' :
      lang === 'sq' ? 'Ktheni VETËM JSON të vlefshëm:' :
        'Vrati isključivo validan JSON:';

  return `**${note}**
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
}

function getContextLabel(lang: SupportedLanguage): string {
  return lang === 'en' ? 'CONTEXT' : lang === 'pl' ? 'KONTEKST' : lang === 'sq' ? 'KONTEKSTI' : 'KONTEKST';
}
function getPrimaryKWLabel(lang: SupportedLanguage): string {
  return lang === 'en' ? 'Primary keyword' : lang === 'pl' ? 'Główne słowo kluczowe' : lang === 'sq' ? 'Fjala kyçe kryesore' : 'Primarna ključna reč';
}
function getSecondaryLabel(lang: SupportedLanguage): string {
  return lang === 'en' ? 'Secondary' : lang === 'pl' ? 'Dodatkowe' : lang === 'sq' ? 'Dytësore' : 'Sekundarne';
}
function getTopicsLabel(lang: SupportedLanguage): string {
  return lang === 'en' ? 'Topics' : lang === 'pl' ? 'Tematy' : lang === 'sq' ? 'Temat' : 'Teme';
}
function getTextLabel(lang: SupportedLanguage): string {
  return lang === 'en' ? 'TEXT' : lang === 'pl' ? 'TEKST' : lang === 'sq' ? 'TEKSTI' : 'TEKST';
}

function getSuggestBlock(lang: SupportedLanguage, suggestions: string[]): string {
  const list = suggestions.map(s => `- ${s}`).join('\n');

  switch (lang) {
    case 'en':
      return `\n**REAL USER SEARCHES (Google Suggest):**
${list}
⚠️ Include at least one of these EXACT phrases in your titles — this is what people ACTUALLY search for!\n`;

    case 'pl':
      return `\n**REALNE WYSZUKIWANIA UŻYTKOWNIKÓW (Google Suggest):**
${list}
⚠️ Uwzględnij co najmniej jedną z tych DOKŁADNYCH fraz w tytułach — to jest to, czego ludzie NAPRAWDĘ szukają!\n`;

    case 'sq':
      return `\n**KËRKIMET REALE TË PËRDORUESVE (Google Suggest):**
${list}
⚠️ Përfshini të paktën një nga këto fraza të SAKTA në tituj — kjo është ajo që njerëzit VËRTET kërkojnë!\n`;

    default: // sr
      return `\n**REALNE PRETRAGE KORISNIKA (Google Suggest):**
${list}
⚠️ Uključi barem jednu od ovih TAČNIH fraza u naslove — ovo je ono što ljudi ZAISTA pretražuju!\n`;
  }
}
