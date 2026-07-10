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
    - `fetchGA4Data()` — pageviews (screenPageViews metrika), sessions, engagement, bounce rate, pages/session
    - `fetchGA4TrafficSources()` — organic_pct, direct_pct, social_pct per page + apsolutne `_pv` kolone
    - `fetchGA4Countries()` — top 20 zemalja po sesijama
    - Batch upsert u `article_ga4_metrics` (po 100 redova)
    - **VAŽNO:** Koristi `screenPageViews` (ne sessions) za tačne pageview brojeve. Verifikovano sa GA4 UI za 3 članka (jul 2026).

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
`title_history` čuva URL članaka, ali embed widget nije hvatao article_id pre jula 2026. Takođe, novinari često koriste SEO GEM PRE čuvanja članka (URL je `/articles/new`), pa nema ID-a.

### Rešenje — 4-strategija matching (v4, jul 2026):

**Strategy 0 — Direktni article_id (novi zapisi od jul 2026, 100% tačno):**
```
title_history.article_id = "57081"  →  direktan join sa GSC/GA4 po ID-u
```
`cms-embed.js` ima 5 fallback paterna za ID ekstrakciju (URL varijante, DOM fields, form action).

**Strategy 1 — Retroaktivni backfill putem title→slug matching (88% tačno):**
```
selected_title → transliteracija (š→s, đ→d, č→c, ć→c, ž→z) → slug → pretraga GA4 URL-ova
```
Skripta `backfill-article-ids.mjs` konvertuje naslov u URL slug, traži poklapanje u GA4 podacima.
Izvršen jul 2026: **2,993/3,402 zapisa povezano (88%)**.

**Strategy 2 — Slug validation (stari zapisi, ~75% tačno):**
```
title_history.article_url → extractSlug() → slugMatchScore(title, slug) ≥ 0.25
```

**Strategy 3 — Inverted index search (fallback, ~70%):**
```
titleWords → slugWordIndex → kandidati sa 2+ poklapanja → best score
```

### ID ekstrakcija:
```
Regex: /\/(\d{4,})\//  →  "57081"
```

### CMS Embed ID Extraction (`cms-embed.js`, 5 paterna):
1. `/articles/57081/edit` — sa trailing slash
2. `/articles/57081` — bez trailing slash
3. `/DIGITS/` — bilo gde u URL-u (4+ cifre)
4. DOM hidden fields: `article_id`, `id`, `post_id`, `content_id`
5. Form action URL: `form[action*="/articles/"]`

> **POZNATI PROBLEM:** Kad novinar koristi SEO GEM pre čuvanja članka, URL je `/articles/new` i nijedan patern ne hvata ID. Potreban URL monitor koji prati promenu URL-a posle čuvanja. **STATUS: TODO**

### Organic + Direct kalkulacija (apsolutni PV, v2):
```typescript
// Novi pristup — koristi apsolutne _pv kolone umesto procenata
gemOrganicViews += row.organic_pv;
gemDirectViews += row.direct_pv;
```

### Kumulativni obračun SEO GEM doprinosa:
```
Za svaki dan D:
1. Uzmi SVE title_history zapise gde created_at < D+1 (kumulativno od početka)
2. Izvuči unique article_id-jeve
3. Iz article_ga4_metrics za dan D, saberi PV/Organic/Direct za te članke
4. Udeo = SEO_GEM_PV / SAJT_TOTAL_PV
```
**Rezultat (jul 1-9):** ~60% sajta, 14.7% Organic, 17.7% Direct

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
| pageviews | INT | Broj pregleda (screenPageViews) |
| sessions | INT | Broj sesija |
| avg_engagement_seconds | FLOAT | Prosečno vreme na stranici |
| bounce_rate | FLOAT | Bounce rate |
| pages_per_session | FLOAT | Stranice po sesiji |
| organic_pct | FLOAT | % Organic Search saobraćaja |
| direct_pct | FLOAT | % Direct saobraćaja |
| social_pct | FLOAT | % Social saobraćaja |
| discover_pct | FLOAT | % Discover saobraćaja |
| **organic_pv** | **INT** | **Apsolutni Organic Search pageviews** |
| **direct_pv** | **INT** | **Apsolutni Direct pageviews** |
| **social_pv** | **INT** | **Apsolutni Social pageviews** |
| **referral_pv** | **INT** | **Apsolutni Referral pageviews** |
| country_breakdown | JSONB | Sesije po zemlji |
| UNIQUE | — | `(portal_id, article_url, date)` |

> **NAPOMENA:** `_pv` kolone dodate jul 2026. Popunjene za jun-jul 2026 putem re-sync-a. Verifikovane sa GA4 UI (3 članka, 100% poklapanje).

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
