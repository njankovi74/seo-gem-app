import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

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
    headers: {
      'Allow': 'POST, OPTIONS',
    },
  });
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST on this endpoint' }, {
    status: 405,
    headers: { 'Allow': 'POST, OPTIONS' }
  });
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL je obavezan parametar' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Neispravan format URL-a' },
        { status: 400 }
      );
    }

    // Fetch HTML content
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'sr-RS,sr;q=0.9,en;q=0.8',
        // Axios sam hendluje gzip/deflate; ne forsirati ručno kompresiju.
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 10000,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Remove unwanted elements (boilerplate removal)
    $('script, style, nav, header, footer, aside, .sidebar, .menu, .navigation, .ads, .advertisement, .social-share, .comments, .comment, #comments, .related-posts, .popup, .modal, .cookie-notice').remove();
    
    // Remove elements with common ad/navigation classes
    $('.ad, .ads, .advertisement, .banner, .popup, .modal, .newsletter, .subscription, .social, .share, .nav, .navigation, .menu, .sidebar, .widget, .footer, .header').remove();

    // Try JSON-LD (Article/NewsArticle/BlogPosting)
    function tryJsonLD() {
      try {
        const candidates: any[] = [];
        $('script[type="application/ld+json"]').each((_, el) => {
          const raw = $(el).contents().text();
          if (!raw) return;
          try {
            const json = JSON.parse(raw);
            candidates.push(json);
          } catch {}
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
        const author = typeof article.author === 'string' ? article.author
          : Array.isArray(article.author) ? (article.author[0]?.name || '')
          : (article.author?.name || '');
        const publishDate = article.datePublished || article.dateCreated || '';
        const articleBody = article.articleBody || '';
        return { headline, author, publishDate, articleBody };
      } catch {
        return null;
      }
    }

    const ld = tryJsonLD();

    // Extract metadata
    const metadata = {
      description: $('meta[name="description"]').attr('content') || 
                  $('meta[property="og:description"]').attr('content') || '',
      keywords: $('meta[name="keywords"]').attr('content') || '',
      author: $('meta[name="author"]').attr('content') || 
             $('meta[property="article:author"]').attr('content') || (ld?.author || ''),
      publishDate: $('meta[property="article:published_time"]').attr('content') || 
                  $('meta[name="publish-date"]').attr('content') || 
                  $('time').attr('datetime') || (ld?.publishDate || '')
    };

    // Extract title
    let title = $('title').text().trim();
    if (!title) {
      title = $('h1').first().text().trim();
    }
    if (ld?.headline && (!title || title.length < 5)) title = ld.headline;

    // Extract main content
    let content = '';

    // 1) JSON-LD articleBody (najčistije)
    if (ld?.articleBody && ld.articleBody.toString().trim().length > 100) {
      content = ld.articleBody.toString();
    }

    // 2) Readability kao rani fallback
    if (!content || content.length < 100) {
      try {
        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const parsed = reader.parse();
        if (parsed?.textContent && parsed.textContent.trim().length > 100) {
          content = parsed.textContent.trim();
          if (!title && parsed.title) title = parsed.title.trim();
        }
      } catch {}
    }

    // 3) Heuristički selektori sa rangiranjem po sličnosti sa naslovom
    if (!content || content.length < 100) {
      const articleSelectors = [
        'article',
        '.article',
        '.post',
        // izbegavamo preširok '.content'
        '.entry-content',
        '.post-content',
        '.article-content',
        '[itemprop="articleBody"]',
        '.article__content',
        '.article-body__content',
        '.article-body',
        '.single-article',
        '.single-content',
        '.post-body',
        '.post__content',
        '.post-text',
        '.story-content',
        'main',
        '.main-content',
        '#content',
        '.story-body'
      ];

      // Ključne reči iz naslova
      const baseTitle = (ld?.headline || $('h1').first().text() || title || '').toLowerCase();
      const stop = new Set<string>(['je','za','u','na','i','od','do','se','da','koji','kako','što','sto','ili','ali','pa','su','sa','o']);
      const tokens = baseTitle
        .split(/[^a-zčćžšđ0-9]+/i)
        .map((t: string) => t.trim())
        .filter((t: string) => t.length > 2 && !stop.has(t));

      let best = { score: 0, text: '' } as { score: number; text: string };
      for (const selector of articleSelectors) {
        const element = $(selector);
        if (!element.length) continue;
        const paragraphs = element.find('p').map((_, el) => $(el).text().trim()).get();
        const joined = paragraphs.filter(p => p.length > 40).join('\n');
        const raw = (joined && joined.length > 100) ? joined : element.text().trim();
        if (!raw || raw.length < 100) continue;
  const low = raw.toLowerCase();
  const hits = tokens.reduce((acc: number, t: string) => acc + (low.split(t).length - 1), 0);
        const score = hits * 100 + Math.min(raw.length, 20000) / 100; // naglasi poklapanje, blago nagradi dužinu
        if (score > best.score) best = { score, text: raw };
      }
      if (best.text) content = best.text;
    }

    // 4) Poslednji fallback: svi paragrafi
    if (!content || content.length < 100) {
      const paragraphs = $('p').map((_, el) => $(el).text().trim()).get();
      content = paragraphs.filter(p => p.length > 40).join('\n');
    }

    // Clean text for analysis
    const cleanText = content
      // ukloni višestruke razmake/novoredove
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/\n{2,}/g, '\n')
      // ukloni tipične pejdžerske vremenske markere (npr. "07:11", "Pre 9 h", datume lepljene uz pasuse)
      .replace(/\bPre\s?\d+\s?[hm]\b/gi, '')
      .replace(/\b\d{1,2}:\d{2}\b/g, '')
      .replace(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g, '')
      // zadrži srpska slova i osnovnu interpunkciju
      .replace(/[^\w\sčćžšđČĆŽŠĐ.,!?;:-]/g, '')
      .trim();

    const wordCount = cleanText.split(/\s+/).filter(word => word.length > 0).length;

    const extractedContent: ExtractedContent = {
      title: title || 'Bez naslova',
      content,
      metadata,
      wordCount,
      cleanText
    };

    return NextResponse.json(extractedContent);

  } catch (error) {
    console.error('Error extracting content:', error);
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return NextResponse.json(
          { error: 'Sajt nije dostupan ili URL ne postoji' },
          { status: 404 }
        );
      }
      if (error.code === 'ETIMEDOUT') {
        return NextResponse.json(
          { error: 'Timeout - sajt predugo odgovara' },
          { status: 408 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Greška pri obradi URL-a. Molimo pokušajte ponovo.' },
      { status: 500 }
    );
  }
}