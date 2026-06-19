# SEO GEM — API Reference

## Autentifikacija

### CMS API endpoints:
```
Header: Authorization: Bearer <CMS_API_KEY>
```
Ključevi su portal-specifični (env: `CMS_API_KEY_NEWSMAX`, `CMS_API_KEY_NEWSMAX_AL`, itd.)

### Admin API endpoints:
```
Query: ?admin_key=<ADMIN_PASSWORD>
```

### Cron endpoint:
```
Header: Authorization: Bearer <CRON_SECRET>
```
Ili admin auth kao fallback.

---

## CMS Endpoints

### POST `/api/cms/titles`

Generiše 6 SEO naslova za članak.

**Headers:**
- `Authorization: Bearer <CMS_API_KEY>` (obavezno)
- `Content-Type: application/json`

**Body:**
```json
{
  "url": "https://newsmaxbalkans.com/...",    // URL članka (obavezno)
  "text": "Tekst članka...",                  // Opciono, koristi se ako URL ekstrakcija ne uspe
  "language": "sr"                            // Opciono, auto-detect po portalu
}
```

**Response (200):**
```json
{
  "success": true,
  "portal_id": "newsmax",
  "titles": [
    { "text": "Naslov opcija 1", "style": "informativni", "length": 56, "reasoning": "CoT..." },
    { "text": "Naslov opcija 2", "style": "informativni", "length": 58, "reasoning": "..." },
    { "text": "Pitanje za AI Overviews?", "style": "geo_pitanje", "length": 52, "reasoning": "..." },
    { "text": "Još jedno pitanje?", "style": "geo_pitanje", "length": 54, "reasoning": "..." },
    { "text": "Discover hook naslov", "style": "discover_hook", "length": 60, "reasoning": "..." },
    { "text": "Još jedan Discover", "style": "discover_hook", "length": 62, "reasoning": "..." }
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
- `401` — Nevažeći API ključ
- `400` — Nedostaje URL ili tekst kraći od 100 karaktera
- `422` — Jezička validacija neuspešna posle retry-a
- `500` — LLM ili server greška

---

### POST `/api/cms/generate`

Generiše meta opis, ključne reči i schema markup za izabrani naslov.

**Headers:**
- `Authorization: Bearer <CMS_API_KEY>`
- `Content-Type: application/json`

**Body:**
```json
{
  "url": "https://newsmaxbalkans.com/...",
  "selectedTitle": "Izabrani naslov članka",
  "selection_type": "ai_selected",              // ili "custom_new"
  "text": "Tekst članka..."                     // Opciono
}
```

**Response (200):**
```json
{
  "success": true,
  "llmFailed": false,
  "seoTitle": "Izabrani naslov članka",
  "metaDescription": "Meta opis do 160 karaktera...",
  "keywords": "ključna reč 1, ključna reč 2, ...",
  "schemaMarkup": "{ \"@context\": \"https://schema.org\", ... }"
}
```

**Timeout:** Max `55 sekundi` (Vercel Pro limit: 60s)

---

## Analysis Endpoints

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

## Admin Analytics Endpoints

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

Pokreće sinhronizaciju GSC i GA4 podataka.

**Parametri:**
| Param | Tip | Default | Opis |
|---|---|---|---|
| `admin_key` | string | — | Ili `CRON_SECRET` header |
| `portal` | string | svi | Specifičan portal |
| `days` | number | `1` | Broj dana za sync (max 30) |

---

## Utility Endpoints

### GET `/api/health`
```json
{ "ok": true, "uptimeSec": 0, "serverTime": "2026-06-18T23:39:57Z", "version": "2.0" }
```

### GET `/api/models`
Lista dostupnih LLM modela po provajderu.
