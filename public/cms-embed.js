/**
 * SEO GEM — CMS Embed Script v2.2 (Multi-Language)
 * Embeds SEO title generation and meta/keywords/schema auto-fill into any CMS.
 *
 * Usage:
 * <script
 *   src="https://seo-gem-app.vercel.app/cms-embed.js"
 *   data-api-key="sk_cms_newsmax_xxx"
 *   data-language="sr"  (sr|en|pl|sq, default: sr)
 *   data-title-max="75" (optional, default: 75)
 *   data-field-seo-title='[name="og_title"]'
 *   data-field-meta-desc='[name="meta_description"]'
 *   data-field-keywords='[name="keywords"]'
 *   data-field-schema='[name="schema_org"]'
 *   data-field-title='[name="heading"]'
 *   data-field-lead='[name="lead"]'
 *   data-editor-type="ckeditor"
 * ></script>
 */
(function () {
  if (window.__seoGemLoaded) return;
  window.__seoGemLoaded = true;

  'use strict';

  // ── Configuration from script tag data attributes ──
  const scriptTag = document.currentScript || document.querySelector('script[data-api-key]');
  if (!scriptTag) { console.error('[SEO GEM] Script tag not found'); return; }

  const rawTitleMax = parseInt(scriptTag.getAttribute('data-title-max') || '75', 10);

  const CONFIG = {
    apiBase: scriptTag.getAttribute('data-api-base') || scriptTag.src.replace('/cms-embed.js', ''),
    apiKey: scriptTag.getAttribute('data-api-key') || '',
    titleMax: (!isNaN(rawTitleMax) && rawTitleMax > 0) ? rawTitleMax : 75,
    fields: {
      seoTitle: scriptTag.getAttribute('data-field-seo-title') || '[name="og_title"]',
      metaDesc: scriptTag.getAttribute('data-field-meta-desc') || '[name="meta_description"]',
      keywords: scriptTag.getAttribute('data-field-keywords') || '[name="keywords"]',
      schema: scriptTag.getAttribute('data-field-schema') || '[name="schema_org"]',
      title: scriptTag.getAttribute('data-field-title') || '[name="heading"]',
      lead: scriptTag.getAttribute('data-field-lead') || '[name="lead"]',
      published: scriptTag.getAttribute('data-field-published') || '[name="publish_at"], [name="published_at"], [name="time_created"]',
      image: scriptTag.getAttribute('data-field-image') || '[name="image_og"], [name="og_image"], [name="image_orig"]',
      author: scriptTag.getAttribute('data-field-author') || 'select[name="author_id"], [name="author"], select[name="authors[]"]',
      section: scriptTag.getAttribute('data-field-section') || 'select[name="category_id"], [name="article_section"], select[name="categories[]"]',
      articleUrl: scriptTag.getAttribute('data-field-article-url') || '',
    },
    editorType: (scriptTag.getAttribute('data-editor-type') || 'ckeditor').toLowerCase(),
    language: (scriptTag.getAttribute('data-language') || 'sr').toLowerCase(),
  };

  // ── i18n UI text per language ──
  const UI_STRINGS = {
    sr: {
      generateButton: '✨ Generiši SEO sa SEO GEM',
      generatedButton: '✅ SEO generisan',
      workingButton: '⌛ SEO GEM radi...',
      chooseTitleButton: 'Izaberi naslov ↓',
      loadingTitles: 'Analiziram tekst i generišem predloge naslova...',
      loadingGenerate: 'Generišem Meta Opis, Ključne reči i Schema Markup...',
      successMessage: '✅ SEO polja su uspešno popunjena! Možete ih pregledati i po potrebi izmeniti.',
      llmFailedMessage: '⚠️ AI generisanje nije uspelo. Kliknite "Ponovi" za novi pokušaj.',
      retryingMessage: '🔄 Automatski pokušavam ponovo...',
      errorMinLength: 'Tekst članka mora imati najmanje 100 karaktera. Popunite sadržaj pre generisanja.',
      errorSelectTitle: 'Odaberite ili unesite naslov.',
      errorGenerate: 'Greška pri generisanju SEO polja.',
      errorTitles: 'Greška pri generisanju naslova.',
      categories: { informativni: '📘 INFORMATIVNI', geo_pitanje: '🌍 GEO', discover_hook: '📱 DISCOVER HOOK' },
      categoryDescriptions: {
        informativni: 'Jasna činjenica sa ključnom frazom, za klasičnu Google pretragu',
        geo_pitanje: 'Pitanje i direktan odgovor, za AI preglede i glasovnu pretragu',
        discover_hook: 'Konkretna zanimljivost bez klik-mamca, za Google Discover',
      },
      customLabel: '✏️ Sopstveni:',
      confirmButton: '✅ Potvrdi izbor',
      regenerateButton: '🔄 Novi predlozi',
      retryButton: '🔄 Ponovi',
      closeButton: 'Zatvori',
      redoButton: '🔄 Ponovi generisanje',
    },
    en: {
      generateButton: '✨ Generate SEO with SEO GEM',
      generatedButton: '✅ SEO Generated',
      workingButton: '⌛ SEO GEM working...',
      chooseTitleButton: 'Choose a title ↓',
      loadingTitles: 'Analyzing text and generating title suggestions...',
      loadingGenerate: 'Generating Meta Description, Keywords and Schema Markup...',
      successMessage: '✅ SEO fields successfully populated! You can review and edit them as needed.',
      llmFailedMessage: '⚠️ AI generation failed. Click "Retry" to try again.',
      retryingMessage: '🔄 Automatically retrying...',
      errorMinLength: 'Article text must be at least 100 characters. Please fill in the content before generating.',
      errorSelectTitle: 'Please select or enter a title.',
      errorGenerate: 'Error generating SEO fields.',
      errorTitles: 'Error generating titles.',
      categories: { informativni: '📘 INFORMATIVE', geo_pitanje: '🌍 GEO QUESTION', discover_hook: '📱 DISCOVER HOOK' },
      categoryDescriptions: {
        informativni: 'Clear fact with key phrase, for classic Google search',
        geo_pitanje: 'Question and direct answer, for AI Overviews and voice search',
        discover_hook: 'Concrete hook without clickbait, for Google Discover',
      },
      customLabel: '✏️ Custom:',
      confirmButton: '✅ Confirm Selection',
      regenerateButton: '🔄 New Suggestions',
      retryButton: '🔄 Retry',
      closeButton: 'Close',
      redoButton: '🔄 Regenerate',
    },
    pl: {
      generateButton: '✨ Generuj SEO z SEO GEM',
      generatedButton: '✅ SEO wygenerowane',
      workingButton: '⌛ SEO GEM pracuje...',
      chooseTitleButton: 'Wybierz tytuł ↓',
      loadingTitles: 'Analizuję tekst i generuję propozycje tytułów...',
      loadingGenerate: 'Generuję Meta Opis, Słowa kluczowe i Schema Markup...',
      successMessage: '✅ Pola SEO zostały pomyślnie wypełnione! Możesz je przejrzeć i edytować.',
      llmFailedMessage: '⚠️ Generowanie AI nie powiodło się. Kliknij "Ponów" aby spróbować ponownie.',
      retryingMessage: '🔄 Automatycznie ponawiam próbę...',
      errorMinLength: 'Tekst artykułu musi mieć co najmniej 100 znaków. Wypełnij treść przed generowaniem.',
      errorSelectTitle: 'Wybierz lub wpisz tytuł.',
      errorGenerate: 'Błąd podczas generowania pól SEO.',
      errorTitles: 'Błąd podczas generowania tytułów.',
      categories: { informativni: '📘 INFORMACYJNY', geo_pitanje: '🌍 GEO PYTANIE', discover_hook: '📱 DISCOVER HOOK' },
      categoryDescriptions: {
        informativni: 'Jasny fakt z frazą kluczową, do klasycznej wyszukiwarki Google',
        geo_pitanje: 'Pytanie i bezpośrednia odpowiedź, dla przeglądów AI i wyszukiwania głosowego',
        discover_hook: 'Konkretna ciekawostka bez clickbaitu, dla Google Discover',
      },
      customLabel: '✏️ Własny:',
      confirmButton: '✅ Potwierdź wybór',
      regenerateButton: '🔄 Nowe propozycje',
      retryButton: '🔄 Ponów',
      closeButton: 'Zamknij',
      redoButton: '🔄 Generuj ponownie',
    },
    sq: {
      generateButton: '✨ Gjenero SEO me SEO GEM',
      generatedButton: '✅ SEO u gjenerua',
      workingButton: '⌛ SEO GEM po punon...',
      chooseTitleButton: 'Zgjidh titullin ↓',
      loadingTitles: 'Po analizoj tekstin dhe po gjeneroj sugjerime p\u00ebr tituj...',
      loadingGenerate: 'Po gjeneroj Meta P\u00ebrshkrimin, Fjal\u00ebt ky\u00e7e dhe Schema Markup...',
      successMessage: '✅ Fushat SEO u plot\u00ebsuan me sukses! Mund t\u2019i rishikoni dhe editoni.',
      llmFailedMessage: '⚠️ Gjenerimi AI d\u00ebshtoi. Klikoni "Riprovo" p\u00ebr t\u00eb provuar p\u00ebrs\u00ebri.',
      retryingMessage: '🔄 Po riprovohet automatikisht...',
      errorMinLength: 'Teksti i artikullit duhet t\u00eb ket\u00eb t\u00eb pakt\u00ebn 100 karaktere.',
      errorSelectTitle: 'Zgjidhni ose shkruani nj\u00eb titull.',
      errorGenerate: 'Gabim gjat\u00eb gjenerimit t\u00eb fushave SEO.',
      errorTitles: 'Gabim gjat\u00eb gjenerimit t\u00eb titujve.',
      categories: { informativni: '📘 INFORMATIV', geo_pitanje: '🌍 GEO PYETJE', discover_hook: '📱 DISCOVER HOOK' },
      categoryDescriptions: {
        informativni: 'Fakt i qart\u00eb me fraz\u00ebn ky\u00e7e, p\u00ebr k\u00ebrkimin klasik n\u00eb Google',
        geo_pitanje: 'Pyetje dhe p\u00ebrgjigje e drejtp\u00ebrdrejt\u00eb, p\u00ebr p\u00ebrmbledhjet AI dhe k\u00ebrkimin me z\u00eb',
        discover_hook: 'Detaj interesant pa clickbait, p\u00ebr Google Discover',
      },
      customLabel: '✏️ I personalizuar:',
      confirmButton: '✅ Konfirmo zgjedhjen',
      regenerateButton: '🔄 Sugjerime t\u00eb reja',
      retryButton: '🔄 Riprovo',
      closeButton: 'Mbyll',
      redoButton: '🔄 Rigjenero',
    },
  };
  const t = UI_STRINGS[CONFIG.language] || UI_STRINGS.sr;

  if (!CONFIG.apiKey) { console.error('[SEO GEM] data-api-key is required'); return; }

  // ── Styles (self-contained) ──
  const STYLES = `
    .seo-gem-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 18px; border: none; border-radius: 8px; cursor: pointer;
      font-family: 'Inter', -apple-system, sans-serif; font-size: 14px; font-weight: 600;
      color: #fff; background: linear-gradient(135deg, #059669, #0d9488);
      box-shadow: 0 2px 8px rgba(5,150,105,0.3);
      transition: all 0.2s ease;
    }
    .seo-gem-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(5,150,105,0.4); }
    .seo-gem-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .seo-gem-btn--secondary {
      background: #f3f4f6; color: #374151; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .seo-gem-btn--secondary:hover { background: #e5e7eb; }
    .seo-gem-btn--done {
      background: linear-gradient(135deg, #10b981, #059669);
    }

    .seo-gem-panel {
      display: none; position: static; width: 100%; box-sizing: border-box;
      margin: 10px 0; padding: 0;
      border: 2px solid #059669; border-radius: 12px;
      background: #fff; overflow: visible;
      font-family: 'Inter', -apple-system, sans-serif;
    }
    .seo-gem-panel.open { display: block; }
    .seo-gem-panel-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 14px; background: linear-gradient(135deg, #ecfdf5, #f0fdfa);
      border-bottom: 1px solid #d1fae5; border-radius: 10px 10px 0 0;
    }
    .seo-gem-panel-header h3 {
      margin: 0; font-size: 15px; font-weight: 700; color: #065f46;
    }
    .seo-gem-close {
      background: none; border: none; cursor: pointer; font-size: 18px;
      color: #6b7280; padding: 2px 6px; border-radius: 4px; line-height: 1;
    }
    .seo-gem-close:hover { background: #f3f4f6; }
    .seo-gem-panel-body { padding: 10px 14px; }

    .seo-gem-category { margin-bottom: 8px; }
    .seo-gem-category:last-of-type { margin-bottom: 4px; }
    .seo-gem-category-header {
      display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px;
      margin-bottom: 3px; line-height: 1.35;
    }
    .seo-gem-category-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; margin: 0; padding: 0;
    }
    .seo-gem-category-desc {
      font-size: 11px; font-weight: 400; color: #6b7280;
    }
    .seo-gem-cat-info { color: #2563eb; }
    .seo-gem-cat-geo { color: #059669; }
    .seo-gem-cat-discover { color: #7c3aed; }

    .seo-gem-title-option {
      display: flex; align-items: center; gap: 8px;
      padding: 5px 8px; margin-bottom: 2px; border-radius: 6px;
      cursor: pointer; border: 1px solid transparent;
      transition: all 0.15s ease;
    }
    .seo-gem-title-option:hover { background: #f9fafb; border-color: #e5e7eb; }
    .seo-gem-title-option.selected { background: #ecfdf5; border-color: #059669; }
    .seo-gem-title-option input[type="radio"] {
      margin: 0; accent-color: #059669; flex-shrink: 0;
    }
    .seo-gem-title-text {
      flex: 1; font-size: 13px; font-weight: 500; color: #111827; line-height: 1.35;
    }
    .seo-gem-title-meta {
      font-size: 11px; color: #9ca3af; white-space: nowrap; flex-shrink: 0;
    }

    .seo-gem-hint-wrap {
      position: relative; display: inline-flex; align-items: center; justify-content: center;
      flex-shrink: 0; cursor: pointer; user-select: none; margin-left: 2px;
    }
    .seo-gem-hint-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 18px; height: 18px; border-radius: 50%;
      font-size: 13px; line-height: 1; color: #059669;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .seo-gem-hint-wrap:hover .seo-gem-hint-icon,
    .seo-gem-hint-wrap.active .seo-gem-hint-icon {
      background: #d1fae5; color: #065f46;
    }
    .seo-gem-hint-tooltip {
      display: none; position: absolute; right: 0; bottom: calc(100% + 6px);
      width: max-content; max-width: 320px; padding: 6px 10px;
      background: #1f2937; color: #f9fafb; font-size: 12px; font-weight: 400;
      line-height: 1.35; border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.18);
      z-index: 50; white-space: normal; text-align: left; pointer-events: none;
    }
    .seo-gem-hint-wrap:hover .seo-gem-hint-tooltip,
    .seo-gem-hint-wrap.active .seo-gem-hint-tooltip {
      display: block;
    }

    .seo-gem-custom {
      margin-top: 6px; padding: 6px 8px; border-radius: 6px;
      border: 1px solid #e5e7eb; display: flex; align-items: center; gap: 8px;
    }
    .seo-gem-custom input[type="text"] {
      flex: 1; border: 1px solid #d1d5db; border-radius: 6px;
      padding: 5px 10px; font-size: 13px; outline: none;
      font-family: 'Inter', -apple-system, sans-serif;
    }
    .seo-gem-custom input[type="text"]:focus { border-color: #059669; box-shadow: 0 0 0 2px rgba(5,150,105,0.15); }
    .seo-gem-custom-count { font-size: 11px; color: #9ca3af; white-space: nowrap; }

    .seo-gem-actions {
      display: flex; gap: 8px; justify-content: flex-end;
      padding: 8px 14px; border-top: 1px solid #e5e7eb; background: #fafafa;
      border-radius: 0 0 10px 10px;
    }

    .seo-gem-loading {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 28px 16px; text-align: center;
    }
    .seo-gem-spinner {
      width: 34px; height: 34px; border: 3px solid #e5e7eb;
      border-top-color: #059669; border-radius: 50%;
      animation: seo-gem-spin 0.8s linear infinite;
    }
    @keyframes seo-gem-spin { to { transform: rotate(360deg); } }
    .seo-gem-loading-text { margin-top: 10px; font-size: 13px; color: #6b7280; }

    .seo-gem-error {
      padding: 10px 14px; background: #fef2f2; border: 1px solid #fecaca;
      border-radius: 8px; margin: 6px 0; color: #991b1b; font-size: 13px;
    }

    .seo-gem-success {
      padding: 10px 14px; background: #ecfdf5; border: 1px solid #a7f3d0;
      border-radius: 8px; margin: 4px 0; color: #065f46; font-size: 13px;
    }
  `;

  // ── Inject styles ──
  const styleEl = document.createElement('style');
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);

  // ── Helper: find element by comma-separated fallback selector list in priority order ──
  function findElementBySelectorList(selectorList) {
    if (!selectorList) return null;
    const parts = String(selectorList).split(',').map(s => s.trim()).filter(Boolean);
    let firstFound = null;
    for (let i = 0; i < parts.length; i++) {
      try {
        const el = document.querySelector(parts[i]);
        if (el) {
          if (!firstFound) firstFound = el;
          if (el.tagName === 'SELECT' || (el.value !== undefined && String(el.value).trim() !== '')) {
            return el;
          }
        }
      } catch (e) { /* ignore invalid selector */ }
    }
    return firstFound;
  }

  // ── Helper: get field value (for <select>, always returns selected option text; "None"/"" -> "") ──
  function getFieldValue(selector) {
    const el = findElementBySelectorList(selector);
    if (!el) return '';
    if (el.tagName === 'SELECT') {
      const opts = el.selectedOptions
        ? Array.from(el.selectedOptions)
        : (el.selectedIndex >= 0 && el.options ? [el.options[el.selectedIndex]] : []);
      const texts = opts
        .map(opt => (opt && typeof opt.text === 'string' ? opt.text.trim() : ''))
        .filter(txt => txt && txt.toLowerCase() !== 'none');
      return texts.join(', ');
    }
    const val = (el.value !== undefined && el.value !== null)
      ? String(el.value).trim()
      : String(el.textContent || '').trim();
    if (val.toLowerCase() === 'none') return '';
    return val;
  }

  // ── Helper: set field value ──
  function setFieldValue(selector, value) {
    const el = findElementBySelectorList(selector);
    if (!el) { console.warn('[SEO GEM] Field not found:', selector); return false; }
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      el.textContent = value;
    }
    return true;
  }

  // ── Helper: parse "YYYY-MM-DD HH:mm" (browser local time) to ISO string ──
  function parsePublishedDateToISO(rawVal) {
    if (!rawVal || typeof rawVal !== 'string') return '';
    var s = rawVal.trim();
    if (!s) return '';
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
      var d = new Date(
        parseInt(m[1], 10),
        parseInt(m[2], 10) - 1,
        parseInt(m[3], 10),
        parseInt(m[4], 10),
        parseInt(m[5], 10),
        m[6] ? parseInt(m[6], 10) : 0,
        0
      );
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    var parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
    return '';
  }

  // ── Helper: read existing schema_org if it is valid JSON ──
  function getValidExistingSchema() {
    try {
      var el = findElementBySelectorList(CONFIG.fields.schema);
      if (!el) return '';
      var raw = (el.value !== undefined ? el.value : el.textContent || '').trim();
      if (!raw) return '';
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return raw;
      }
    } catch (e) { /* invalid JSON */ }
    return '';
  }

  // ── Helper: Cubes-compatible slugify (matches server titleToSlug) ──
  var TRANSLITERATE_MAP = {
    'š': 's', 'đ': 'd', 'č': 'c', 'ć': 'c', 'ž': 'z',
    'Š': 's', 'Đ': 'd', 'Č': 'c', 'Ć': 'c', 'Ž': 'z',
    'ą': 'a', 'ę': 'e', 'ł': 'l', 'ń': 'n',
    'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'a', 'Ę': 'e', 'Ł': 'l', 'Ń': 'n', 'Ó': 'o',
    'Ś': 's', 'Ź': 'z', 'Ż': 'z',
    'ë': 'e', 'ç': 'c', 'Ë': 'e', 'Ç': 'c'
  };

  function transliterateText(text) {
    return String(text || '').normalize('NFC').split('').map(function (c) {
      return TRANSLITERATE_MAP[c] || c;
    }).join('');
  }

  function slugifyTitle(title) {
    return transliterateText(title)
      .toLowerCase()
      .replace(/[.,:;!?()"'„“”‘’‚«»%]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function buildCanonicalUrl(publicUrl, seoTitle) {
    if (!publicUrl || !seoTitle) return '';
    var clean = String(publicUrl).trim().split('?')[0].split('#')[0];
    if (!clean.startsWith('http') || clean.includes('backoffice') || clean.includes('cubesdev')) {
      return '';
    }
    var m = clean.match(/^(https?:\/\/[^/]+(?:\/[^/]+)*\/\d{4,}\/)([^/]+)(\/.*)?$/);
    if (!m) return '';
    var slug = slugifyTitle(seoTitle);
    if (!slug) return '';
    return m[1] + slug + (m[3] || '');
  }

  var LANG_DOMAINS = {
    sr: 'newsmaxbalkans.com',
    en: 'newsmaxbalkans.com',
    sq: 'newsmaxbalkans.al',
    pl: 'newsmaxpolska.pl'
  };

  function resolveAbsoluteImageUrl(rawImg, publicUrl, schemaObj) {
    if (!rawImg || typeof rawImg !== 'string') return '';
    var trimmed = rawImg.trim();
    if (!trimmed || trimmed.toLowerCase() === 'none') return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (trimmed.startsWith('/')) {
      var origin = '';
      if (publicUrl && publicUrl.startsWith('http')) {
        try { origin = new URL(publicUrl).origin; } catch (e) { /* */ }
      }
      if (!origin && schemaObj && schemaObj.publisher && schemaObj.publisher.logo && schemaObj.publisher.logo.url) {
        try { origin = new URL(schemaObj.publisher.logo.url).origin; } catch (e) { /* */ }
      }
      if (!origin) {
        var dom = LANG_DOMAINS[CONFIG.language] || LANG_DOMAINS.sr;
        origin = 'https://' + dom;
      }
      return origin + trimmed;
    }
    return '';
  }

  // ── Helper: get body text from CKEditor or other editors ──
  function getBodyText() {
    if (CONFIG.editorType === 'ckeditor') {
      // CKEditor 4
      if (typeof CKEDITOR !== 'undefined' && CKEDITOR.instances) {
        const instances = Object.values(CKEDITOR.instances);
        if (instances.length > 0) {
          // Get the largest instance (likely the body editor)
          let best = instances[0];
          for (const inst of instances) {
            if ((inst.getData() || '').length > (best.getData() || '').length) {
              best = inst;
            }
          }
          // Strip HTML tags to get plain text
          const html = best.getData() || '';
          const tmp = document.createElement('div');
          tmp.innerHTML = html;
          return tmp.textContent || tmp.innerText || '';
        }
      }
      // CKEditor 5
      if (typeof ClassicEditor !== 'undefined' || typeof InlineEditor !== 'undefined') {
        // CKEditor 5 instances are usually attached to elements
        const editors = document.querySelectorAll('.ck-editor__editable');
        if (editors.length > 0) {
          return editors[0].textContent || '';
        }
      }
    }

    if (CONFIG.editorType === 'tinymce') {
      if (typeof tinymce !== 'undefined') {
        const editor = tinymce.activeEditor || tinymce.editors[0];
        if (editor) return editor.getContent({ format: 'text' });
      }
    }

    // Fallback: try to find a textarea with lots of text (excluding schema_org)
    const schemaEl = findElementBySelectorList(CONFIG.fields.schema);
    const textareas = document.querySelectorAll('textarea');
    let longest = '';
    textareas.forEach(ta => {
      if (ta === schemaEl) return;
      if (ta.value.length > longest.length) longest = ta.value;
    });
    if (longest.length > 100) {
      const tmp = document.createElement('div');
      tmp.innerHTML = longest;
      return tmp.textContent || tmp.innerText || longest;
    }

    return '';
  }

  // ── API calls ──
  async function apiCall(endpoint, data) {
    const resp = await fetch(CONFIG.apiBase + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CONFIG.apiKey,
      },
      body: JSON.stringify(data),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) {
      throw new Error(json.error || 'API greška: ' + resp.status);
    }
    return json;
  }

  // ── State ──
  let state = {
    phase: 'idle', // idle | loading-titles | titles | loading-generate | done | llm-failed
    titles: [],
    selectedIndex: null,
    customTitle: '',
    error: null,
  };

  // ── UI Elements ──
  let buttonEl, panelEl;

  function render() {
    if (!panelEl) return;

    const isOpen = state.phase !== 'idle' && state.phase !== 'done';
    panelEl.classList.toggle('open', isOpen || state.phase === 'done');

    // Update button text
    if (state.phase === 'done') {
      buttonEl.innerHTML = t.generatedButton;
      buttonEl.className = 'seo-gem-btn seo-gem-btn--done';
      buttonEl.disabled = false;
    } else if (state.phase === 'idle') {
      buttonEl.innerHTML = t.generateButton;
      buttonEl.className = 'seo-gem-btn';
      buttonEl.disabled = false;
    } else if (state.phase === 'titles') {
      buttonEl.innerHTML = t.chooseTitleButton;
      buttonEl.className = 'seo-gem-btn';
      buttonEl.disabled = true;
    } else {
      buttonEl.innerHTML = t.workingButton;
      buttonEl.disabled = true;
    }

    // Panel content
    let bodyHTML = '';

    if (state.phase === 'loading-titles') {
      bodyHTML = `
        <div class="seo-gem-loading">
          <div class="seo-gem-spinner"></div>
          <div class="seo-gem-loading-text">${t.loadingTitles}</div>
        </div>`;
    }

    else if (state.phase === 'titles') {
      const cats = {
        informativni: { label: t.categories.informativni, desc: t.categoryDescriptions.informativni, cls: 'seo-gem-cat-info' },
        geo_pitanje: { label: t.categories.geo_pitanje, desc: t.categoryDescriptions.geo_pitanje, cls: 'seo-gem-cat-geo' },
        discover_hook: { label: t.categories.discover_hook, desc: t.categoryDescriptions.discover_hook, cls: 'seo-gem-cat-discover' },
      };

      // Group titles by style
      const grouped = {};
      state.titles.forEach((item, i) => {
        if (!grouped[item.style]) grouped[item.style] = [];
        grouped[item.style].push({ ...item, idx: i });
      });

      for (const [style, info] of Object.entries(cats)) {
        const items = grouped[style] || [];
        if (items.length === 0) continue;
        bodyHTML += `<div class="seo-gem-category">
          <div class="seo-gem-category-header">
            <span class="seo-gem-category-label ${info.cls}">${info.label}</span>
            <span class="seo-gem-category-desc">— ${escHtml(info.desc)}</span>
          </div>`;
        for (const item of items) {
          const checked = state.selectedIndex === item.idx ? 'checked' : '';
          const selectedCls = state.selectedIndex === item.idx ? 'selected' : '';
          const hintText = (item.hint && typeof item.hint === 'string') ? item.hint.trim() : '';
          const hintHTML = hintText
            ? `<span class="seo-gem-hint-wrap" data-hint-idx="${item.idx}" role="button" tabindex="0" aria-label="Info"><span class="seo-gem-hint-icon">ⓘ</span><span class="seo-gem-hint-tooltip">${escHtml(hintText)}</span></span>`
            : '';
          bodyHTML += `
            <label class="seo-gem-title-option ${selectedCls}" data-idx="${item.idx}">
              <input type="radio" name="seo-gem-title" value="${item.idx}" ${checked}>
              <span class="seo-gem-title-text">${escHtml(item.text)}</span>
              <span class="seo-gem-title-meta">${item.length} kar.</span>
              ${hintHTML}
            </label>`;
        }
        bodyHTML += '</div>';
      }

      // Custom title input
      bodyHTML += `
        <div class="seo-gem-custom">
          <input type="radio" name="seo-gem-title" value="custom" ${state.selectedIndex === 'custom' ? 'checked' : ''}>
          <span style="font-size:13px;white-space:nowrap">${t.customLabel}</span>
          <input type="text" id="seo-gem-custom-input" maxlength="${CONFIG.titleMax}"
            placeholder="..."
            value="${escHtml(state.customTitle)}">
          <span class="seo-gem-custom-count">${state.customTitle.length}/${CONFIG.titleMax}</span>
        </div>`;
    }

    else if (state.phase === 'loading-generate') {
      const selTitle = state.selectedIndex === 'custom'
        ? state.customTitle
        : (state.titles[state.selectedIndex]?.text || '');
      bodyHTML = `
        <div class="seo-gem-loading">
          <div class="seo-gem-spinner"></div>
          <div class="seo-gem-loading-text">
            ${t.loadingGenerate}<br>
            <small style="color:#059669">"${escHtml(selTitle.substring(0, 60))}..."</small>
          </div>
        </div>`;
    }

    else if (state.phase === 'done') {
      bodyHTML = `
        <div class="seo-gem-success">
          ${t.successMessage}
        </div>`;
    }

    else if (state.phase === 'llm-failed') {
      bodyHTML = `
        <div class="seo-gem-error" style="background:#fef3cd;color:#856404;border:1px solid #ffc107;padding:12px;border-radius:6px;font-size:14px;line-height:1.5">
          ${t.llmFailedMessage}
        </div>`;
    }

    if (state.error) {
      bodyHTML += `<div class="seo-gem-error">❌ ${escHtml(state.error)}</div>`;
    }

    // Actions
    let actionsHTML = '';
    if (state.phase === 'titles') {
      const canConfirm = state.selectedIndex !== null &&
        (state.selectedIndex !== 'custom' || state.customTitle.trim().length > 5);
      actionsHTML = `
        <button class="seo-gem-btn seo-gem-btn--secondary" id="seo-gem-regenerate">${t.regenerateButton}</button>
        <button class="seo-gem-btn" id="seo-gem-confirm" ${canConfirm ? '' : 'disabled'}>${t.confirmButton}</button>`;
    } else if (state.phase === 'done') {
      actionsHTML = `
        <button class="seo-gem-btn seo-gem-btn--secondary" id="seo-gem-redo">${t.redoButton}</button>
        <button class="seo-gem-btn seo-gem-btn--secondary seo-gem-close" id="seo-gem-close-done">${t.closeButton}</button>`;
    } else if (state.phase === 'llm-failed') {
      actionsHTML = `
        <button class="seo-gem-btn" id="seo-gem-retry">${t.retryButton || '🔄 Ponovi'}</button>
        <button class="seo-gem-btn seo-gem-btn--secondary seo-gem-close" id="seo-gem-close-done">${t.closeButton}</button>`;
    }

    panelEl.innerHTML = `
      <div class="seo-gem-panel-header">
        <h3>💎 SEO GEM</h3>
        <button class="seo-gem-close" id="seo-gem-close-btn">✕</button>
      </div>
      <div class="seo-gem-panel-body">${bodyHTML}</div>
      ${actionsHTML ? '<div class="seo-gem-actions">' + actionsHTML + '</div>' : ''}`;

    // Bind events
    bindPanelEvents();
  }

  function gatherGenerateMetadata() {
    var authorName = '';
    try { authorName = getFieldValue(CONFIG.fields.author) || ''; } catch (e) { /* */ }
    var articleSection = '';
    try { articleSection = getFieldValue(CONFIG.fields.section) || ''; } catch (e) { /* */ }
    var publishedAt = '';
    try { publishedAt = parsePublishedDateToISO(getFieldValue(CONFIG.fields.published)); } catch (e) { /* */ }
    var imageUrl = '';
    try { imageUrl = getFieldValue(CONFIG.fields.image) || ''; } catch (e) { /* */ }
    var existingSchema = '';
    try { existingSchema = getValidExistingSchema(); } catch (e) { /* */ }

    var articleId = extractArticleIdFromPage();
    var publicUrl = '';

    // 1. Try dedicated config field (if CMS admin configured data-field-article-url)
    if (CONFIG.fields.articleUrl) {
      try { publicUrl = getFieldValue(CONFIG.fields.articleUrl) || ''; } catch (e) { /* */ }
    }

    // 2. Try CMS input fields (og_url, canonical_url — explicitly set by CMS)
    if (!publicUrl) {
      var urlSelectors = ['[name="og_url"]', '[name="canonical_url"]', '[name="article_url"]', '[name="permalink"]'];
      for (var si = 0; si < urlSelectors.length; si++) {
        try {
          var el = document.querySelector(urlSelectors[si]);
          if (el && el.value && el.value.startsWith('http') && !el.value.includes('backoffice') && !el.value.includes('cubesdev')) {
            publicUrl = el.value;
            break;
          }
        } catch (e) { /* */ }
      }
    }

    // 3. If we have article ID — find the public link on the page that contains THIS EXACT ID
    if (!publicUrl && articleId) {
      publicUrl = findPublicUrlForId(articleId);
    }

    if (publicUrl && publicUrl.startsWith('http')) {
      publicUrl = publicUrl.split('?')[0];
    } else {
      publicUrl = '';
    }

    var articleUrl = publicUrl;
    if (!articleUrl && articleId) {
      articleUrl = 'article-id:' + articleId;
    }

    return {
      authorName: authorName,
      articleSection: articleSection,
      publishedAt: publishedAt,
      imageUrl: imageUrl,
      existingSchema: existingSchema,
      articleId: articleId,
      publicUrl: publicUrl,
      articleUrl: articleUrl,
    };
  }

  function bindPanelEvents() {
    // Close button
    const closeBtn = panelEl.querySelector('#seo-gem-close-btn');
    if (closeBtn) closeBtn.onclick = () => { state.phase = 'idle'; state.error = null; render(); };

    const closeDone = panelEl.querySelector('#seo-gem-close-done');
    if (closeDone) closeDone.onclick = () => { state.phase = 'idle'; render(); };

    // Title selection
    panelEl.querySelectorAll('input[name="seo-gem-title"]').forEach(radio => {
      radio.onchange = () => {
        state.selectedIndex = radio.value === 'custom' ? 'custom' : parseInt(radio.value);
        state.error = null;
        render();
      };
    });

    // Custom title input
    const customInput = panelEl.querySelector('#seo-gem-custom-input');
    if (customInput) {
      customInput.oninput = () => {
        state.customTitle = customInput.value;
        const countEl = customInput.parentElement.querySelector('.seo-gem-custom-count');
        if (countEl) countEl.textContent = state.customTitle.length + '/' + CONFIG.titleMax;
        if (state.selectedIndex === 'custom') {
          const confirmBtn = panelEl.querySelector('#seo-gem-confirm');
          if (confirmBtn) confirmBtn.disabled = state.customTitle.trim().length <= 5;
        }
      };
      customInput.onfocus = () => {
        state.selectedIndex = 'custom';
        // Select the custom radio without full re-render (avoids scroll jump)
        const customRadio = panelEl.querySelector('input[name="seo-gem-title"][value="custom"]');
        if (customRadio) customRadio.checked = true;
        // Deselect other title options visually
        panelEl.querySelectorAll('.seo-gem-title-option').forEach(el => el.classList.remove('selected'));
        // Enable confirm button
        const confirmBtn = panelEl.querySelector('#seo-gem-confirm');
        if (confirmBtn) confirmBtn.disabled = state.customTitle.trim().length <= 5;
      };
    }

    // Confirm button
    const confirmBtn = panelEl.querySelector('#seo-gem-confirm');
    if (confirmBtn) confirmBtn.onclick = handleConfirm;

    // Regenerate
    const regenBtn = panelEl.querySelector('#seo-gem-regenerate');
    if (regenBtn) regenBtn.onclick = handleGenerateTitles;

    // Redo
    const redoBtn = panelEl.querySelector('#seo-gem-redo');
    if (redoBtn) redoBtn.onclick = handleGenerateTitles;

    // Retry (after LLM failure — reuses stored title, skips title selection)
    const retryBtn = panelEl.querySelector('#seo-gem-retry');
    if (retryBtn) retryBtn.onclick = async function() {
      state.phase = 'loading-generate';
      state.error = null;
      render();
      try {
        var meta = gatherGenerateMetadata();
        const data = await apiCall('/api/cms/generate', {
          title: state.lastTitle || '',
          selectedTitle: state.lastSelectedTitle || '',
          body: state.lastBody || getBodyText(),
          lead: state.lastLead || getFieldValue(CONFIG.fields.lead),
          articleUrl: meta.articleUrl,
          publicUrl: meta.publicUrl,
          articleId: meta.articleId,
          authorName: meta.authorName,
          articleSection: meta.articleSection,
          publishedAt: meta.publishedAt,
          imageUrl: meta.imageUrl,
          existingSchema: meta.existingSchema,
          offeredTitles: state.titles,
          language: CONFIG.language,
        });
        if (data.llmFailed) {
          state.phase = 'llm-failed';
          state.error = null;
          render();
          return;
        }
        setFieldValue(CONFIG.fields.seoTitle, data.seoTitle || '');
        setFieldValue(CONFIG.fields.metaDesc, data.metaDescription || '');
        setFieldValue(CONFIG.fields.keywords, data.keywords || '');
        if (data.schemaMarkup) {
          setFieldValue(CONFIG.fields.schema, data.schemaMarkup);
        }
        state.phase = 'done';
        state.error = null;
      } catch (err) {
        state.error = err.message || t.errorGenerate;
        state.phase = 'llm-failed';
      }
      render();
    };

    // Info hint toggle on click/tap
    panelEl.querySelectorAll('.seo-gem-hint-wrap').forEach(wrap => {
      wrap.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const wasActive = wrap.classList.contains('active');
        panelEl.querySelectorAll('.seo-gem-hint-wrap.active').forEach(el => el.classList.remove('active'));
        if (!wasActive) wrap.classList.add('active');
      };
    });

    // Click on title option label
    panelEl.querySelectorAll('.seo-gem-title-option').forEach(label => {
      label.onclick = (e) => {
        if (e.target.closest && e.target.closest('.seo-gem-hint-wrap')) return;
        if (e.target.tagName === 'INPUT') return; // radio handles itself
        const radio = label.querySelector('input[type="radio"]');
        if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
      };
    });
  }

  // ── Handlers ──
  async function handleGenerateTitles() {
    const bodyText = getBodyText();
    if (!bodyText || bodyText.trim().length < 100) {
      state.error = t.errorMinLength;
      state.phase = state.phase === 'idle' ? 'idle' : state.phase;
      render();
      return;
    }

    const title = getFieldValue(CONFIG.fields.title);
    const lead = getFieldValue(CONFIG.fields.lead);

    state.phase = 'loading-titles';
    state.error = null;
    state.selectedIndex = null;
    state.customTitle = '';
    render();

    try {
      const data = await apiCall('/api/cms/titles', { title, body: bodyText, lead, language: CONFIG.language });
      state.titles = data.titles || [];
      state.phase = 'titles';
    } catch (err) {
      state.error = err.message || t.errorTitles;
      state.phase = 'titles';
      state.titles = [];
    }
    render();
  }

  // ── Helper: extract article ID from page (5 patterns) ──
  function extractArticleIdFromPage() {
    var backofficeUrl = window.location.href || '';
    var articleId = '';

    // Pattern 1: /articles/57081/edit or /articles/57081/ (with trailing slash)
    var match1 = backofficeUrl.match(/\/articles\/(\d{4,})\//);
    if (match1) articleId = match1[1];

    // Pattern 2: /articles/57081 (no trailing slash, end of URL or with query)
    if (!articleId) {
      var match2 = backofficeUrl.match(/\/articles\/(\d{4,})(?:\?|#|$)/);
      if (match2) articleId = match2[1];
    }

    // Pattern 3: Any /DIGITS/ pattern in the URL (4+ digits)
    if (!articleId) {
      var match3 = backofficeUrl.match(/\/(\d{4,})(?:\/|$|\?)/);
      if (match3) articleId = match3[1];
    }

    // Pattern 4: DOM fallback — check hidden fields commonly used by CMS
    if (!articleId) {
      var idSelectors = [
        '[name="article_id"]', '[name="id"]', '[name="post_id"]', '[name="content_id"]',
        '[name="articleId"]', 'input[type="hidden"][name="id"]',
        '#article_id', '#articleId', '#post_id',
        'form[action*="/articles/"] input[name="id"]'
      ];
      for (var isi = 0; isi < idSelectors.length; isi++) {
        try {
          var idEl = document.querySelector(idSelectors[isi]);
          if (idEl && idEl.value && /^\d{4,}$/.test(idEl.value)) {
            articleId = idEl.value;
            console.log('[SEO GEM] Found article ID from DOM field:', idSelectors[isi], articleId);
            break;
          }
        } catch(e) { /* */ }
      }
    }

    // Pattern 5: Check form action URL
    if (!articleId) {
      try {
        var forms = document.querySelectorAll('form[action]');
        for (var fi = 0; fi < forms.length; fi++) {
          var formAction = forms[fi].getAttribute('action') || '';
          var match5 = formAction.match(/\/articles\/(\d{4,})/);
          if (match5) {
            articleId = match5[1];
            console.log('[SEO GEM] Found article ID from form action:', articleId);
            break;
          }
        }
      } catch(e) { /* */ }
    }

    return articleId;
  }

  // ── Helper: find public link on page matching exact article ID ──
  function findPublicUrlForId(id) {
    if (!id) return '';
    try {
      var allLinks = document.querySelectorAll('a[href]');
      for (var li = 0; li < allLinks.length; li++) {
        var linkHref = allLinks[li].href || '';
        // Must be public (not backoffice), must contain our exact article ID in path
        if (linkHref
            && !linkHref.includes('backoffice')
            && !linkHref.includes('cubesdev')
            && linkHref.startsWith('http')
            && linkHref.match(new RegExp('/' + id + '/'))) {
          console.log('[SEO GEM] Found public URL matching article ID ' + id + ':', linkHref);
          return linkHref;
        }
      }
    } catch(e) { /* */ }
    return '';
  }

  // ── Pending article_id persistence across page reloads (localStorage) ──
  var PENDING_STORAGE_KEY = 'seoGemPending';
  var PENDING_MAX_AGE_MS = 60 * 60 * 1000; // 60 minutes
  var PENDING_MAX_ITEMS = 5;
  var pendingInFlight = {};

  function getPendingItems() {
    try {
      var raw = localStorage.getItem(PENDING_STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      var now = Date.now();
      var valid = parsed.filter(function(item) {
        return item && item.th && typeof item.seoTitle === 'string' && typeof item.ts === 'number' && (now - item.ts <= PENDING_MAX_AGE_MS);
      });
      if (valid.length !== parsed.length) {
        try { localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(valid)); } catch(e) { /* */ }
      }
      return valid;
    } catch (e) {
      console.warn('[SEO GEM] Failed to read seoGemPending:', e);
      return [];
    }
  }

  function addPendingItem(thId, seoTitle) {
    try {
      var items = getPendingItems().filter(function(item) { return String(item.th) !== String(thId); });
      items.push({ th: thId, seoTitle: (seoTitle || '').trim(), ts: Date.now() });
      if (items.length > PENDING_MAX_ITEMS) {
        items = items.slice(items.length - PENDING_MAX_ITEMS);
      }
      localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(items));
      console.log('[SEO GEM] Saved pending article ID item to localStorage (TH#' + thId + ')');
    } catch (e) {
      console.warn('[SEO GEM] Failed to save seoGemPending:', e);
    }
  }

  function removePendingItem(thId) {
    try {
      var items = getPendingItems().filter(function(item) { return String(item.th) !== String(thId); });
      localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('[SEO GEM] Failed to remove item from seoGemPending:', e);
    }
  }

  function checkPendingArticleIds() {
    try {
      var items = getPendingItems();
      if (!items || items.length === 0) return;

      var pageArticleId = extractArticleIdFromPage();
      if (!pageArticleId) return;

      var pageSeoTitle = (getFieldValue(CONFIG.fields.seoTitle) || '').trim();
      if (!pageSeoTitle) return;

      items.forEach(function(item) {
        if ((item.seoTitle || '').trim() !== pageSeoTitle) return;
        if (pendingInFlight[item.th]) return;
        pendingInFlight[item.th] = true;

        var rawPublicUrl = findPublicUrlForId(pageArticleId);
        var publicUrl = rawPublicUrl ? rawPublicUrl.split('?')[0] : null;
        console.log('[SEO GEM] Matched pending TH#' + item.th + ' with article ID ' + pageArticleId + ', sending PATCH...');

        fetch(CONFIG.apiBase + '/api/cms/update-article-id', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + CONFIG.apiKey
          },
          body: JSON.stringify({
            title_history_id: item.th,
            article_id: pageArticleId,
            article_url: publicUrl
          })
        }).then(function(resp) {
          return resp.json();
        }).then(function(result) {
          delete pendingInFlight[item.th];
          if (result && result.success) {
            removePendingItem(item.th);
            console.log('[SEO GEM] ✅ Article ID updated from pending queue: TH#' + item.th + ' → ' + pageArticleId);
          } else {
            console.warn('[SEO GEM] Pending article ID update failed:', result && result.error);
          }
        }).catch(function(err) {
          delete pendingInFlight[item.th];
          console.warn('[SEO GEM] Pending article ID PATCH error:', err);
        });
      });
    } catch (e) {
      console.warn('[SEO GEM] checkPendingArticleIds error:', e);
    }
  }

  async function handleConfirm() {
    const selectedTitle = state.selectedIndex === 'custom'
      ? state.customTitle.trim()
      : (state.titles[state.selectedIndex]?.text || '');

    if (!selectedTitle || selectedTitle.length < 5) {
      state.error = t.errorSelectTitle;
      render();
      return;
    }

    const bodyText = getBodyText();
    const title = getFieldValue(CONFIG.fields.title);
    const lead = getFieldValue(CONFIG.fields.lead);

    state.phase = 'loading-generate';
    state.error = null;
    render();

    var meta = gatherGenerateMetadata();
    var articleId = meta.articleId;

    // Inner function for calling generate API (used for auto-retry)
    async function callGenerate() {
      const data = await apiCall('/api/cms/generate', {
        title,
        selectedTitle,
        body: bodyText,
        lead,
        articleUrl: meta.articleUrl,
        publicUrl: meta.publicUrl,
        articleId: meta.articleId,
        authorName: meta.authorName,
        articleSection: meta.articleSection,
        publishedAt: meta.publishedAt,
        imageUrl: meta.imageUrl,
        existingSchema: meta.existingSchema,
        offeredTitles: state.titles,
        language: CONFIG.language,
      });
      return data;
    }

    try {
      let data = await callGenerate();

      // If LLM failed, auto-retry once before showing error
      if (data.llmFailed) {
        console.warn('[SEO GEM] LLM failed, auto-retrying once...');
        state.error = t.retryingMessage;
        render();
        await new Promise(function(r) { setTimeout(r, 2000); }); // wait 2s before retry
        data = await callGenerate();
      }

      // If still failed after retry, show llm-failed phase
      if (data.llmFailed) {
        console.error('[SEO GEM] LLM failed after auto-retry');
        state.phase = 'llm-failed';
        state.error = null;
        // Store the selected title so retry can reuse it
        state.lastSelectedTitle = selectedTitle;
        state.lastTitle = title;
        state.lastBody = bodyText;
        state.lastLead = lead;
        render();
        return;
      }

      // Fill CMS fields only with real AI-generated content
      setFieldValue(CONFIG.fields.seoTitle, data.seoTitle || '');
      setFieldValue(CONFIG.fields.metaDesc, data.metaDescription || '');
      setFieldValue(CONFIG.fields.keywords, data.keywords || '');
      if (data.schemaMarkup) {
        setFieldValue(CONFIG.fields.schema, data.schemaMarkup);
      }

      state.phase = 'done';
      state.error = null;

      // ── URL Monitor & Pending Queue: watch for article_id if we didn't have one ──
      // When journalist creates a new article (/articles/new), saves it,
      // and the URL changes to /articles/57081/edit — we catch that and PATCH.
      if (data.titleHistoryId && !articleId) {
        addPendingItem(data.titleHistoryId, data.seoTitle || selectedTitle);
        console.log('[SEO GEM] Starting URL monitor for article ID (TH#' + data.titleHistoryId + ')');
        var monitorAttempts = 0;
        var maxMonitorAttempts = 60; // 5 minutes (every 5 seconds)
        var urlMonitorInterval = setInterval(function() {
          try {
            monitorAttempts++;
            var currentUrl = window.location.href || '';
            // Try to extract article ID from current URL
            var urlMatch = currentUrl.match(/\/articles\/(\d{4,})/);
            if (!urlMatch) {
              // Also check for any /DIGITS/ pattern
              urlMatch = currentUrl.match(/\/(\d{4,})(?:\/|$|\?)/);
            }
            if (urlMatch) {
              var newArticleId = urlMatch[1];
              var rawPublicUrl = findPublicUrlForId(newArticleId);
              var publicUrl = rawPublicUrl ? rawPublicUrl.split('?')[0] : null;
              console.log('[SEO GEM] URL monitor detected article ID: ' + newArticleId);
              clearInterval(urlMonitorInterval);
              // Send PATCH to update title_history
              try {
                fetch(CONFIG.apiBase + '/api/cms/update-article-id', {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + CONFIG.apiKey
                  },
                  body: JSON.stringify({
                    title_history_id: data.titleHistoryId,
                    article_id: newArticleId,
                    article_url: publicUrl
                  })
                }).then(function(resp) {
                  return resp.json();
                }).then(function(result) {
                  if (result && result.success) {
                    removePendingItem(data.titleHistoryId);
                    console.log('[SEO GEM] ✅ Article ID updated: TH#' + data.titleHistoryId + ' → ' + newArticleId);
                  } else {
                    console.warn('[SEO GEM] Article ID update failed:', result && result.error);
                  }
                }).catch(function(err) {
                  console.warn('[SEO GEM] Article ID PATCH error:', err);
                });
              } catch(e) { console.warn('[SEO GEM] URL monitor PATCH error:', e); }
            } else if (monitorAttempts >= maxMonitorAttempts) {
              console.log('[SEO GEM] URL monitor stopped after 5 minutes, no article ID found');
              clearInterval(urlMonitorInterval);
            }
          } catch (e) { console.warn('[SEO GEM] URL monitor error:', e); }
        }, 5000); // Check every 5 seconds
      }

    } catch (err) {
      state.error = err.message || t.errorGenerate;
      state.phase = 'titles'; // Go back to title selection
    }
    render();
  }

  // ── Schema Guardian: synchronous submit listener on the form containing schema_org ──
  function handleFormSubmitSchemaGuard(e) {
    try {
      var form = e && e.target;
      if (!form || form.tagName !== 'FORM') return;
      var schemaEl = findElementBySelectorList(CONFIG.fields.schema);
      if (!schemaEl || !form.contains(schemaEl)) return;

      var rawSchema = (schemaEl.value !== undefined ? schemaEl.value : schemaEl.textContent || '').trim();
      if (!rawSchema) return;

      var schemaObj = JSON.parse(rawSchema);
      if (!schemaObj || typeof schemaObj !== 'object' || schemaObj['@type'] !== 'NewsArticle') {
        return;
      }

      var currentOgTitle = (getFieldValue(CONFIG.fields.seoTitle) || '').trim();
      if (currentOgTitle) {
        schemaObj.headline = currentOgTitle;
      }

      var headlineForSlug = currentOgTitle || schemaObj.headline || '';
      var artId = extractArticleIdFromPage();
      var pubUrl = artId ? findPublicUrlForId(artId) : '';
      if (!pubUrl) {
        // Fallback: if schema already has url / mainEntityOfPage.@id with /{id}/{slug}
        var existingSchemaUrl = (schemaObj.url && typeof schemaObj.url === 'string' ? schemaObj.url : '') ||
          (schemaObj.mainEntityOfPage && typeof schemaObj.mainEntityOfPage['@id'] === 'string' ? schemaObj.mainEntityOfPage['@id'] : '');
        if (existingSchemaUrl) pubUrl = existingSchemaUrl;
      }
      if (pubUrl && headlineForSlug) {
        var updatedUrl = buildCanonicalUrl(pubUrl, headlineForSlug);
        if (updatedUrl) {
          schemaObj.mainEntityOfPage = { '@type': 'WebPage', '@id': updatedUrl };
          schemaObj.url = updatedUrl;
        }
      }

      var hasImage = schemaObj.image && (
        (typeof schemaObj.image === 'string' && schemaObj.image.trim()) ||
        (typeof schemaObj.image === 'object' && schemaObj.image.url && String(schemaObj.image.url).trim())
      );
      if (!hasImage) {
        var rawImg = getFieldValue(CONFIG.fields.image);
        if (rawImg) {
          var absImg = resolveAbsoluteImageUrl(rawImg, pubUrl, schemaObj);
          if (absImg) {
            schemaObj.image = { '@type': 'ImageObject', url: absImg };
          }
        }
      }

      var dontChangeEl = form.querySelector('input[type="checkbox"][name="dont_change_time"]') ||
                         document.querySelector('input[type="checkbox"][name="dont_change_time"]');
      var dontChangeTime = !!(dontChangeEl && dontChangeEl.checked);
      if (!dontChangeTime) {
        schemaObj.dateModified = new Date().toISOString();
      }

      // datePublished is never modified by Schema Guardian
      setFieldValue(CONFIG.fields.schema, JSON.stringify(schemaObj));
    } catch (err) {
      // Never block form submission; leave invalid JSON untouched
      console.warn('[SEO GEM] Schema guard skipped:', err && err.message ? err.message : err);
    }
  }

  document.addEventListener('submit', handleFormSubmitSchemaGuard, true);

  function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ── Initialize ──
  function init() {
    // Create button
    buttonEl = document.createElement('button');
    buttonEl.className = 'seo-gem-btn';
    buttonEl.innerHTML = t.generateButton;
    buttonEl.type = 'button';
    buttonEl.onclick = () => {
      if (state.phase === 'idle' || state.phase === 'done') {
        handleGenerateTitles();
      }
    };

    // Create panel
    panelEl = document.createElement('div');
    panelEl.className = 'seo-gem-panel';

    // Close active hint tooltip when clicking outside
    document.addEventListener('click', (e) => {
      if (!panelEl) return;
      if (e.target.closest && e.target.closest('.seo-gem-hint-wrap')) return;
      panelEl.querySelectorAll('.seo-gem-hint-wrap.active').forEach(el => el.classList.remove('active'));
    });

    // Find insertion point — try to place after the body editor or before SEO Title field
    const seoTitleField = findElementBySelectorList(CONFIG.fields.seoTitle);
    const insertTarget = seoTitleField
      ? seoTitleField.closest('tr, .form-group, .field-row, div') || seoTitleField.parentElement
      : null;

    if (insertTarget) {
      insertTarget.parentElement.insertBefore(panelEl, insertTarget);
      insertTarget.parentElement.insertBefore(buttonEl, panelEl);
    } else {
      // Fallback: append to body
      document.body.appendChild(buttonEl);
      document.body.appendChild(panelEl);
    }

    console.log('[SEO GEM] v2.2 Initialized. Editor:', CONFIG.editorType, '| API:', CONFIG.apiBase, '| Language:', CONFIG.language, '| TitleMax:', CONFIG.titleMax);
  }

  function schedulePendingChecks() {
    setTimeout(checkPendingArticleIds, 1500);
    setTimeout(checkPendingArticleIds, 5000);
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      init();
      schedulePendingChecks();
    });
  } else {
    // DOM already loaded, but wait a tick for CKEditor to initialize
    setTimeout(init, 500);
    schedulePendingChecks();
  }
})();
