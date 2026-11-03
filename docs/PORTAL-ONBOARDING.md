# SEO GEM — Procedura ubacivanja novog portala

> **REFERENTNI DOKUMENT** — Ova procedura je definitivna i važi za sve buduće integracije.
> Poslednje ažuriranje: 2026-11-03 (usklađeno sa stvarnim `<script>` tag modelom u kodu; raniji opis „embed linka i callback-a" bio je zastareo/netačan)

---

## Pregled

SEO GEM se integriše sa CMS sistemima novinskih portala ugradnjom **jednog `<script>` taga** (`https://seo-gem-app.vercel.app/cms-embed.js`) sa `data-*` atributima u stranicu za uređivanje članka. Nema eksternog „embed linka ka widgetu", nema `iframe`-a i nema callback mehanizma koji CMS developer treba da piše — skripta `cms-embed.js` se izvršava direktno u DOM-u CMS editora i obavlja kompletnu logiku (čitanje teksta, poziv API-ja, prikaz 6 naslova, generisanje i direktan upis u SEO polja, te naknadno hvatanje `article_id`-a).

**CMS developer NE piše svoju logiku za generisanje niti callback funkcije.** On samo:
1. Dodaje 4 SEO polja u editor članka i renderuje ih u `<head>` objavljenog članka
2. Ubacuje jedan `<script src="https://seo-gem-app.vercel.app/cms-embed.js" ...>` tag sa `data-*` atributima
3. Obezbeđuje da URL stranice za uređivanje sačuvanog članka (ili skriveno polje forme) sadrži numerički ID članka (4+ cifre) i dostavlja nam domene backoffice-a (produkcija + staging)

---

## Arhitektura integracije

```
┌─────────────────────────────────────────────────────────────────┐
│                    CMS EDITOR (backoffice)                      │
│                                                                 │
│  [Heading] [Lead] [Body editor: CKEditor 4/5 / TinyMCE / ...]   │
│                                                                 │
│  ┌─ <script src=".../cms-embed.js" data-*> (u istom DOM-u) ───┐ │
│  │  [✨ Generiši SEO sa SEO GEM]                              │ │
│  │  ┌─ Panel sa 6 AI naslova (Informativni / GEO / Discover)┐ │ │
│  │  │  ( ) Predlog 1 ...                                     │ │ │
│  │  │  ( ) Sopstveni: [________________]   [Potvrdi izbor]   │ │ │
│  │  └────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                           │ direktan upis u DOM polja            │
│                           ▼ (+ dispatch 'input'/'change')        │
│  ┌─ SEO POLJA (dodaje CMS dev, vidljiva u editoru) ───────────┐ │
│  │  SEO Title:        [____________________________________]  │ │
│  │  Meta Description: [____________________________________]  │ │
│  │  Keywords:         [____________________________________]  │ │
│  │  Schema Markup:    [____________________________________]  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS (CORS + Bearer <API_KEY>)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SEO GEM BACKEND API                         │
│                                                                 │
│  POST  /api/cms/titles            → 6 naslova                   │
│  POST  /api/cms/generate          → meta, keywords, schema, TH# │
│  PATCH /api/cms/update-article-id → naknadni upis article_id    │
│                                                                 │
│  Auth: Authorization: Bearer <CMS_API_KEY_*>                    │
│  CORS: whitelistovan domen CMS backoffice-a (src/lib/cms-auth)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Checklist za novi portal (korak po korak)

### FAZA 1: Priprema (naša strana)

- [ ] **1.1 Generisati API ključ** za novi portal
  - Format: `sk_cms_<portal_id>_<random>`
  - Dodati u Vercel env kao `CMS_API_KEY_<PORTAL_ID>=<ključ>`
  - Primer: `CMS_API_KEY_INSAJDER=sk_cms_insajder_abc123xyz`

- [ ] **1.2 Registrovati portal u kodu**
  - `src/lib/cms-auth.ts` → dodati CORS domene backoffice-a (produkcija i staging) u `corsHeaders()` allowed listu
  - `src/app/api/cms/titles/route.ts` → dodati u `portalLangMap` (`portal_id` → jezik: `'sr' | 'pl' | 'sq' | 'en'`)
  - `src/app/api/cms/generate/route.ts` → dodati u `PUBLISHER_INFO` (`name`, `logoUrl`, `domain`)
  - `src/lib/backfill-article-ids.ts` → dodati u `PORTAL_DOMAINS` (`portal_id` → javni domen portala)
  - `src/app/admin/page.tsx` → dodati u `PORTAL_DISPLAY` (naziv i oznaka portala za Admin Dashboard)

- [ ] **1.3 Podesiti analitiku za portal (GSC + GA4)**
  - Upisati portal u `portal_analytics_config` tabelu u Supabase-u (`portal_id`, `portal_name`, `gsc_property`, `ga4_property_id`)
  - Povezati Google OAuth nalog kroz `/api/admin/oauth/start?portal=<portal_id>&admin_key=...`

- [ ] **1.4 Pripremiti `<script>` snippet i tehničko uputstvo za CMS tim**
  - Gotov `<script src="https://seo-gem-app.vercel.app/cms-embed.js" ...>` snippet sa `data-*` atributima prilagođenim nazivima polja u njihovom CMS-u
  - Specifikacija 4 SEO polja (tip, max dužina, vidljivost, HTML rendering u `<head>`)

### FAZA 2: Zahtevi od CMS developera

- [ ] **2.1 Dodati 4 SEO polja u editor članka i renderovati ih u `<head>`:**

| Polje | Tip | Max dužina | HTML rendering u `<head>` |
|---|---|---|---|
| SEO Title | text input | 70 karaktera | `<title>{value}</title>` (i `og:title`) |
| Meta Description | textarea | 160 karaktera | `<meta name="description" content="{value}">` |
| Keywords | text input | 300 karaktera | `<meta name="keywords" content="{value}">` |
| Schema Markup | textarea (**VIDLJIVO**) | — | `<script type="application/ld+json">{value}</script>` |

> **VAŽNO:** Schema Markup polje MORA biti vidljivo u editoru, ne hidden.
> Urednik mora da vidi generisani markup radi monitoringa i eventualnog redigovanja.

- [ ] **2.2 Ubaciti `<script>` tag u stranicu za uređivanje članka**
  - Podesiti `data-field-*` atribute tako da odgovaraju CSS selektorima polja u CMS-u i `data-editor-type` (`ckeditor`, `tinymce` ili `textarea`)
  - *(Zastarelo: ne pravi se nikakav callback mehanizam — `cms-embed.js` sam upisuje vrednosti u polja)*

- [ ] **2.3 Obezbediti dostupnost numeričkog ID-a članka (4+ cifre)**
  - U URL-u stranice za uređivanje sačuvanog članka (npr. `/articles/57081/edit`) ili u skrivenom polju forme (`[name="article_id"]`, `[name="id"]`), i u javnom URL-u članka na sajtu (radi povezivanja sa GSC/GA4 analitikom)

- [ ] **2.4 Dostaviti nam domene backoffice-a i testni/staging nalog**
  - Tačan origin admin panela (npr. `https://backoffice.portal.com` i staging domen) radi dodavanja u CORS whitelist (`src/lib/cms-auth.ts`)
  - Testni nalog na staging okruženju za zajedničku verifikaciju

### FAZA 3: Integracija

- [ ] **3.1 Dodati CORS domene i mape portala u kod**
- [ ] **3.2 Lokalni build i test, pa deploy na Vercel** (env varijabla + kod)
- [ ] **3.3 Testirati kompletni flow u staging CMS-u:**
  - Novinar klikne dugme „✨ Generiši SEO sa SEO GEM" → panel se otvara
  - Skripta preuzima tekst članka iz editora → prikazuje se 6 naslova
  - Novinar bira naslov i potvrđuje → meta/keywords/schema se generišu i automatski upisuju u 4 SEO polja
  - Na novom članku (`/articles/new`), nakon što novinar sačuva članak i stranica dobije ID (`/articles/{id}/edit`), skripta iz `localStorage` (`seoGemPending`) automatski šalje `PATCH /api/cms/update-article-id`

### FAZA 4: Verifikacija

- [ ] **4.1 Proveriti da se SEO polja renderuju na live sajtu**
  - Otvoriti objavljen članak → View Source → proveriti `<title>`, `<meta name="description">`, `<meta name="keywords">`, `<script type="application/ld+json">`
- [ ] **4.2 Google Rich Results Test** — proveriti da Schema Markup prolazi validaciju
- [ ] **4.3 Proveriti zapis u `title_history` i `generation_log`** (uključujući `article_id`)
- [ ] **4.4 Verifikovati GSC i GA4 sinhronizaciju u Admin Dashboard-u**

---

## Referenca: Postojeći portali

| Portal | portal_id | CMS | CMS Developer | CORS domeni | Status |
|---|---|---|---|---|---|
| 🇷🇸 Newsmax Balkans SR | `newsmax` | Custom (Cubes) | Cubes d.o.o. | `backoffice.newsmaxbalkans.com`, `backoffice-newsmax.cubesdev.rs` | ✅ Produkcija |
| 🇦🇱 Newsmax Balkans AL | `newsmax_al` | Custom (Cubes) | Cubes d.o.o. | `backoffice.newsmaxbalkans.al`, `backoffice-newsmaxal.cubesdev.rs` | ✅ Produkcija |
| 🇵🇱 Newsmax Polska | `newsmax_pl` | Custom (Cubes) | Cubes d.o.o. | `backoffice.newsmaxpolska.pl`, `backoffice-newsmaxpl.cubesdev.rs` | ✅ Produkcija |
| 🇬🇧 Newsmax EN | `newsmax_en` | Custom (Cubes) | Cubes d.o.o. | (nedefinisan) | ⏳ Priprema |
| 🇷🇸 Insajder.net | `insajder` | mPanel | Appworks (Nikola Janković) | (čeka odgovor) | 🔄 U toku |

---

## Referenca: Autentifikacija

### Kako radi auth:
1. Svaki portal dobija jedinstven API ključ
2. Ključ se čuva u Vercel env varijabli: `CMS_API_KEY_<PORTAL_ID>=<ključ>`
3. `cms-auth.ts` pri svakom API pozivu čita sve env varijable sa prefiksom `CMS_API_KEY_`
4. Pravi mapu: ključ → `portal_id` (npr. `sk_cms_newsmax_xxx` → `newsmax`)
5. Iz header-a čita: `Authorization: Bearer <ključ>`
6. Ako ključ postoji u mapi → autorizovan, vraća `portal_id`
7. Ako ne → `401 Unauthorized`

### ⚠️ NAPOMENA O AUTH HEADER-U:
Kod koristi **`Authorization: Bearer <API_KEY>`**, NE `x-api-key`.
Starija dokumentacija je navodila `x-api-key` — to je **POGREŠNO**.
Referentni fajl: `src/lib/cms-auth.ts`, linija 33-36.

---

## Referenca: Fallback ponašanje

Ako novinar **ne koristi** SEO GEM za neki članak:
- SEO polja ostaju prazna (ili imaju default vrednosti iz CMS-a)
- Postojeći sistem portala (pre SEO GEM-a) ostaje kao fallback
- SEO GEM ne menja ništa što novinar nije eksplicitno potvrdio

---

## Istorija integracija

| Datum | Portal | CMS Dev | Napomene |
|---|---|---|---|
| 2026-05-xx | Newsmax SR, AL, PL | Cubes d.o.o. | Prva integracija. Cubes ugradio `<script src=".../cms-embed.js">` tag u svoj CMS (ranije u dokumentaciji pogrešno opisano kao „embed link"). |
| 2026-06-22 | Insajder.net | Appworks (Nikola Janković) | Inicijalni kontakt. mPanel CMS — potrebna 4 SEO polja + `<script>` tag. |
