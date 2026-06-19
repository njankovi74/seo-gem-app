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
`title_history` i `article_ga4_metrics` čuvaju URL-ove u različitim formatima.

### Rešenje — ID-based matching:
Iz svakog URL-a se izvlači numerički article ID (4+ cifara):

```
title_history:        https://newsmaxbalkans.com/svet/vesti/51543/lek-za-dijabetes.../vest
                                                          ^^^^^
article_ga4_metrics:  /magazin/vesti/51543/lek-za-dijabetes.../vest
                                     ^^^^^
                                     
Regex: /\/(\d{4,})\//  →  "51543"
```

**Match rate:** 92% (695 od 756 SEO GEM članaka za Newsmax SR)

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
