/**
 * SEO GEM — CMS Embed Script (Multi-Language)
 * Embeds SEO title generation and meta/keywords/schema auto-fill into any CMS.
 *
 * Usage:
 * <script
 *   src="https://seo-gem-app.vercel.app/cms-embed.js"
 *   data-api-key="sk_cms_newsmax_xxx"
 *   data-language="sr"  (sr|en|pl|sq, default: sr)
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
  'use strict';

  // ── Configuration from script tag data attributes ──
  const scriptTag = document.currentScript || document.querySelector('script[data-api-key]');
  if (!scriptTag) { console.error('[SEO GEM] Script tag not found'); return; }

  const CONFIG = {
    apiBase: scriptTag.getAttribute('data-api-base') || scriptTag.src.replace('/cms-embed.js', ''),
    apiKey: scriptTag.getAttribute('data-api-key') || '',
    fields: {
      seoTitle: scriptTag.getAttribute('data-field-seo-title') || '[name="og_title"]',
      metaDesc: scriptTag.getAttribute('data-field-meta-desc') || '[name="meta_description"]',
      keywords: scriptTag.getAttribute('data-field-keywords') || '[name="keywords"]',
      schema: scriptTag.getAttribute('data-field-schema') || '[name="schema_org"]',
      title: scriptTag.getAttribute('data-field-title') || '[name="heading"]',
      lead: scriptTag.getAttribute('data-field-lead') || '[name="lead"]',
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
      loadingTitles: 'Analiziram tekst i generišem predloge naslova...',
      loadingGenerate: 'Generišem Meta Opis, Ključne reči i Schema Markup...',
      successMessage: '✅ SEO polja su uspešno popunjena! Možete ih pregledati i po potrebi izmeniti.',
      llmFailedMessage: '⚠️ AI generisanje nije uspelo. Kliknite "Ponovi" za novi pokušaj.',
      retryingMessage: '🔄 Automatski pokušavam ponovo...',
      errorMinLength: 'Tekst članka mora imati najmanje 100 karaktera. Popunite sadržaj pre generisanja.',
      errorSelectTitle: 'Odaberite ili unesite naslov.',
      errorGenerate: 'Greška pri generisanju SEO polja.',
      errorTitles: 'Greška pri generisanju naslova.',
      categories: { informativni: '📘 INFORMATIVNI', geo_pitanje: '🌍 GEO PITANJE', discover_hook: '📱 DISCOVER HOOK' },
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
      padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer;
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
      display: none; margin: 12px 0; padding: 0;
      border: 2px solid #059669; border-radius: 12px;
      background: #fff; overflow: hidden;
      font-family: 'Inter', -apple-system, sans-serif;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
    }
    .seo-gem-panel.open { display: block; }
    .seo-gem-panel-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px; background: linear-gradient(135deg, #ecfdf5, #f0fdfa);
      border-bottom: 1px solid #d1fae5;
    }
    .seo-gem-panel-header h3 {
      margin: 0; font-size: 15px; font-weight: 700; color: #065f46;
    }
    .seo-gem-close {
      background: none; border: none; cursor: pointer; font-size: 18px;
      color: #6b7280; padding: 4px 8px; border-radius: 4px;
    }
    .seo-gem-close:hover { background: #f3f4f6; }
    .seo-gem-panel-body { padding: 16px; max-height: 420px; overflow-y: auto; }

    .seo-gem-category { margin-bottom: 12px; }
    .seo-gem-category-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; margin-bottom: 6px; padding: 2px 0;
    }
    .seo-gem-cat-info { color: #2563eb; }
    .seo-gem-cat-geo { color: #059669; }
    .seo-gem-cat-discover { color: #7c3aed; }

    .seo-gem-title-option {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 8px 10px; margin-bottom: 4px; border-radius: 8px;
      cursor: pointer; border: 1px solid transparent;
      transition: all 0.15s ease;
    }
    .seo-gem-title-option:hover { background: #f9fafb; border-color: #e5e7eb; }
    .seo-gem-title-option.selected { background: #ecfdf5; border-color: #059669; }
    .seo-gem-title-option input[type="radio"] {
      margin-top: 3px; accent-color: #059669; flex-shrink: 0;
    }
    .seo-gem-title-text { font-size: 13px; font-weight: 500; color: #111827; line-height: 1.4; }
    .seo-gem-title-meta {
      font-size: 11px; color: #9ca3af; margin-top: 2px;
    }

    .seo-gem-custom {
      margin-top: 8px; padding: 8px 10px; border-radius: 8px;
      border: 1px solid #e5e7eb; display: flex; align-items: center; gap: 8px;
    }
    .seo-gem-custom input[type="text"] {
      flex: 1; border: 1px solid #d1d5db; border-radius: 6px;
      padding: 6px 10px; font-size: 13px; outline: none;
      font-family: 'Inter', -apple-system, sans-serif;
    }
    .seo-gem-custom input[type="text"]:focus { border-color: #059669; box-shadow: 0 0 0 2px rgba(5,150,105,0.15); }
    .seo-gem-custom-count { font-size: 11px; color: #9ca3af; white-space: nowrap; }

    .seo-gem-actions {
      display: flex; gap: 8px; justify-content: flex-end;
      padding: 12px 16px; border-top: 1px solid #e5e7eb; background: #fafafa;
    }

    .seo-gem-loading {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 40px 16px; text-align: center;
    }
    .seo-gem-spinner {
      width: 36px; height: 36px; border: 3px solid #e5e7eb;
      border-top-color: #059669; border-radius: 50%;
      animation: seo-gem-spin 0.8s linear infinite;
    }
    @keyframes seo-gem-spin { to { transform: rotate(360deg); } }
    .seo-gem-loading-text { margin-top: 12px; font-size: 13px; color: #6b7280; }

    .seo-gem-error {
      padding: 12px 16px; background: #fef2f2; border: 1px solid #fecaca;
      border-radius: 8px; margin: 8px 16px; color: #991b1b; font-size: 13px;
    }

    .seo-gem-success {
      padding: 12px 16px; background: #ecfdf5; border: 1px solid #a7f3d0;
      border-radius: 8px; margin: 8px 16px; color: #065f46; font-size: 13px;
    }
  `;

  // ── Inject styles ──
  const styleEl = document.createElement('style');
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);

  // ── Helper: get field value ──
  function getFieldValue(selector) {
    const el = document.querySelector(selector);
    if (!el) return '';
    return el.value || el.textContent || '';
  }

  // ── Helper: set field value ──
  function setFieldValue(selector, value) {
    const el = document.querySelector(selector);
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

    // Fallback: try to find a textarea with lots of text
    const textareas = document.querySelectorAll('textarea');
    let longest = '';
    textareas.forEach(ta => {
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
        informativni: { label: t.categories.informativni, cls: 'seo-gem-cat-info' },
        geo_pitanje: { label: t.categories.geo_pitanje, cls: 'seo-gem-cat-geo' },
        discover_hook: { label: t.categories.discover_hook, cls: 'seo-gem-cat-discover' },
      };

      // Group titles by style
      const grouped = {};
      state.titles.forEach((t, i) => {
        if (!grouped[t.style]) grouped[t.style] = [];
        grouped[t.style].push({ ...t, idx: i });
      });

      for (const [style, info] of Object.entries(cats)) {
        const items = grouped[style] || [];
        if (items.length === 0) continue;
        bodyHTML += `<div class="seo-gem-category">
          <div class="seo-gem-category-label ${info.cls}">${info.label}</div>`;
        for (const item of items) {
          const checked = state.selectedIndex === item.idx ? 'checked' : '';
          const selectedCls = state.selectedIndex === item.idx ? 'selected' : '';
          bodyHTML += `
            <label class="seo-gem-title-option ${selectedCls}" data-idx="${item.idx}">
              <input type="radio" name="seo-gem-title" value="${item.idx}" ${checked}>
              <div>
                <div class="seo-gem-title-text">${escHtml(item.text)}</div>
                <div class="seo-gem-title-meta">${item.length} kar. │ ${escHtml(item.reasoning.replace(/^CoT:\s*/i, ''))}</div>
              </div>
            </label>`;
        }
        bodyHTML += '</div>';
      }

      // Custom title input
      bodyHTML += `
        <div class="seo-gem-custom">
          <input type="radio" name="seo-gem-title" value="custom" ${state.selectedIndex === 'custom' ? 'checked' : ''}>
          <span style="font-size:13px;white-space:nowrap">${t.customLabel}</span>
          <input type="text" id="seo-gem-custom-input" maxlength="75"
            placeholder="..."
            value="${escHtml(state.customTitle)}">
          <span class="seo-gem-custom-count">${state.customTitle.length}/75</span>
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
        if (countEl) countEl.textContent = state.customTitle.length + '/75';
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
        const data = await apiCall('/api/cms/generate', {
          title: state.lastTitle || '',
          selectedTitle: state.lastSelectedTitle || '',
          body: state.lastBody || getBodyText(),
          lead: state.lastLead || getFieldValue(CONFIG.fields.lead),
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

    // Click on title option label
    panelEl.querySelectorAll('.seo-gem-title-option').forEach(label => {
      label.onclick = (e) => {
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

    // Inner function for calling generate API (used for auto-retry)
    async function callGenerate() {
      const data = await apiCall('/api/cms/generate', {
        title,
        selectedTitle,
        body: bodyText,
        lead,
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
    } catch (err) {
      state.error = err.message || t.errorGenerate;
      state.phase = 'titles'; // Go back to title selection
    }
    render();
  }

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

    // Find insertion point — try to place after the body editor or before SEO Title field
    const seoTitleField = document.querySelector(CONFIG.fields.seoTitle);
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

    console.log('[SEO GEM] Initialized. Editor:', CONFIG.editorType, '| API:', CONFIG.apiBase, '| Language:', CONFIG.language);
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already loaded, but wait a tick for CKEditor to initialize
    setTimeout(init, 500);
  }
})();
