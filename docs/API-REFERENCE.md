# SEO GEM — API Reference

> **Ažurirano 3.11.2026:** Usklađeno sa stvarnim kodom u `src/app/api/**` (ukupno **16 API ruta**).

## Autentifikacija

### CMS API endpoints (`/api/cms/*`):
```
Header: Authorization: Bearer <CMS_API_KEY>
```
Ključevi su portal-specifični (env: `CMS_API_KEY_NEWSMAX`, `CMS_API_KEY_NEWSMAX_AL`, `CMS_API_KEY_NEWSMAX_PL`, itd.). CORS u `corsHeaders()` proverava origin prema whitelist-i backoffice domena i dozvoljava `GET, POST, PATCH, OPTIONS`.

### Admin API endpoints (`/api/admin/*`):
```
Query: ?admin_key=<ADMIN_PASSWORD>
```

### Cron endpoint (`/api/admin/analytics/sync`):
```
Header: Authorization: Bearer <CRON_SECRET>
```
Ili admin auth (`?admin_key=<ADMIN_PASSWORD>`) kao fallback za ručni poziv.

---

## CMS Endpoints

### POST `/api/cms/titles`

Generiše 6 SEO naslova za članak na osnovu teksta članka iz CMS editora.

**Headers:**
- `Authorization: Bearer <CMS_API_KEY>` (obavezno)
- `Content-Type: application/json`

**Body:**
```json
{
  "body": "Tekst članka (obavezno, min 100 karaktera)...",
  "title": "Postojeći naslov članka (opciono)",
  "lead": "Uvodni/lead tekst članka (opciono)",
  "language": "sr" // Opciono ('sr'|'pl'|'sq'|'en'), podrazumevano po portalu iz API ključa
}
```
*(Napomena: Ranija dokumentacija pominjala je `"url"` i `"text"` kao parametre — to je zastarelo; endpoint čita `"body"`, `"title"`, `"lead"` i `"language"`.)*

**Response (200):**
```json
{
  "success": true,
  "portal_id": "newsmax",
  "titles": [
    { "text": "Naslov opcija 1", "style": "informativni", "length": 56, "reasoning": "CoT..." },
    { "text": "Naslov opcija 2", "style": "informativni", "length": 58, "reasoning": "..." },
    { "text": "Pitanje za AI Overviews?", "style": "geo_pitanje", "length": 52, "reasoning": "..." },
    { "text": "Izjavni odgovor za AI Overviews", "style": "geo_pitanje", "length": 54, "reasoning": "..." },
    { "text": "Discover hook naslov", "style": "discover_hook", "length": 60, "reasoning": "..." },
    { "text": "Tema: Još jedan Discover", "style": "discover_hook", "length": 62, "reasoning": "..." }
  ],
  "usedRAG": true,
  "languageValidation": {
    "expected": "sr",
    "detected": "sr",
    "validated": true
  }
}
```

**Greške:**
- `401` — Nevažeći ili nedostajući API ključ (`Authorization: Bearer`)
- `400` — Nedostaje `body` ili je tekst kraći od 100 karaktera
- `422` — Jezička validacija neuspešna posle retry-a
- `500` — LLM ili server greška

---

### POST `/api/cms/generate`

Generiše meta opis, ključne reči i Schema.org markup za izabrani naslov i čuva izbor u `title_history`.

**Headers:**
- `Authorization: Bearer <CMS_API_KEY>` (obavezno)
- `Content-Type: application/json`

**Body:**
```json
{
  "selectedTitle": "Izabrani naslov članka (obavezno)",
  "body": "Tekst članka (obavezno, min 100 karaktera)...",
  "title": "Originalni naslov članka (opciono)",
  "lead": "Uvodni/lead tekst (opciono)",
  "offeredTitles": [ ... ],                       // Opciono: niz od 6 ponuđenih naslova
  "articleId": "57081",                           // Opciono: numerički ID članka (4+ cifre)
  "articleUrl": "https://newsmaxbalkans.com/...", // Opciono: javni URL članka (backoffice URL se odbacuje)
  "authorName": "Ime autora (opciono)",
  "articleSection": "Rubrika/kategorija (opciono)",
  "language": "sr"                                // Opciono ('sr'|'pl'|'sq'|'en')
}
```
> **Napomena:** Parametar `selection_type` se **ne šalje** iz embed skripte — server ga automatski određuje preko `classifySelection(selectedTitle, offeredTitles)` kao `ai_option_1..6` ili `custom`.

**Response (200):**
```json
{
  "success": true,
  "llmFailed": false,
  "seoTitle": "Izabrani naslov članka",
  "metaDescription": "Meta opis do 160 karaktera...",
  "keywords": "ključna reč 1, ključna reč 2, ...",
  "schemaMarkup": "<script type=\"application/ld+json\">{ \"@context\": \"https://schema.org\", ... }</script>",
  "titleHistoryId": 12345
}
```

**Timeout:** Max `55 sekundi` (Vercel Pro limit: 60s)

---

### PATCH `/api/cms/update-article-id`

Naknadno upisuje `article_id` (i javni `article_url`) u `title_history` zapis kada novinar sačuva prethodno kreiran članak.

**Headers:**
- `Authorization: Bearer <CMS_API_KEY>` (obavezno)
- `Content-Type: application/json`

**Body:**
```json
{
  "title_history_id": 12345,
  "article_id": "57081",
  "article_url": "https://newsmaxbalkans.com/vesti/..." // Opciono (čuva se samo javni http(s) URL bez 'backoffice'/'cubesdev', inače se ne menja)
}
```

**Response (200):**
```json
{
  "success": true,
  "updated": true
}
```

**Greške:**
- `401` — Nedostaje ili je nevažeći `Authorization: Bearer <CMS_API_KEY>`
- `400` — Nedostaju `title_history_id` ili `article_id`, ili `article_id` nije numerički ID (4+ cifara)
- `404` — `{ "success": false, "error": "not found or already linked" }` (zapis ne postoji, ne pripada portalu iz API ključa, ili već ima upisan `article_id`)
- `500` — Greška pri upisu u bazu

---

## Analysis Endpoints (Web UI)

### POST `/api/analyze-text`

Kompletna SEO analiza teksta sa TF-IDF, LSA i LLM generisanjem.

**Headers:**
- `Content-Type: application/json`

**Body:**
```json
{
  "text": "Tekst za analizu...",
  "title": "Opcioni naslov",
  "provider": "gemini",          // Opciono: "openai" | "gemini"
  "model": "gemini-2.5-flash"   // Opciono
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "tfidfAnalysis": { ... },
    "lsaAnalysis": { ... },
    "searchIntent": "informational",
    "summary": {
      "mainTopics": ["..."],
      "keyTerms": ["..."],
      "readabilityScore": 72,
      "conceptStrength": 0.85,
      "recommendedFocus": "..."
    },
    "seoOutputs": {
      "title": "...",
      "metaDescription": "...",
      "keywordsLine": "...",
      "schemaMarkup": "...",
      "markdown": "..."
    },
    "authorMetrics": {
      "wordCount": 1500,
      "readingTimeMin": 6,
      "avgSentenceLength": 18,
      "typeTokenRatio": 0.72
    }
  }
}
```

---

### POST `/api/generate-title-options`

Generiše 6 varijanti naslova u Web UI interfejsu (`/`) i opciono čuva izbor u `title_history`.

---

### POST `/api/extract-content`

Ekstrakcija i čišćenje sadržaja sa URL-a.

**Body:**
```json
{
  "url": "https://newsmaxbalkans.com/vesti/..."
}
```

**Response (200):**
```json
{
  "title": "Naslov članka",
  "content": "Čist tekst članka...",
  "metadata": { "author": "...", "date": "..." },
  "wordCount": 1500,
  "cleanText": "Tekst bez HTML-a..."
}
```

**Ekstrakcija redosled:**
1. JSON-LD `articleBody` (najpreciznije)
2. Mozilla Readability (fallback)
3. Selector heuristics (poslednji fallback)

---

## Admin Analytics & OAuth Endpoints

### GET `/api/admin/analytics/overview`

Pregled metrika za sve portale.

**Parametri:**
| Param | Tip | Default | Opis |
|---|---|---|---|
| `admin_key` | string | — | Admin lozinka (obavezno) |
| `start` | date | 7 dana unazad | Početak perioda (YYYY-MM-DD) |
| `end` | date | danas | Kraj perioda (YYYY-MM-DD) |

**Response:**
```json
{
  "success": true,
  "period": { "start": "2026-06-12", "end": "2026-06-18" },
  "portals": [{
    "portal_id": "newsmax",
    "portal_name": "Newsmax Balkans SR",
    "seo_gem_articles_period": 448,
    "seo_gem_articles_total": 2071,
    "gsc": { "total_impressions": 384093, "total_clicks": 20751, "ctr": 5.4 },
    "ga4": {
      "pageviews": 89075,
      "sessions": 81849,
      "gem_pageviews": 37645,
      "gem_pageviews_pct": 42.3,
      "gem_organic_direct_views": 33670,
      "gem_organic_direct_pct": 89.4
    }
  }]
}
```

---

### GET `/api/admin/analytics/articles`

Per-article analitika za SEO GEM članke.

**Parametri:**
| Param | Tip | Default | Opis |
|---|---|---|---|
| `admin_key` | string | — | Obavezno |
| `portal` | string | `newsmax` | Portal ID |
| `start` / `end` | date | 7 dana | Period |
| `limit` | number | `50` | Max članaka |
| `offset` | number | `0` | Paginacija |

---

### GET `/api/admin/analytics/operations`

Operativna analitika generisanja iz `generation_log` tabele (broj generisanja, uspešnost, latencija, greške po portalu) za Operations tab u Admin Dashboard-u.

**Parametri:** `admin_key` (obavezno), `portal` (opciono), `days` (default `7`).

---

### GET `/api/admin/analytics/status`

Status konekcija i poslednji sync.

**Response:**
```json
{
  "success": true,
  "portals": [{
    "portal_id": "newsmax",
    "gsc_connected": true,
    "ga4_connected": true,
    "last_gsc_sync_at": "2026-06-15T00:05:23+00:00",
    "last_ga4_sync_at": "2026-06-15T00:05:28+00:00"
  }]
}
```

---

### GET `/api/admin/analytics/sync`

Pokreće sinhronizaciju GSC i GA4 podataka, upis dnevnog zbira celog sajta u `site_gsc_daily` i dnevni `backfillArticleIds()` (`maxDuration = 300`).

**Parametri:**
| Param | Tip | Default | Opis |
|---|---|---|---|
| `admin_key` | string | — | Ili `Authorization: Bearer <CRON_SECRET>` header |
| `portal` | string | svi | Specifičan portal |
| `days` | number | `1` | Broj dana za sync (max 30) |
| `date` | string | — | Specifičan datum za backfill (`YYYY-MM-DD`). Ako je dat, GSC i GA4 sync-uju taj datum umesto relativnog izračuna |
| `only` | string | — | Opciono: `site_totals` — izvršava SAMO `fetchGSCSiteTotals` + upsert u `site_gsc_daily` (bez stranica, bez GA4, bez backfill-a) |

**Odgovor:** Uključuje `summary.duration_ms`, a u `results[]` za svaki portal `duration_ms` i u `gsc[]` polja `sitePages` (`{ web, discover }`) i `siteTotals` (`{ web, discover }`).

---

### GET `/api/admin/oauth/start` i GET `/api/admin/oauth/callback`

Pokretanje Google OAuth 2.0 toka (`?portal=<portal_id>&admin_key=...`) i callback ruta za čuvanje `refresh_token`-a u `portal_analytics_config`.

---

### GET `/api/admin/migrate`

Pomoćna admin ruta (`?admin_key=...`) za proveru prisustva analitičkih `_pv` kolona u `article_ga4_metrics`.

---

## Utility Endpoints

### GET `/api/health`
```json
{ "ok": true, "uptimeSec": 0, "serverTime": "2026-06-18T23:39:57Z", "version": "2.0" }
```

### GET `/api/models`
Lista dostupnih LLM modela po provajderu.

*(Napomena: Rute `/api/llm-test` i `/api/self-check` pominjane u nekim starijim beleškama **ne postoje** u kodu.)*
