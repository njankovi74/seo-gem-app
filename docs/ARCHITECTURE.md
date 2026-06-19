# SEO GEM — Arhitektura sistema

## Pregled

SEO GEM je AI-powered SEO asistent za novinarske portale. Generiše optimizovane naslove, meta opise i ključne reči koristeći NLP analizu i LLM (Gemini/OpenAI), a zatim prati performanse članaka kroz Google Search Console i Google Analytics 4.

```
┌─────────────────────────────────────────────────────────────┐
│                         SEO GEM                             │
│                                                             │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │  Web UI  │  │ CMS API  │  │Admin Dash│  │ Cron Sync  │  │
│  │  (/)     │  │(/api/cms)│  │ (/admin) │  │ (3h UTC)   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘  │
│       │              │             │               │         │
│  ┌────┴──────────────┴─────────────┴───────────────┴──────┐ │
│  │                  Next.js 16 API Routes                 │ │
│  │  analyze-text │ extract-content │ generate-title       │ │
│  │  cms/titles   │ cms/generate    │ admin/analytics/*    │ │
│  └────┬──────────────┬─────────────┬───────────────┬──────┘ │
│       │              │             │               │         │
│  ┌────┴────┐  ┌──────┴─────┐  ┌───┴───┐  ┌───────┴──────┐ │
│  │TF-IDF   │  │ Gemini 2.5 │  │OpenAI │  │ Google APIs  │ │
│  │LSA      │  │ Flash      │  │Embed. │  │ GSC + GA4    │ │
│  │NLP      │  │ (naslovi)  │  │(RAG)  │  │ (analitika)  │ │
│  └─────────┘  └────────────┘  └───┬───┘  └──────────────┘ │
│                                    │                        │
│  ┌─────────────────────────────────┴───────────────────────┐│
│  │              Supabase (PostgreSQL)                       ││
│  │  title_history │ article_gsc_metrics │ article_ga4_metrics│
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Tehnički stack

| Komponenta | Tehnologija | Verzija |
|---|---|---|
| Framework | Next.js (App Router) | 16.2 |
| Jezik | TypeScript | 6.x |
| UI | React + Tailwind CSS | 19.2 / 4.x |
| LLM (primarni) | Google Gemini | 2.5 Flash |
| LLM (embeddings) | OpenAI | text-embedding-3-small |
| NLP | natural (TF-IDF), custom LSA | 8.1 |
| Ekstrakcija | Cheerio + Axios + Readability | — |
| Baza | Supabase (PostgreSQL) | Free Tier |
| Deploy | Vercel | Pro (Cron) |
| OAuth | Google OAuth 2.0 | — |

---

## Moduli i odgovornosti

### API Routes (13):

| Ruta | Metoda | Opis |
|---|---|---|
| `/api/extract-content` | POST | Ekstrakcija teksta iz URL-a (Cheerio/Readability) |
| `/api/analyze-text` | POST | TF-IDF + LSA analiza + SEO generisanje |
| `/api/generate-title-options` | POST | AI generisanje 6 varijanti naslova |
| `/api/cms/titles` | POST | CMS endpoint — generisanje naslova za CMS |
| `/api/cms/generate` | POST | CMS endpoint — kompletno SEO generisanje |
| `/api/admin/analytics/overview` | GET | Pregled metrika po portalima |
| `/api/admin/analytics/articles` | GET | Per-article analitika (samo SEO GEM) |
| `/api/admin/analytics/status` | GET | Status konekcija i poslednji sync |
| `/api/admin/analytics/sync` | GET | Pokretanje GSC + GA4 sinhronizacije |
| `/api/admin/oauth/start` | GET | Pokretanje Google OAuth flow-a |
| `/api/admin/oauth/callback` | GET | OAuth callback — čuvanje tokena |
| `/api/health` | GET | Health check |
| `/api/models` | GET | Lista dostupnih LLM modela |

### Lib moduli (15):

| Modul | Opis | Ključne funkcije |
|---|---|---|
| `tfidf-analyzer.ts` | TF-IDF analiza za srpski | `analyzeTFIDF()` |
| `lsa-analyzer.ts` | LSA semantička analiza | `analyzeLSA()`, search intent |
| `seo-output.ts` | SEO generisanje (LLM) | `buildSEOWithLLM()` |
| `title-history.ts` | RAG sa embeddings | `getSimilarTitleExamples()`, `analyzePattern()` |
| `keyword-prioritizer.ts` | Long-tail keyword ranking | `prioritizeKeywords()` |
| `language-validator.ts` | Detekcija jezika (franc) | `validateLanguage()` |
| `google-suggest.ts` | Google Autocomplete | `getGoogleSuggestions()` |
| `ga4-pull.ts` | GA4 Data API sync | `syncGA4ForPortal()` |
| `gsc-pull.ts` | Search Console sync | `syncGSCForPortal()` |
| `google-oauth.ts` | OAuth token management | `getAccessToken()` |
| `cms-auth.ts` | CMS API autentifikacija | `authenticateCMS()` |
| `admin-auth.ts` | Admin password auth | `authenticateAdmin()` |
| `author-metrics.ts` | Autorske metrike | `calculateAuthorMetrics()` |
| `author-recommendations.ts` | SEO preporuke | `generateRecommendations()` |
| `supabase.ts` | DB klijent singleton | `getSupabase()` |

---

## Tok podataka

### 1. Generisanje naslova (CMS flow):
```
CMS → /api/cms/titles (x-api-key auth)
  → Ekstrakcija teksta iz URL
  → TF-IDF + LSA analiza
  → RAG: 5 sličnih primera iz title_history
  → Google Autocomplete suggestions
  → Gemini 2.5 Flash prompt (6 varijanti)
  → Novinar bira naslov
  → Čuvanje u title_history + OpenAI embedding
```

### 2. Analytics sync (dnevni cron):
```
Vercel Cron (3h UTC) → /api/admin/analytics/sync
  → Za svaki portal:
    → GSC API: impressions, clicks, queries (kasni 2-3 dana)
    → GA4 API: pageviews, sessions, traffic sources (kasni 1 dan)
    → Upsert u Supabase (paginiran, 1000/stranica)
```

### 3. Dashboard prikaz:
```
Admin → /admin (password auth)
  → /api/admin/analytics/overview
    → Fetch ALL title_history (paginiran)
    → Fetch ALL ga4_metrics za period (paginiran)
    → ID matching (regex /\d{4,}/)
    → Agregacija: site-wide + GEM-only + Organic+Direct
```

---

## Environment varijable

| Varijabla | Opis | Obavezna |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API ključ | ✅ |
| `OPENAI_API_KEY` | OpenAI API ključ (embeddings) | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon ključ | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role ključ | ✅ |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth klijent ID | ✅ |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth secret | ✅ |
| `ADMIN_PASSWORD` | Admin dashboard lozinka | ✅ |
| `CMS_API_KEY_NEWSMAX` | CMS API ključ za Newsmax SR | ✅ |
| `CMS_API_KEY_NEWSMAX_AL` | CMS API ključ za Newsmax AL | ✅ |
| `CMS_API_KEY_NEWSMAX_PL` | CMS API ključ za Newsmax PL | ✅ |
| `APP_API_TOKEN` | Token za javne API-je | ✅ |
| `SEO_LLM_PROVIDER` | LLM provajder (`gemini`) | Opciona |
| `SEO_LLM_REQUIRED` | Da li LLM mora uspeti (`true`) | Opciona |
| `SEO_LLM_STRICT_MODEL` | Bez fallback modela (`true`) | Opciona |
| `SEO_DUAL_LLM` | Dual LLM A/B test (`false`) | Opciona |

---

## i18n Podrška

| Jezik | Kod | Fajl | Portal |
|---|---|---|---|
| Srpski (latinica) | `sr` | `src/lib/i18n/sr.json` | Newsmax Balkans SR |
| Albanski | `sq` | `src/lib/i18n/sq.json` | Newsmax Balkans AL |
| Poljski | `pl` | `src/lib/i18n/pl.json` | Newsmax Polska |
| Engleski | `en` | `src/lib/i18n/en.json` | (fallback) |
