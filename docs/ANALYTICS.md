# SEO GEM — Analytics Pipeline

## Pregled

SEO GEM prikuplja analitičke podatke iz dva Google izvora:
- **Google Search Console (GSC)** — kako članci performišu u Google pretrazi
- **Google Analytics 4 (GA4)** — kako korisnici interaguju sa člancima na sajtu

Podaci se sinhronizuju dnevno i prikazuju u Admin Dashboard-u (`/admin`).

---

## Google OAuth konfiguracija

### Portali i njihovi ID-jevi:

| Portal | portal_id | GSC Property | GA4 Property ID |
|---|---|---|---|
| 🇷🇸 Newsmax Balkans SR | `newsmax` | `sc-domain:newsmaxbalkans.com` | `458697039` |
| 🇦🇱 Newsmax Balkans AL | `newsmax_al` | `sc-domain:newsmaxbalkans.al` | `514476912` |
| 🇵🇱 Newsmax Polska | `newsmax_pl` | `sc-domain:newsmaxpolska.pl` | `533108675` |

### OAuth flow:
1. Admin otvara `/api/admin/oauth/start?portal=newsmax&admin_key=...`
2. Redirect na Google Consent Screen (scope: GSC + GA4 readonly)
3. Google vraća code na `/api/admin/oauth/callback`
4. Callback čuva `refresh_token` u `portal_analytics_config` tabeli

### Token refresh:
- `src/lib/google-oauth.ts` — automatski refresh access tokena pre svakog API poziva
- Refresh token ne ističe osim ako korisnik ne revoke-uje pristup

---

## Sinhronizacija podataka

### Cron konfiguracija (`vercel.json`):
```json
{
  "crons": [{
    "path": "/api/admin/analytics/sync",
    "schedule": "0 3 * * *"
  }]
}
```
- **Svaki dan u 3:00 UTC** (5:00 po srpskom vremenu)
- Sinhronizuje podatke za **prethodni dan** (GSC kasni 2-3 dana, GA4 1 dan)

### Sync endpoint: `POST /api/admin/analytics/sync`

Za svaki portal:
1. **GSC Pull** (`src/lib/gsc-pull.ts`):
   - Fetch: impressions, clicks, CTR, avg_position
   - Dimenzije: page URL, search type (web/discover), device
   - Top 5 upita po stranici
   - Upsert u `article_gsc_metrics`

2. **GA4 Pull** (`src/lib/ga4-pull.ts`):
   - `fetchGA4Data()` — pageviews, sessions, engagement, bounce rate, pages/session
   - `fetchGA4TrafficSources()` — organic_pct, direct_pct, social_pct per page
   - `fetchGA4Countries()` — top 20 zemalja po sesijama
   - Batch upsert u `article_ga4_metrics` (po 100 redova)

### Ručni sync:
```
GET /api/admin/analytics/sync?admin_key=<ADMIN_PASSWORD>
GET /api/admin/analytics/sync?admin_key=<ADMIN_PASSWORD>&date=2026-07-04    // backfill specifičnog datuma
GET /api/admin/analytics/sync?admin_key=<ADMIN_PASSWORD>&portal=newsmax     // samo 1 portal
```

> **NAPOMENA:** Vercel cron može da prestane da radi posle novog deploy-a. Proveriti u Vercel Dashboard → Cron Jobs → poslednje pokretanje. Ako je stao, pokrenuti manualni sync za propuštene datume.

### Backfill procedura:
Ako sync nije radio više dana, sync-ovati po 1 dan (Vercel 60s timeout ne dozvoljava `days=7`):
```
?admin_key=***&date=2026-07-04
?admin_key=***&date=2026-07-05
...
```

---

## Admin Dashboard (`/admin`)

### Autentifikacija:
- Lozinka: env varijabla `ADMIN_PASSWORD`
- Šalje se kao `admin_key` query parametar

### Overview tab:
Za svaki portal prikazuje 4 sekcije:

1. **Google Search Console** — Impressions, Clicks, CTR, Discover
2. **GA4 — Ceo sajt** — Ukupni pregledi, sesije, angažman, stranice/sesija
3. **SEO GEM članci — Ukupno** — Pregledi svih GEM članaka (svi izvori saobraćaja)
4. **SEO GEM — Organic + Direct** — Samo saobraćaj pripisiv SEO naslovu

### Članci tab:
- Prikazuje **samo SEO GEM članke** (iz `title_history`)
- Kolone sa source oznakom (GSC/GA4/GEM) i tooltip objašnjenjima
- Organic% i Direct% po članku

---

## SEO GEM Article Matching

### Problem:
`title_history` čuva URL članaka, ali zbog buga u embed widgetu, ~45% starih zapisa ima pogrešan URL. Takođe, `title_history` i `article_ga4_metrics` čuvaju URL-ove u različitim formatima.

### Rešenje — 3-strategija matching (v3, jul 2026):

**Strategy 0 — Direktni article_id (novi zapisi, 100% tačno):**
```
title_history.article_id = "57081"  →  direktan join sa GSC/GA4 po ID-u
```
Od jula 2026, `cms-embed.js` šalje `articleId` kao zasebno polje.

**Strategy 1 — Slug validation (stari zapisi, ~75% tačno):**
```
title_history.article_url → extractSlug() → slugMatchScore(title, slug) ≥ 0.25
```
Validira stored URL tako što poredi ključne reči naslova sa slug-om.

**Strategy 2 — Inverted index search (fallback, ~70%):**
```
titleWords → slugWordIndex → kandidati sa 2+ poklapanja → best score
```
Pretraga svih poznatih slugova iz GSC/GA4 podataka.

### ID ekstrakcija:
```
Regex: /\/(\d{4,})\//  →  "57081"
```

### Portali i zapisi:
| Portal | Zapisi | Opis |
|---|---|---|
| `newsmax` | 591 | Newsmax Balkans SR |
| `newsmax_pl` | 247 | Newsmax Polska |
| `newsmax_al` | 84 | Newsmax Balkans AL |
| `web_app` | 78 | Admin web interfejs |

### Organic + Direct kalkulacija:
```typescript
const orgDirectPct = ((row.organic_pct || 0) + (row.direct_pct || 0)) / 100;
gemOrganicDirectViews += Math.round(row.pageviews * orgDirectPct);
```

---

## Database šema

### `portal_analytics_config`
| Kolona | Tip | Opis |
|---|---|---|
| portal_id | TEXT (PK) | Identifikator portala |
| portal_name | TEXT | Prikazni naziv |
| gsc_property | TEXT | GSC property URL |
| ga4_property_id | TEXT | GA4 property ID |
| gsc_refresh_token | TEXT | OAuth refresh token za GSC |
| ga4_refresh_token | TEXT | OAuth refresh token za GA4 |
| last_gsc_sync_at | TIMESTAMP | Poslednji GSC sync |
| last_ga4_sync_at | TIMESTAMP | Poslednji GA4 sync |

### `article_gsc_metrics`
| Kolona | Tip | Opis |
|---|---|---|
| portal_id | TEXT | Portal |
| article_url | TEXT | URL članka |
| date | DATE | Datum metrike |
| impressions | INT | Broj prikaza u Google pretrazi |
| clicks | INT | Broj klikova |
| ctr | FLOAT | Click-through rate |
| avg_position | FLOAT | Prosečna pozicija |
| search_type | TEXT | `web` ili `discover` |
| top_queries | JSONB | Top 5 upita za tu stranicu |
| UNIQUE | — | `(portal_id, article_url, date, search_type)` |

### `article_ga4_metrics`
| Kolona | Tip | Opis |
|---|---|---|
| portal_id | TEXT | Portal |
| article_url | TEXT | URL članka |
| date | DATE | Datum metrike |
| pageviews | INT | Broj pregleda |
| sessions | INT | Broj sesija |
| avg_engagement_seconds | FLOAT | Prosečno vreme na stranici |
| bounce_rate | FLOAT | Bounce rate |
| pages_per_session | FLOAT | Stranice po sesiji |
| organic_pct | FLOAT | % Organic Search saobraćaja |
| direct_pct | FLOAT | % Direct saobraćaja |
| social_pct | FLOAT | % Social saobraćaja |
| discover_pct | FLOAT | % Discover saobraćaja |
| country_breakdown | JSONB | Sesije po zemlji |
| UNIQUE | — | `(portal_id, article_url, date)` |

---

## Kapacitet i limiti

| Parametar | Limit | Trenutno (jun 2026) |
|---|---|---|
| Supabase DB veličina | 500 MB (Free) | ~18 MB (3.6%) |
| Redova u bazi | Nema limita | ~95.000 |
| Rast/dan | — | ~5.300 redova |
| Procena do limita | — | ~4 godine |
| Supabase API zahtevi | Neograničeno | ~100/dan |
| Supabase bandwidth | 5 GB/mesec | ~0.5 GB |
