# SEO GEM — CMS Integracija

## Pregled

SEO GEM se integriše sa CMS sistemima novinskih portala putem **embed linka**. Mi isporučujemo gotov URL ka našem SEO GEM widgetu. CMS developer ga ugradi kao dugme u editor članka. Kompletnu logiku (analiza teksta, generisanje naslova, meta opis, keywords, schema markup) radi naš widget — CMS developer ne piše svoju logiku za generisanje.

> **Za kompletnu proceduru ubacivanja novog portala videti: [PORTAL-ONBOARDING.md](PORTAL-ONBOARDING.md)**

---

## Portali

| Portal | portal_id | API ključ env | Jezik | Domen | Status | CMS Developer |
|---|---|---|---|---|---|---|
| 🇷🇸 Newsmax Balkans SR | `newsmax` | `CMS_API_KEY_NEWSMAX` | Srpski | newsmaxbalkans.com | ✅ Produkcija (591 zapis) | Cubes d.o.o. |
| 🇦🇱 Newsmax Balkans AL | `newsmax_al` | `CMS_API_KEY_NEWSMAX_AL` | Albanski | newsmaxbalkans.al | ✅ Produkcija (84 zapisa) | Cubes d.o.o. |
| 🇵🇱 Newsmax Polska | `newsmax_pl` | `CMS_API_KEY_NEWSMAX_PL` | Poljski | newsmaxpolska.pl | ✅ Produkcija (247 zapisa) | Cubes d.o.o. |
| 🇷🇸 Insajder.net | `insajder` | `CMS_API_KEY_INSAJDER` | Srpski | insajder.net | ⏳ Čeka se odgovor klijenta | Appworks |

---

## Kako radi integracija (embed link model)

```
Novinar u CMS editoru
        │
        ▼ klikne "SEO GEM" dugme
        │
        ▼ otvara se naš widget (embed link)
        │
        ▼ widget preuzima tekst članka
        │
        ▼ analiza + generisanje 6 naslova
        │
        ▼ novinar bira naslov (ili upisuje svoj)
        │
        ▼ widget generiše meta description, keywords, schema
        │
        ▼ podaci se vraćaju u CMS SEO polja
```

**Ključno:** Widget radi SVE. CMS developer samo:
1. Dodaje 4 SEO polja u editor
2. Ugrađuje naš embed link kao dugme
3. Implementira callback za prihvat povratnih podataka

---

## API Endpoints

### 1. Generisanje naslova: `POST /api/cms/titles`

**Autentifikacija:** `Authorization: Bearer <API_KEY>` header

**Request:**
```json
{
  "body": "(OBAVEZNO) tekst članka — min 100 karaktera",
  "title": "(opciono) postojeći naslov članka",
  "lead": "(opciono) lead/intro tekst",
  "language": "(opciono) 'sr'|'en'|'pl'|'sq' — auto-detektuje se iz portala",
  "articleUrl": "(opciono) URL za logovanje"
}
```

**Response:**
```json
{
  "success": true,
  "titles": [
    { "text": "Dijabetes tip 2: Lek Retatrutid efikasno topi kilograme", "style": "informativni", "length": 56 },
    { "text": "Dijabetes: Novi lek smanjuje težinu efikasnije od operacije", "style": "informativni", "length": 59 },
    { "text": "Da li je Retatrutid lek koji će promeniti lečenje dijabetesa?", "style": "geo_pitanje", "length": 61 },
    { "text": "Kako novi lek za dijabetes pomaže u mršavljenju?", "style": "geo_pitanje", "length": 49 },
    { "text": "Lek koji topi kilograme: Naučnici tvrde da menja pravila igre", "style": "discover_hook", "length": 61 },
    { "text": "Pacijenti sa dijabetesom smršali 24% — evo kako", "style": "discover_hook", "length": 48 }
  ],
  "usedRAG": true,
  "languageValidation": { "expected": "sr", "detected": "sr", "validated": true }
}
```

### 2. SEO generisanje: `POST /api/cms/generate`

**Autentifikacija:** `Authorization: Bearer <API_KEY>` header

**Request:**
```json
{
  "selectedTitle": "(OBAVEZNO) naslov koji je novinar izabrao",
  "body": "(OBAVEZNO) tekst članka — min 100 karaktera",
  "title": "(opciono) originalni naslov",
  "lead": "(opciono) lead tekst",
  "articleUrl": "(opciono) URL objavljenog članka — za metadata scraping",
  "offeredTitles": "(opciono) niz ponuđenih naslova",
  "language": "(opciono) 'sr'|'en'|'pl'|'sq'",
  "selection_type": "(opciono) 'ai_selected' ili 'custom'",
  "authorName": "(opciono) ime autora — za schema markup",
  "articleSection": "(opciono) kategorija — za schema markup"
}
```

**Response:**
```json
{
  "success": true,
  "llmFailed": false,
  "seoTitle": "Dijabetes tip 2: Lek Retatrutid efikasno topi kilograme",
  "metaDescription": "Klinička studija pokazala da lek Retatrutid pomaže pacijentima sa dijabetesom tip 2 da smršaju do 24 procenta telesne mase za godinu dana.",
  "keywords": "dijabetes, retatrutid, mršavljenje, lek za dijabetes, tip 2, klinička studija",
  "schemaMarkup": "<script type=\"application/ld+json\">{ ... Article schema ... }</script>"
}
```

---

## Stilovi naslova

SEO GEM generiše **6 varijanti** — 2 varijacije za svaki od 3 stila:

| Stil | Opis | Primer |
|---|---|---|
| **informativni** | Klasični SEO naslovi. Fokus na glavnom problemu. Fluid, prirodne rečenice — BEZ dvotačke. | "Novi lek za dijabetes efikasno smanjuje telesnu težinu" |
| **geo_pitanje** | Konverzacijska pitanja za AI Overviews i voice search. | "Da li novi lek za dijabetes može zameniti operaciju?" |
| **discover_hook** | E-E-A-T naslovi za Google Discover. Za poznate ličnosti koristi "Ime: tvrdnja" format. | "Lek koji topi kilograme: Naučnici tvrde da menja pravila igre" |

**Pravilo dvotačke:** Od 6 naslova, maksimum 1 sme koristiti format "X: Y". Ostalih 5 moraju biti fluid rečenice ili pitanja.

**Pravilo poznatih ličnosti:** Discover hook koristi ime osobe SAMO ako je javno poznata ličnost (političar, sportista, ministar). Za eksperte/blogere — koristi se opis koristi bez imena.

---

## RAG (Retrieval Augmented Generation)

### Kako radi:
1. Kada widget pozove `/api/cms/titles`, sistem traži **5 sličnih primera** iz prethodnih izbora novinara
2. Primeri se biraju **round-robin** po stilovima iz poslednjih **120 zapisa** za taj portal
3. Ovi primeri se šalju Gemini-ju kao few-shot kontekst
4. Kada novinar izabere naslov, čuva se u `title_history` sa OpenAI embedding-om

### Analiza obrazaca:
- `analyzePattern()` analizira poslednjih **50 izbora** za portal
- Detektuje preferirane obrasce: pitanja, dvotačke, brojevi, emocionalni, imperativni
- Ova analiza se šalje kao deo prompta

### Embedding:
- Model: `text-embedding-3-small` (OpenAI)
- Dimenzije: 1536
- Kolona: `article_embedding` u `title_history`

---

## Autentifikacija

### CMS API (`src/lib/cms-auth.ts`):
- Header: **`Authorization: Bearer <API_KEY>`**
- ⚠️ Starija dokumentacija navodila `x-api-key` — to je POGREŠNO
- Mapiranje: ključ → portal_id (dinamički iz env varijabli `CMS_API_KEY_*`)
- Ako ključ ne odgovara nijednom portalu → 401

### Admin Dashboard (`src/lib/admin-auth.ts`):
- Query param: `admin_key=<ADMIN_PASSWORD>`
- Jednostavna string provera protiv env varijable

---

## SEO polja u CMS-u

Svaki CMS koji se integriše sa SEO GEM-om mora imati ova 4 polja:

| Polje | Tip | Max dužina | Vidljivost | HTML u `<head>` |
|---|---|---|---|---|
| SEO Title | text | 70 char | Vidljivo | `<title>{value}</title>` |
| Meta Description | textarea | 160 char | Vidljivo | `<meta name="description" content="{value}">` |
| Keywords | text | 300 char | Vidljivo | `<meta name="keywords" content="{value}">` |
| Schema Markup | textarea | — | **VIDLJIVO** | `<script type="application/ld+json">{value}</script>` |

> **Schema Markup MORA biti vidljivo polje** — urednik mora da vidi generisani markup radi monitoringa i eventualnog redigovanja. Ne sme biti hidden polje.

### Fallback ponašanje:
Ako novinar ne provuče članak kroz SEO GEM, polja ostaju prazna i postojeći sistem portala funkcioniše kao fallback. SEO GEM ne menja ništa automatski bez eksplicitne akcije novinara.
