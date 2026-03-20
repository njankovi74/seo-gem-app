import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

interface ExtractedContent {
  title: string;
  content: string;
  metadata: {
    description?: string;
    keywords?: string;
    author?: string;
    publishDate?: string;
  };
  wordCount: number;
  cleanText: string;
}

// Ensure Node.js runtime on Vercel and avoid any accidental static optimization
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Helpful for any preflight or accidental GETs; also makes 405 responses JSON
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { 'Allow': 'GET, POST, OPTIONS' },
  });
}

// ─────────────────────────────────────────────────────────────
// Priority A: JSON-LD articleBody extraction (cleanest source)
// ─────────────────────────────────────────────────────────────
function tryJsonLD($: cheerio.CheerioAPI): {
  headline: string;
  author: string;
  publishDate: string;
  articleBody: string;
} | null {
  try {
    const candidates: any[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      const raw = $(el).contents().text();
      if (!raw) return;
      try { candidates.push(JSON.parse(raw)); } catch {}
    });

    const flat: any[] = [];
    const flatten = (node: any) => {
      if (!node) return;
      if (Array.isArray(node)) { node.forEach(flatten); return; }
      flat.push(node);
      if (node['@graph']) flatten(node['@graph']);
    };
    candidates.forEach(flatten);

    const article = flat.find(n => {
      const t = (n['@type'] || n.type || '').toString().toLowerCase();
      return ['newsarticle', 'article', 'blogposting'].some(x => t.includes(x));
    });
    if (!article) return null;

    const headline = article.headline || article.name || '';
    const author = typeof article.author === 'string'
      ? article.author
      : Array.isArray(article.author)
        ? (article.author[0]?.name || '')
        : (article.author?.name || '');
    const publishDate = article.datePublished || article.dateCreated || '';
    const articleBody = article.articleBody || '';
    return { headline, author, publishDate, articleBody };
  } catch {
    return null;
  }
}

// Helper: extract description from JSON-LD (clean source for Lead)
function findLdDescription($: cheerio.CheerioAPI): string | undefined {
  try {
    let desc: string | undefined;
    $('script[type="application/ld+json"]').each((_, el) => {
      if (desc) return;
      const raw = $(el).contents().text();
      if (!raw) return;
      try {
        const json = JSON.parse(raw);
        const flat: any[] = [];
        const flatten = (n: any) => {
          if (!n) return;
          if (Array.isArray(n)) { n.forEach(flatten); return; }
          flat.push(n);
          if (n['@graph']) flatten(n['@graph']);
        };
        flatten(json);
        for (const n of flat) {
          if (n.description && typeof n.description === 'string' && n.description.length > 30) {
            desc = n.description;
            return;
          }
        }
      } catch {}
    });
    return desc;
  } catch { return undefined; }
}

// ─────────────────────────────────────────────────────────────
// Priority B: Mozilla Readability extraction (universal)
// ─────────────────────────────────────────────────────────────
function tryReadability(html: string, url: string): string {
  try {
    // Pre-clean: strip script, style, svg, noscript tags BEFORE passing to JSDOM
    // This prevents JS code and JSON-LD from leaking into Readability's textContent
    const cleanedHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

    const dom = new JSDOM(cleanedHtml, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (article && article.textContent) {
      // Post-process: remove residual noise
      const text = article.textContent
        // Remove JS variable declarations that may have leaked
        .replace(/var\s+\w+\s*=[\s\S]*?;/g, '')
        // Remove JSON-like blobs
        .replace(/\{[\s\S]{200,}?\}/g, '')
        // Remove URLs
        .replace(/https?:\/\/\S+/g, '')
        // Collapse excessive newlines
        .replace(/\n{3,}/g, '\n\n')
        // Remove lines that are just whitespace or very short (< 3 chars)
        .split('\n')
        .filter(line => line.trim().length > 2)
        .join('\n')
        .trim();
      console.log(`📖 [extract] Readability: ${text.length} chars`);
      return text;
    }
    return '';
  } catch (e) {
    console.error('❌ [extract] Readability error:', e);
    return '';
  }
}

// ─────────────────────────────────────────────────────────────
// Priority C: LLM fallback — clean HTML then send to Gemini
// ─────────────────────────────────────────────────────────────
async function tryLLMExtraction(html: string): Promise<string> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ [extract] No GEMINI_API_KEY for LLM fallback');
      return '';
    }

    // Pre-process: strip heavy non-content tags to minimize tokens
    const $ = cheerio.load(html);
    $('script, style, svg, nav, header, footer, aside, iframe, noscript, link, meta, img, video, audio, picture, source, form, input, button, select, textarea').remove();
    $('.sidebar, .menu, .navigation, .ads, .advertisement, .social-share, .comments, .related-posts, .cookie-notice, .popup, .modal, .newsletter, .widget').remove();

    // Get cleaned text (limit to ~8000 chars to save tokens)
    const cleanedText = $.text()
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .trim()
      .slice(0, 8000);

    if (cleanedText.length < 100) return '';

    console.log(`🤖 [extract] LLM fallback: sending ${cleanedText.length} chars to Gemini`);

    const mod: any = await import('@google/generative-ai').catch(() => null);
    if (!mod?.GoogleGenerativeAI) return '';

    const genAI = new mod.GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      generationConfig: { temperature: 0.1, maxOutputTokens: 4000 },
    });

    const prompt = `Iz sledećeg teksta izvuci SAMO novinarski članak — telo teksta (Lead + Body).
Izbaci navigaciju, menije, reklame, komentare, footer, related articles.
Vrati SAMO čist tekst članka, bez formatiranja, bez objašnjenja.

TEKST:
${cleanedText}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    console.log(`✅ [extract] LLM fallback: extracted ${text.length} chars`);
    return text;
  } catch (e) {
    console.error('❌ [extract] LLM fallback error:', e);
    return '';
  }
}

// ─────────────────────────────────────────────────────────────
// Lead extraction (kept from original — works well)
// ─────────────────────────────────────────────────────────────
function extractLead($: cheerio.CheerioAPI, ldDescription?: string): string {
  // Serbian news sites often have dedicated Lead paragraph classes
  const leadSelectors = [
    '.single-news-short-description',  // Newsmax Balkans
    '.article-lead',
    '.lead',
    '.intro',
    '.standfirst',
    '.article-intro',
    '.article__lead',
    '.story-lead',
    'p.lead',
    'p.intro',
    '[class*="lead"]',
    '[class*="intro"]'
  ];

  for (const selector of leadSelectors) {
    const leadElement = $(selector).first();
    if (leadElement.length) {
      const text = leadElement.text().trim();
      if (text.length > 50 && !text.includes('var ') && !text.includes('function(')) {
        console.log(`📰 [extract] Lead found via selector "${selector}": ${text.length} chars`);
        return text;
      }
    }
  }

  // Try JSON-LD description (very clean source)
  if (ldDescription && ldDescription.length > 30 && !ldDescription.includes('var ')) {
    console.log(`📰 [extract] Lead from JSON-LD description: ${ldDescription.length} chars`);
    return ldDescription;
  }

  // Fall back to meta description (validate it's not JS code)
  const metaDesc = $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') || '';
  if (metaDesc && metaDesc.length > 30 && !metaDesc.includes('var ') && !metaDesc.includes('function(')) {
    console.log(`📰 [extract] Lead from meta tag: ${metaDesc.length} chars`);
    return metaDesc;
  }
  return '';
}

// ─────────────────────────────────────────────────────────────
// Main extraction pipeline
// ─────────────────────────────────────────────────────────────
async function extractByUrl(url: string) {
  // Validate URL
  try { new URL(url); } catch {
    return NextResponse.json({ error: 'Neispravan format URL-a' }, { status: 400 });
  }

  // Fetch HTML
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'sr-RS,sr;q=0.9,en;q=0.8',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
    timeout: 10000,
  });

  const html = response.data;
  const $ = cheerio.load(html);

  // ── Metadata ──
  const ld = tryJsonLD($);

  const leadText = extractLead($, ld?.articleBody ? undefined : findLdDescription($));

  const metadata = {
    description: leadText,
    keywords: $('meta[name="keywords"]').attr('content') || '',
    author: $('meta[name="author"]').attr('content') ||
      $('meta[property="article:author"]').attr('content') || (ld?.author || ''),
    publishDate: $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="publish-date"]').attr('content') ||
      $('time').attr('datetime') || (ld?.publishDate || ''),
  };

  // ── Title ──
  let title = $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('title').text().trim() ||
    $('h1').first().text().trim();
  if (ld?.headline && (!title || title.length < 5)) title = ld.headline;

  // ── Content Extraction (3-tier priority) ──
  let content = '';
  let extractionMethod = 'none';

  // Priority A: JSON-LD articleBody
  if (ld?.articleBody && ld.articleBody.toString().trim().length > 100) {
    content = ld.articleBody.toString();
    extractionMethod = 'json-ld';
    console.log(`📄 [extract] Priority A — JSON-LD articleBody: ${content.length} chars`);
  }

  // Priority B: Mozilla Readability
  if (!content || content.length < 200) {
    console.log('📖 [extract] Trying Priority B — Mozilla Readability...');
    const readabilityContent = tryReadability(html, url);
    if (readabilityContent.length >= 200) {
      content = readabilityContent;
      extractionMethod = 'readability';
      console.log(`📄 [extract] Priority B — Readability: ${content.length} chars`);
    }
  }

  // Priority C: LLM fallback (cleaned HTML → Gemini)
  if (!content || content.length < 200) {
    console.log('🤖 [extract] Trying Priority C — LLM fallback...');
    const llmContent = await tryLLMExtraction(html);
    if (llmContent.length > 100) {
      content = llmContent;
      extractionMethod = 'llm-fallback';
      console.log(`📄 [extract] Priority C — LLM fallback: ${content.length} chars`);
    }
  }

  console.log(`✅ [extract] Final method: ${extractionMethod}, length: ${content.length} chars`);

  // ── Post-processing ──
  let cleanText = content
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();

  // Strip social media / subscription noise from end of article
  const socialNoisePatterns = [
    /Pratite nas na[\s\S]*$/i,
    /Pretplatite se na[\s\S]*$/i,
    /Prijavite se na[\s\S]*$/i,
    /Zapratite nas[\s\S]*$/i,
    /Budite u toku[\s\S]*$/i,
    /Facebook i Instagram[\s\S]*$/i,
  ];
  for (const pattern of socialNoisePatterns) {
    cleanText = cleanText.replace(pattern, '').trim();
  }

  const fullArticleText = (metadata.description ? metadata.description + ' ' : '') + cleanText;
  const wordCount = fullArticleText.split(/\s+/).filter(word => word.length > 0).length;

  const extractedContent: ExtractedContent = {
    title: title || 'Bez naslova',
    content,
    metadata,
    wordCount,
    cleanText,
  };
  return NextResponse.json(extractedContent);
}

// ─── Route handlers ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get('url') || '';
    if (!url) {
      return NextResponse.json({ error: 'Parametar "url" je obavezan' }, { status: 400 });
    }
    return await extractByUrl(url);
  } catch (error) {
    console.error('GET extract error:', error);
    return NextResponse.json({ error: 'Greška pri obradi URL-a' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'URL je obavezan parametar' }, { status: 400 });
    }
    return await extractByUrl(url);
  } catch (error) {
    console.error('Error extracting content:', error);
    if (axios.isAxiosError(error)) {
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return NextResponse.json({ error: 'Sajt nije dostupan ili URL ne postoji' }, { status: 404 });
      }
      if (error.code === 'ETIMEDOUT') {
        return NextResponse.json({ error: 'Timeout - sajt predugo odgovara' }, { status: 408 });
      }
    }
    return NextResponse.json(
      { error: 'Greška pri obradi URL-a. Molimo pokušajte ponovo.' },
      { status: 500 }
    );
  }
}