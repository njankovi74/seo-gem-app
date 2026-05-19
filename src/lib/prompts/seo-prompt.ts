import { getLanguageConfig, type SupportedLanguage } from '../i18n';

/**
 * Returns the full LLM prompt for generating meta description, keywords, 
 * subtopics and schema markup, written entirely in the target language.
 */
export function getSEOPrompt(
  language: SupportedLanguage,
  params: {
    primaryKW: string;
    secondaryKWs: string[];
    mainTopics: string[];
    searchIntentType: string;
    documentTitle?: string;
    textSample?: string;
    articleUrl?: string;
    skipTitleGeneration?: boolean;
    articleMetadata?: {
      authorName?: string;
      publishedTime?: string;
      dateModified?: string;
      imageUrl?: string;
      publisherName?: string;
      publisherLogoUrl?: string;
      articleSection?: string;
    };
  }
): { systemPrompt: string; userPrompt: string } {
  const config = getLanguageConfig(language);
  const { primaryKW, secondaryKWs, mainTopics, searchIntentType, documentTitle, textSample, articleUrl, skipTitleGeneration, articleMetadata } = params;

  const systemPrompt = getSystemPrompt(language);
  const userPrompt = buildUserPrompt(language, config, params);

  return { systemPrompt, userPrompt };
}

function getSystemPrompt(lang: SupportedLanguage): string {
  switch (lang) {
    case 'en':
      return 'You are a Senior Editor at a major international news portal and an expert in SEO and GEO (Generative Engine Optimization) for the English-speaking market.';
    case 'pl':
      return 'Jesteś starszym redaktorem ogólnopolskiego portalu informacyjnego i ekspertem SEO oraz GEO (Generative Engine Optimization) na rynku polskim.';
    case 'sq':
      return 'Ju jeni Redaktor i Lartë në një portal të madh informativ kombëtar dhe ekspert i SEO dhe GEO (Generative Engine Optimization) për tregun shqiptar.';
    default:
      return 'Ti si Senior Urednik nacionalnog informativnog portala i GEO (Generative Engine Optimization) ekspert.';
  }
}

function buildUserPrompt(
  lang: SupportedLanguage,
  config: ReturnType<typeof getLanguageConfig>,
  params: {
    primaryKW: string;
    secondaryKWs: string[];
    mainTopics: string[];
    searchIntentType: string;
    documentTitle?: string;
    textSample?: string;
    articleUrl?: string;
    skipTitleGeneration?: boolean;
    articleMetadata?: {
      authorName?: string;
      publishedTime?: string;
      dateModified?: string;
      imageUrl?: string;
      publisherName?: string;
      publisherLogoUrl?: string;
      articleSection?: string;
    };
  }
): string {
  const { primaryKW, secondaryKWs, mainTopics, searchIntentType, documentTitle, textSample, articleUrl, skipTitleGeneration, articleMetadata } = params;

  // Language-specific banned tokens
  const bannedTokens = config.bannedTokens;

  // JSON schema (same structure for all languages)
  const jsonSchema = skipTitleGeneration
    ? `{
  "meta_description": string,
  "keywords": string[],
  "subtopics": string[],
  "schema_markup": string
}`
    : `{
  "title": string,
  "meta_description": string,
  "keywords": string[],
  "subtopics": string[],
  "schema_markup": string
}`;

  const titleInstruction = getTitleInstruction(lang, skipTitleGeneration || false, documentTitle || '');
  const metaSection = getMetaSection(lang);
  const keywordsSection = getKeywordsSection(lang);
  const subtopicsSection = getSubtopicsSection(lang);
  const schemaSection = getSchemaSection(lang, config.bcp47);
  const syntaxFirewall = getSyntaxFirewall(lang);

  return `${getRolePrompt(lang)} ${getTaskPrompt(lang, jsonSchema)}

${titleInstruction}

${metaSection}

${keywordsSection}

${subtopicsSection}

${schemaSection}

${syntaxFirewall}

**${getKnownVarsLabel(lang)}:**
- image_url: ${articleMetadata?.imageUrl || '(N/A)'}
- published_time: ${articleMetadata?.publishedTime || '(N/A)'}
- date_modified: ${articleMetadata?.dateModified || '(N/A)'}
- author_name: ${articleMetadata?.authorName || '(N/A)'}
- publisher_name: ${articleMetadata?.publisherName || '(N/A)'}
- publisher_logo_url: ${(articleMetadata as any)?.publisherLogoUrl || '(N/A)'}
- article_section: ${articleMetadata?.articleSection || '(N/A)'}
- url_clanka: ${articleUrl || '(N/A)'}

${getInputLabel(lang)}:
- ${getPrimaryLabel(lang)}: ${primaryKW}
- ${getSecondaryLabel(lang)}: ${secondaryKWs.join(', ')}
- ${getTopicsLabel(lang)}: ${mainTopics.join(', ')}
- Intent: ${searchIntentType}
- ${getTitleLabel(lang)}: ${documentTitle || '(N/A)'}
- ${getTextSampleLabel(lang)}: ${(textSample || '').slice(0, 10000)}

${getReturnJSON(lang)}`;
}

// ── Prompt building blocks per language ──

function getRolePrompt(lang: SupportedLanguage): string {
  switch (lang) {
    case 'en': return 'You are a Senior Editor at a major international news portal and a GEO (Generative Engine Optimization) expert.';
    case 'pl': return 'Jesteś starszym redaktorem ogólnopolskiego portalu informacyjnego i ekspertem GEO (Generative Engine Optimization).';
    case 'sq': return 'Ju jeni Redaktor i Lartë në një portal informativ kombëtar dhe ekspert i GEO (Generative Engine Optimization).';
    default: return 'Ti si Senior Urednik nacionalnog informativnog portala i GEO (Generative Engine Optimization) ekspert.';
  }
}

function getTaskPrompt(lang: SupportedLanguage, schema: string): string {
  switch (lang) {
    case 'en': return `Based on the input, generate strictly JSON with the following fields:\n${schema}`;
    case 'pl': return `Na podstawie danych wejściowych wygeneruj ściśle JSON z następującymi polami:\n${schema}`;
    case 'sq': return `Bazuar në të dhënat hyrëse, gjeneroni rreptësisht JSON me fushat e mëposhtme:\n${schema}`;
    default: return `Na osnovu ulaza generiši striktno JSON sa sledećim poljima:\n${schema}`;
  }
}

function getTitleInstruction(lang: SupportedLanguage, skip: boolean, title: string): string {
  if (!skip) {
    switch (lang) {
      case 'en': return '**Generate SEO title:** ≤ 70 characters, include primary keyword, no clickbait, use proper English names as they appear in the text.';
      case 'pl': return '**Wygeneruj tytuł SEO:** ≤ 70 znaków, uwzględnij główne słowo kluczowe, bez clickbaitu, użyj prawidłowej polskiej transkrypcji nazw własnych.';
      case 'sq': return '**Gjenero titullin SEO:** ≤ 70 karaktere, përfshi fjalën kyçe kryesore, pa clickbait, përdor emrat ashtu siç shfaqen në tekst.';
      default: return '**Generiši SEO naslov:** ≤ 70 karaktera, uključi primarnu ključnu reč, bez clickbaita, koristi srpsku transkripciju imena kako je u tekstu.';
    }
  }
  switch (lang) {
    case 'en': return `**TITLE IS ALREADY SET:** ${title}\n**YOUR TASK:** Generate Meta Description (Answer Nugget), Keywords (Long-Tail First hierarchy) and Schema Markup based on this title and text.`;
    case 'pl': return `**TYTUŁ JEST JUŻ USTALONY:** ${title}\n**TWOJE ZADANIE:** Wygeneruj Meta Opis (Answer Nugget), Słowa kluczowe (hierarchia Long-Tail First) i Schema Markup na podstawie tego tytułu i tekstu.`;
    case 'sq': return `**TITULLI ËSHTË VENDOSUR TASHMË:** ${title}\n**DETYRA JUAJ:** Gjeneroni Meta Përshkrimin (Answer Nugget), Fjalët kyçe (hierarkia Long-Tail First) dhe Schema Markup bazuar në këtë titull dhe tekst.`;
    default: return `**NASLOV JE VEĆ ODREĐEN:** ${title}\n**TVOJ ZADATAK:** Generiši Meta opis (Answer Nugget), Keywords (Long-Tail First hijerarhija) i Schema Markup na osnovu ovog naslova i teksta.`;
  }
}

function getMetaSection(lang: SupportedLanguage): string {
  switch (lang) {
    case 'en':
      return `**1. Meta Description (meta_description) — Answer Nugget format:**
- Formulate as a DIRECT, INFORMATIVE ANSWER to the main topic or question.
- Active tone, no hedging. Start IMMEDIATELY with facts.
- STRICT limit: max 160 characters.
- End with a brief, natural CTA, e.g. "Learn more." or "Read the analysis."
- FORBIDDEN: Do NOT start with "This article discusses..." or "Find out how...". Start with facts.
- ALWAYS use FULL FIRST AND LAST NAME on first mention.
- Meta description MUST be a complete sentence.
  * ❌ FORBIDDEN: "...if the obligations are not" (truncated!)
  * ✅ CORRECT: "Serbia qualifies for Eurovision 2025 final after a stunning semifinal performance. Read more."`;

    case 'pl':
      return `**1. Meta Opis (meta_description) — format Answer Nugget:**
- Sformułuj jako BEZPOŚREDNIĄ, INFORMACYJNĄ ODPOWIEDŹ na główne pytanie lub temat artykułu.
- Aktywny ton, bez obchodzenia. Zacznij NATYCHMIAST od faktów.
- ŚCISŁE ograniczenie: maksymalnie 160 znaków.
- Na samym końcu dodaj krótkie, naturalne CTA, np. "Dowiedz się więcej." lub "Przeczytaj analizę."
- ZABRONIONE: NIE zaczynaj opisu od "Ten artykuł opisuje..." lub "Dowiedz się, jak...". Zacznij od faktów.
- ZAWSZE używaj PEŁNEGO IMIENIA I NAZWISKA przy pierwszym wspomnieniu.
- Meta opis MUSI być zakończonym zdaniem z poprawną polską gramatyką.
  * ❌ ZABRONIONE: "...jeśli zobowiązania nie" (ucięte!)
  * ✅ POPRAWNE: "Polska ogranicza import LNG z Kataru i stawia na gaz z USA. Czytaj więcej."`;

    case 'sq':
      return `**1. Meta Përshkrimi (meta_description) — formati Answer Nugget:**
- Formulojeni si PËRGJIGJE TË DREJTPËRDREJTË, INFORMATIVE ndaj temës ose pyetjes kryesore.
- Ton aktiv, pa hezitim. Filloni MENJËHERË me fakte.
- KUFIZIM I RREPTË: maksimalisht 160 karaktere.
- Në fund shtoni një CTA të shkurtër dhe natyrale, p.sh. "Lexoni më shumë." ose "Zbuloni analizën."
- E NDALUAR: MOS filloni me "Ky artikull flet për..." ose "Zbuloni si...". Filloni me fakte.
- GJITHMONË përdorni EMRIN DHE MBIEMRIN E PLOTË në përmendjen e parë.
- Meta përshkrimi DUHET të jetë fjali e plotë e përfunduar.`;

    default:
      return `**1. Meta Opis (meta_description) — Answer Nugget format:**
- Formuliši kao DIREKTAN, INFORMATIVAN ODGOVOR na glavno pitanje ili temu članka.
- Aktivan ton, bez okolišanja. Kreni ODMAH sa činjenicama.
- STROGO ograničenje: maksimalno 160 karaktera.
- Na samom kraju dodaj kratak, prirodan CTA, npr. "Saznajte više." ili "Pročitajte analizu."
- ZABRANJENO: Ne započinji opis frazama poput "Ovaj članak govori o..." ili "Saznajte kako...". Kreni odmah sa činjenicama.
- UVEK koristi PUNO IME I PREZIME na prvom pomenu osobe.
- Meta opis MORA biti završena rečenica.
  * ❌ NEDOZVOLJENO: "...ukoliko se obaveze ne" (presečeno!)
  * ✅ ISPRAVNO: "Milan Janković osvojio zlato na EP u paraatletici. Saznajte više."`;
  }
}

function getKeywordsSection(lang: SupportedLanguage): string {
  switch (lang) {
    case 'en':
      return `**2. Keywords (keywords) — Long-Tail First hierarchy:**
Generate exactly 8-10 keywords/phrases users actually type into Google.

**Level 1: Long-tail phrases (Priority! 3-4 phrases):** 3-6 words, natural user questions (Voice Search style).
**Level 2: Mid-tail phrases (3-4 phrases):** 2-3 words, entity + action/problem.
**Level 3: Core Entities (2 phrases):** 1-2 words for Knowledge Graph mapping.

❌ STRICTLY FORBIDDEN: No semantic permutations of the same phrase. Each phrase must have unique intent. Lowercase, no duplicates.`;

    case 'pl':
      return `**2. Słowa kluczowe (keywords) — hierarchia Long-Tail First:**
Wygeneruj dokładnie 8-10 słów kluczowych/fraz, które użytkownicy NAPRAWDĘ wpisują w wyszukiwarkę Google.pl.

**Poziom 1: Frazy long-tail (Priorytet! 3-4 frazy):** 3-6 słów, naturalne pytania użytkowników (styl Voice Search). Użyj poprawnych polskich form gramatycznych.
**Poziom 2: Frazy mid-tail (3-4 frazy):** 2-3 słowa, podmiot + akcja/problem.
**Poziom 3: Główne encje (2 frazy):** 1-2 słowa do mapowania Knowledge Graph.

❌ ŚCIŚLE ZABRONIONE: Żadnych permutacji semantycznych tej samej frazy. Każda fraza musi mieć unikalną intencję. Małe litery, bez duplikatów. Użyj prawidłowych polskich znaków diakrytycznych.`;

    case 'sq':
      return `**2. Fjalët kyçe (keywords) — hierarkia Long-Tail First:**
Gjeneroni saktësisht 8-10 fjalë/fraza kyçe që përdoruesit VËRTET shkruajnë në Google.

**Niveli 1: Fraza long-tail (Prioritet! 3-4 fraza):** 3-6 fjalë, pyetje natyrale përdoruesish (stili Voice Search).
**Niveli 2: Fraza mid-tail (3-4 fraza):** 2-3 fjalë, subjekti + aksioni/problemi.
**Niveli 3: Entitete kryesore (2 fraza):** 1-2 fjalë për mapimin e Knowledge Graph.

❌ RREPTËSISHT E NDALUAR: Asnjë permutacion semantik i së njëjtës frazë. Çdo frazë duhet të ketë qëllim unik. Shkronja të vogla, pa dublikata.`;

    default:
      return `**2. Ključne reči / Tagovi (keywords) — Long-Tail First hijerarhija:**
Generiši 8 do 10 ključnih reči/fraza koje korisnici ZAISTA ukucavaju u pretraživač.

**Nivo 1: Long-tail fraze (Prioritet! 3-4 fraze):** 3-6 reči, prirodna korisnička pitanja (Voice Search stil).
**Nivo 2: Mid-tail fraze (3-4 fraze):** 2-3 reči, entitet + akcija/problem.
**Nivo 3: Core Entiteti (2 fraze):** 1-2 reči za Knowledge Graph.

❌ STROGO ZABRANJENO: Nema besmislenih SEO permutacija istih reči. Svaka fraza mora biti unikatna po nameri. Mala slova, bez duplikata.`;
  }
}

function getSubtopicsSection(lang: SupportedLanguage): string {
  switch (lang) {
    case 'en':
      return `**3. Subtopics (subtopics):**
Identify 4-6 key thematic aspects the article covers. Each subtopic is a 2-5 word phrase in nominative (e.g. "Import restrictions on LNG", "US gas supply agreement"). Do NOT use single words.`;
    case 'pl':
      return `**3. Podtematy (subtopics):**
Zidentyfikuj 4-6 kluczowych aspektów tematycznych, które artykuł porusza. Każdy podtemat to fraza 2-5 słów w mianowniku (np. "Ograniczenia importu LNG", "Umowa na dostawy gazu z USA"). NIE używaj pojedynczych słów.`;
    case 'sq':
      return `**3. Nëntemat (subtopics):**
Identifikoni 4-6 aspekte tematike kryesore që artikulli mbulon. Çdo nëntemë është një frazë 2-5 fjalëshe në emërore (p.sh. "Bllokimi i merkatos së Tiranës", "Çështjet ndaj ish-lojtarëve"). MOS përdorni fjalë të vetme.`;
    default:
      return `**3. Podteme / Tematski aspekti (subtopics):**
Identifikuj 4-6 ključnih tematskih aspekata koje članak pokriva. Svaka podtema je kratka fraza od 2-5 reči u nominativu. NE koristi pojedinačne reči.`;
  }
}

function getSchemaSection(lang: SupportedLanguage, bcp47: string): string {
  const antiHallucination = {
    en: `
⚠️ ANTI-HALLUCINATION RULES FOR SCHEMA:
- Use ONLY the values provided in "Known variables". NEVER invent dates, URLs, author names, or publisher names.
- If a value is empty or "(N/A)", OMIT that field entirely from the schema. Do NOT use placeholder values like "example.com".
- mainEntityOfPage.@id MUST be the exact url_clanka value (if provided).
- datePublished and dateModified MUST be the exact values from published_time and date_modified.
- publisher.name MUST be the exact publisher_name value.
- author.name MUST be the exact author_name value.
- Do NOT include "Newsmax Balkans" or any publisher name in the "mentions" array.`,
    pl: `
⚠️ ZASADY ANTY-HALUCYNACYJNE DLA SCHEMA:
- Używaj WYŁĄCZNIE wartości podanych w "Znane zmienne". NIGDY nie wymyślaj dat, URL-ów, nazw autorów ani wydawców.
- Jeśli wartość jest pusta lub "(N/A)", POMIŃ to pole w schemacie. NIE używaj wartości zastępczych jak "example.com".
- mainEntityOfPage.@id MUSI być dokładną wartością url_clanka.
- datePublished i dateModified MUSZĄ być dokładnymi wartościami z published_time i date_modified.
- NIE umieszczaj nazwy wydawcy w tablicy "mentions".`,
    sq: `
⚠️ RREGULLA KUNDËR HALUCINIMINIT PËR SCHEMA:
- Përdorni VETËM vlerat e dhëna në "Variablat e njohura". KURRË mos shpikni data, URL, emra autorësh ose botuesish.
- Nëse një vlerë është bosh ose "(N/A)", HIQENI atë fushë nga skema. MOS përdorni vlera zëvendësuese si "example.com".
- mainEntityOfPage.@id DUHET të jetë vlera e saktë e url_clanka.
- NE e vendosni emrin e botuesit në grupin "mentions".`,
    sr: `
⚠️ STROGO ZABRANJENO HALUCINIRANJE U SCHEMA MARKUP-u:
- Koristi ISKLJUČIVO vrednosti date u "Poznate varijable". NIKADA ne izmišljaj datume, URL-ove, imena autora ili publishera.
- Ako je neka vrednost prazna ili "(N/A)", IZOSTAVI to polje iz schema markup-a. NE koristi placeholder vrednosti poput "example.com".
- mainEntityOfPage.@id MORA biti tačna vrednost url_clanka (ako je data).
- datePublished i dateModified MORAJU biti tačne vrednosti iz published_time i date_modified.
- publisher.name MORA biti tačna vrednost publisher_name.
- author.name MORA biti tačna vrednost author_name.
- NE stavljaj ime publishera (npr. "Newsmax Balkans") u "mentions" niz.`,
  };

  const rules = antiHallucination[lang] || antiHallucination.sr;

  switch (lang) {
    case 'en':
      return `**4. Schema Markup (schema_markup)**
Generate valid JSON-LD for NewsArticle schema. Required fields: @context, @type, headline, description (IDENTICAL to meta_description), articleBody (compressed entity-rich summary ≤150 words), mainEntityOfPage, inLanguage (MUST be "${bcp47}"), image (ONLY if image_url is provided), datePublished, dateModified, author, publisher, about, mentions, keywords, articleSection.
${rules}
⚠️ SYNTAX FIREWALL: Return raw JSON only. NO markdown code fences.`;

    case 'pl':
      return `**4. Schema Markup (schema_markup)**
Wygeneruj prawidłowy JSON-LD dla schematu NewsArticle. Wymagane pola: @context, @type, headline, description (IDENTYCZNY z meta_description), articleBody (skompresowane streszczenie bogate w encje ≤150 słów), mainEntityOfPage, inLanguage (MUSI być "${bcp47}"), image (TYLKO jeśli image_url jest podany), datePublished, dateModified, author, publisher, about, mentions, keywords, articleSection.
${rules}
⚠️ ZAPORA SKŁADNIOWA: Zwróć sam JSON. BEZ bloków kodu markdown.`;

    case 'sq':
      return `**4. Schema Markup (schema_markup)**
Gjeneroni JSON-LD të vlefshëm për skemën NewsArticle. Fushat e detyrueshme: @context, @type, headline, description (IDENTIKE me meta_description), articleBody (përmbledhje e kompresuar e pasur me entitete ≤150 fjalë), mainEntityOfPage, inLanguage (DUHET të jetë "${bcp47}"), image (VETËM nëse image_url është dhënë), datePublished, dateModified, author, publisher, about, mentions, keywords, articleSection.
${rules}
⚠️ MURI SINTAKSOR: Ktheni vetëm JSON të pastër. PA blloqe kodi markdown.`;

    default:
      return `**C. Schema Markup (schema_markup)**
Generiši validan JSON-LD string za NewsArticle schemu.
Obavezna polja: @context, @type, headline, description (IDENTIČNA meta_description), articleBody (kompresovani sažetak ≤150 reči), mainEntityOfPage, inLanguage (MORA biti "${bcp47}"), image (SAMO ako je image_url dat), datePublished, dateModified, author, publisher, about, mentions, keywords, articleSection.
${rules}
⚠️ SINTAKSNA ZAŠTITA: Vrati isključivo čistu JSON strukturu. STROGO ZABRANJENO korišćenje Markdown code blokova.`;
  }
}

function getSyntaxFirewall(lang: SupportedLanguage): string {
  switch (lang) {
    case 'en': return '⚠️ SYNTAX FIREWALL: Return ONLY raw JSON. NO markdown code fences (no ```json). Text must be valid JSON ready for parsing.';
    case 'pl': return '⚠️ ZAPORA SKŁADNIOWA: Zwróć WYŁĄCZNIE surowy JSON. BEZ bloków kodu markdown (bez ```json). Tekst musi być prawidłowym JSON gotowym do parsowania.';
    case 'sq': return '⚠️ MURI SINTAKSOR: Ktheni VETËM JSON të pastër. PA blloqe kodi markdown (pa ```json). Teksti duhet të jetë JSON i vlefshëm gati për parsim.';
    default: return '⚠️ SINTAKSNA ZAŠTITA: Vrati isključivo čistu, neobrađenu JSON strukturu. STROGO ZABRANJENO korišćenje Markdown code blokova.';
  }
}

// ── Label helpers ──
function getKnownVarsLabel(lang: SupportedLanguage): string {
  return lang === 'en' ? 'Known variables from original link' : lang === 'pl' ? 'Znane zmienne z oryginalnego linku' : lang === 'sq' ? 'Variablat e njohura nga linku origjinal' : 'Poznate varijable sa originalnog linka';
}
function getInputLabel(lang: SupportedLanguage): string {
  return lang === 'en' ? 'Input (summary)' : lang === 'pl' ? 'Dane wejściowe (podsumowanie)' : lang === 'sq' ? 'Hyrja (përmbledhje)' : 'Ulaz (sažetak)';
}
function getPrimaryLabel(lang: SupportedLanguage): string {
  return lang === 'en' ? 'Primary keyword' : lang === 'pl' ? 'Główne słowo kluczowe' : lang === 'sq' ? 'Fjala kyçe kryesore' : 'Primarna ključna reč';
}
function getSecondaryLabel(lang: SupportedLanguage): string {
  return lang === 'en' ? 'Secondary' : lang === 'pl' ? 'Dodatkowe' : lang === 'sq' ? 'Dytësore' : 'Sekundarne';
}
function getTopicsLabel(lang: SupportedLanguage): string {
  return lang === 'en' ? 'Topics' : lang === 'pl' ? 'Tematy' : lang === 'sq' ? 'Temat' : 'Teme';
}
function getTitleLabel(lang: SupportedLanguage): string {
  return lang === 'en' ? 'Document title' : lang === 'pl' ? 'Tytuł dokumentu' : lang === 'sq' ? 'Titulli i dokumentit' : 'Naslov dokumenta';
}
function getTextSampleLabel(lang: SupportedLanguage): string {
  return lang === 'en' ? 'Text sample' : lang === 'pl' ? 'Próbka tekstu' : lang === 'sq' ? 'Mostër teksti' : 'Uzorak teksta';
}
function getReturnJSON(lang: SupportedLanguage): string {
  switch (lang) {
    case 'en': return 'Return ONLY JSON, no explanation and no code fences.';
    case 'pl': return 'Zwróć WYŁĄCZNIE JSON, bez wyjaśnień i bez bloków kodu.';
    case 'sq': return 'Ktheni VETËM JSON, pa shpjegime dhe pa blloqe kodi.';
    default: return 'Vrati SAMO JSON, bez objašnjenja i bez code fences.';
  }
}
