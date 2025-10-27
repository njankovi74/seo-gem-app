import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

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
      'Allow': 'GET, POST, OPTIONS',
    },
  });
}

// Shared implementation used by GET/POST
async function extractByUrl(url: string) {
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
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
    timeout: 10000,
  });

  const html = response.data;
  const $ = cheerio.load(html);

  // Remove unwanted elements (boilerplate removal) - AGRESIVNO!
  $('script, style, nav, header, footer, aside, .sidebar, .menu, .navigation, .ads, .advertisement, .social-share, .comments, .comment, #comments, .related-posts, .popup, .modal, .cookie-notice').remove();
  $('.ad, .ads, .advertisement, .banner, .popup, .modal, .newsletter, .subscription, .social, .share, .nav, .navigation, .menu, .sidebar, .widget, .footer, .header').remove();
  
  // Newsmax Balkans specifični elementi (app promo, social embeds, itd.)
  $('.app-download, .app-promo, .download-app, .store-buttons, .google-play, .app-store').remove();
  $('[class*="app-"], [class*="download"], [class*="store-button"]').remove();
  
  // Ukloni sve što sadrži "Google Play", "App Store", "preuzeti aplikaciju" u tekstu
  $('p, div, section').filter((_, el) => {
    const text = $(el).text().toLowerCase();
    return text.includes('google play') || 
           text.includes('app store') || 
           text.includes('preuzeti aplikaciju') ||
           text.includes('preuzmite aplikaciju');
  }).remove();

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

  // Extract Lead/Description: Priority Serbian news sites specific selectors first
  // 1) Try common Serbian news site Lead paragraph classes
  // 2) Fall back to meta tags (often truncated)
  let leadText = '';
  
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
      if (text.length > 50) {  // Valid Lead should be substantial
        leadText = text;
        console.log(`📰 [extract] Lead found via selector "${selector}": ${text.length} chars`);
        break;
      }
    }
  }
  
  // Fall back to meta description if no dedicated Lead found
  if (!leadText) {
    leadText = $('meta[name="description"]').attr('content') || 
               $('meta[property="og:description"]').attr('content') || '';
    if (leadText) {
      console.log(`📰 [extract] Lead from meta tag: ${leadText.length} chars`);
    }
  }

  const metadata = {
    description: leadText,
    keywords: $('meta[name="keywords"]').attr('content') || '',
    author: $('meta[name="author"]').attr('content') || 
           $('meta[property="article:author"]').attr('content') || (ld?.author || ''),
    publishDate: $('meta[property="article:published_time"]').attr('content') || 
                $('meta[name="publish-date"]').attr('content') || 
                $('time').attr('datetime') || (ld?.publishDate || '')
  };

  // Priority: 1) og:title (social - kompletan), 2) twitter:title, 3) <title>, 4) <h1>, 5) JSON-LD headline
  let title = $('meta[property="og:title"]').attr('content') || 
              $('meta[name="twitter:title"]').attr('content') ||
              $('title').text().trim() ||
              $('h1').first().text().trim();
  if (ld?.headline && (!title || title.length < 5)) title = ld.headline;

  let content = '';
  let extractionMethod = 'none';
  
  // 1) Priority: JSON-LD articleBody (najčistiji izvor)
  if (ld?.articleBody && ld.articleBody.toString().trim().length > 100) {
    content = ld.articleBody.toString();
    extractionMethod = 'json-ld';
    console.log(`📄 [extract] JSON-LD articleBody: ${content.length} chars`);
  }
  
  // 2) Fallback: ULTRA-optimizovana CSS selector strategija
  if (!content || content.length < 100) {
    console.log('🔍 [extract] Using smart CSS selector extraction...');
    
    const articleSelectors = [
      'article', '.article', '.post', '.entry-content', '.post-content',
      '.article-content', '[itemprop="articleBody"]', '.article__content',
      '.article-body__content', '.article-body', '.single-article', '.single-content',
      '.post-body', '.post__content', '.post-text', '.story-content', 'main',
      '.main-content', '#content', '.story-body'
    ];
    
    // Pokušaj naći glavni article container
    let articleContainer = null;
    for (const selector of articleSelectors) {
      const element = $(selector).first();
      if (element.length && element.find('p').length > 2) {
        articleContainer = element;
        console.log(`📦 [extract] Found article container: ${selector}`);
        break;
      }
    }
    
    if (articleContainer) {
      // Izvuci sve paragrafe iz article containera
      const paragraphs: string[] = [];
      articleContainer.find('p').each((_, el) => {
        const $p = $(el);
        const text = $p.text().trim();
        
        // FILTER: Preskoči noise paragrafe
        const textLower = text.toLowerCase();
        const isNoise = 
          text.length < 40 || // Prekratki paragrafi
          textLower.includes('google play') ||
          textLower.includes('app store') ||
          textLower.includes('preuzeti aplikaciju') ||
          textLower.includes('preuzmite aplikaciju') ||
          textLower.includes('pročitajte') ||
          textLower.includes('povezan') ||
          textLower.includes('pratite nas') ||
          textLower.includes('share') ||
          textLower.includes('follow') ||
          $p.parent().hasClass('social') ||
          $p.parent().hasClass('share') ||
          $p.parent().hasClass('related') ||
          $p.closest('.related-articles, .related-posts, .social-share, .app-promo').length > 0;
        
        if (!isNoise) {
          paragraphs.push(text);
        }
      });
      
      content = paragraphs.join('\n');
      extractionMethod = 'css-selector-smart';
      console.log(`📄 [extract] Smart CSS selector: ${paragraphs.length} paragraphs, ${content.length} chars`);
    }
  }
  
  // 3) Last resort fallback: Svi <p> tagovi sa filteringom
  if (!content || content.length < 100) {
    console.log('🔍 [extract] Using fallback: all <p> tags with filtering...');
    const allParagraphs = $('p').map((_, el) => $(el).text().trim()).get();
    const filtered = allParagraphs.filter(p => {
      const textLower = p.toLowerCase();
      return p.length > 40 && 
        !textLower.includes('google play') &&
        !textLower.includes('app store') &&
        !textLower.includes('preuzeti aplikaciju');
    });
    content = filtered.join('\n');
    extractionMethod = 'fallback-paragraphs';
    console.log(`📄 [extract] Fallback <p> tags: ${filtered.length} paragraphs, ${content.length} chars`);
  }

  console.log(`✅ [extract] Final method: ${extractionMethod}, length: ${content.length} chars, wordCount: ${content.split(/\s+/).length}`);


  const cleanText = content
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .replace(/\bPre\s?\d+\s?[hm]\b/gi, '')
    .replace(/\b\d{1,2}:\d{2}\b/g, '')
    .replace(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g, '')
    // zadrži srpska slova i osnovnu interpunkciju
    .replace(/[^\w\sčćžšđČĆŽŠĐ.,!?;:-]/g, '')
    .trim();

  // VAŽNO: Za tačno brojanje, kombinu Lead (metadata.description) + Body (content)
  const fullArticleText = (metadata.description ? metadata.description + ' ' : '') + cleanText;
  const wordCount = fullArticleText.split(/\s+/).filter(word => word.length > 0).length;

  const extractedContent: ExtractedContent = {
    title: title || 'Bez naslova',
    content,
    metadata,
    wordCount,
    cleanText
  };
  return NextResponse.json(extractedContent);
}

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
      return NextResponse.json(
        { error: 'URL je obavezan parametar' },
        { status: 400 }
      );
    }

    return await extractByUrl(url);

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