# SEO GEM — Procedura ubacivanja novog portala

> **REFERENTNI DOKUMENT** — Ova procedura je definitivna i važi za sve buduće integracije.
> Poslednje ažuriranje: 2026-06-22

---

## Pregled

SEO GEM se integriše sa CMS sistemima novinskih portala putem **embed linka**. Mi isporučujemo gotov URL ka našem widgetu, CMS developer ga ugradi kao dugme u svoj editor, i kompletnu logiku (analiza, generisanje naslova, meta opis, keywords, schema) radi naš widget.

**CMS developer NE piše svoju logiku za generisanje.** On samo:
1. Dodaje SEO polja u editor
2. Ugrađuje naš embed link kao dugme
3. Povezuje povratne podatke iz widgeta sa CMS poljima

---

## Arhitektura integracije

```
┌─────────────────────────────────────────────────┐
│                   CMS EDITOR                     │
│                                                  │
│  [Title] [Intro] [Content editor...]             │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │  [SEO GEM dugme] ← embed link ka widgetu   │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌─ SEO POLJA (nova, dodaje CMS dev) ──────────┐│
│  │  SEO Title:        [________________]       ││
│  │  Meta Description: [________________]       ││
│  │  Keywords:         [________________]       ││
│  │  Schema Markup:    [________________]       ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
          │                         ▲
          │ klik na dugme           │ povratni podaci
          ▼                         │
┌─────────────────────────────────────────────────┐
│              SEO GEM WIDGET (naš)                │
│                                                  │
│  1. Preuzima tekst članka                        │
│  2. TF-IDF + LSA + Google Suggest analiza        │
│  3. RAG: 5 sličnih primera iz prethodnih izbora  │
│  4. Gemini 2.5 Flash generiše 6 naslova          │
│  5. Novinar bira naslov ili upisuje svoj         │
│  6. Generiše Meta Description + Keywords + Schema│
│  7. Vraća rezultate CMS-u                        │
└─────────────────────────────────────────────────┘
          │                         ▲
          ▼                         │
┌─────────────────────────────────────────────────┐
│            SEO GEM BACKEND API                   │
│                                                  │
│  POST /api/cms/titles   → 6 naslova             │
│  POST /api/cms/generate → meta, keywords, schema│
│                                                  │
│  Auth: Authorization: Bearer <API_KEY>           │
│  CORS: whitelistovan domen CMS backoffice-a      │
└─────────────────────────────────────────────────┘
```

---

## Checklist za novi portal (korak po korak)

### FAZA 1: Priprema (naša strana)

- [ ] **1.1 Generisati API ključ** za novi portal
  - Format: `sk_cms_<portal_id>_<random>`
  - Dodati u Vercel env kao `CMS_API_KEY_<PORTAL_ID>=<ključ>`
  - Primer: `CMS_API_KEY_INSAJDER=sk_cms_insajder_abc123xyz`

- [ ] **1.2 Registrovati portal u kodu**
  - `src/lib/cms-auth.ts` → dodati CORS domene u `corsHeaders()` allowed listu
  - `src/app/api/cms/titles/route.ts` → dodati u `portalLangMap` (portal_id → jezik)
  - `src/app/api/cms/generate/route.ts` → dodati u `PUBLISHER_INFO` (name, logoUrl, domain)
  - `src/app/admin/page.tsx` → dodati u `PORTAL_DISPLAY` (emoji, label, flagCode)

- [ ] **1.3 Dodati u Admin Dashboard**
  - Landing page kartica za novi portal
  - Analytics tracking (GSC + GA4 property ID-evi)

- [ ] **1.4 Generisati embed link**
  - URL format: `https://<naš-domen>/embed/<portal_id>`
  - Ili direktan link ka SEO GEM widget-u sa portal parametrom

- [ ] **1.5 Pripremiti tehničku dokumentaciju za CMS tim**
  - Embed link URL
  - API ključ
  - Specifikacija SEO polja (tip, max dužina, HTML rendering)
  - Primer callback mehanizma

### FAZA 2: Zahtevi od CMS developera

- [ ] **2.1 Dodati 4 nova SEO polja u editor članka:**

| Polje | Tip | Max dužina | HTML rendering |
|---|---|---|---|
| SEO Title | text input | 70 karaktera | `<title>{value}</title>` |
| Meta Description | textarea | 160 karaktera | `<meta name="description" content="{value}">` |
| Keywords | text input | 300 karaktera | `<meta name="keywords" content="{value}">` |
| Schema Markup | textarea (VIDLJIVO) | — | `<script type="application/ld+json">{value}</script>` |

> **VAŽNO:** Schema Markup polje MORA biti vidljivo u editoru, ne hidden.
> Urednik mora da vidi generisani markup radi monitoringa i eventualnog redigovanja.

- [ ] **2.2 Ugraditi embed link kao dugme u editor**
  - Dugme ili link u toolbar-u/sidebar-u editora
  - Otvara naš SEO GEM widget

- [ ] **2.3 Implementirati callback mehanizam**
  - Kako widget vraća podatke nazad u CMS polja
  - Opcije: `postMessage`, URL parametri, direktan zapis

- [ ] **2.4 Dostaviti nam CORS domen**
  - Tačan URL admin panela (npr. `https://admin.insajder.net`, `https://insajder.mpanel.app`)
  - I development/staging domen ako postoji

### FAZA 3: Integracija

- [ ] **3.1 Dodati CORS domen u `cms-auth.ts`**
- [ ] **3.2 Deploy na Vercel** (env varijable + kod)
- [ ] **3.3 Testirati embed link** sa CMS developerom
- [ ] **3.4 Testirati kompletni flow:**
  - Novinar klikne dugme → widget se otvara
  - Tekst članka se preuzima → 6 naslova se prikazuje
  - Novinar bira naslov → meta/keywords/schema se generišu
  - Podaci se vraćaju u CMS polja
  - Polja se renderuju u `<head>` objavljenog članka

### FAZA 4: Verifikacija

- [ ] **4.1 Proveriti da se SEO polja renderuju na live sajtu**
  - Otvoriti objavljen članak → View Source → proveriti `<title>`, `<meta>`, `<script type="application/ld+json">`
- [ ] **4.2 Google Rich Results Test** — proveriti da Schema Markup prolazi validaciju
- [ ] **4.3 Dodati portal u GSC i GA4 sinhronizaciju** (Admin Dashboard)
- [ ] **4.4 Verifikovati da se podaci pojavljuju u Admin Dashboard-u**

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
4. Pravi mapu: ključ → portal_id (npr. `sk_cms_newsmax_xxx` → `newsmax`)
5. Iz header-a čita: `Authorization: Bearer <ključ>`
6. Ako ključ postoji u mapi → autorizovan, vraća portal_id
7. Ako ne → 401 Unauthorized

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
| 2026-05-xx | Newsmax SR, AL, PL | Cubes d.o.o. | Prva integracija. Cubes ugradio embed link u svoj CMS. |
| 2026-06-22 | Insajder.net | Appworks (Nikola Janković) | Inicijalni kontakt. mPanel CMS — potrebna nova SEO polja + embed link. |
