# SEO GEM — CMS Integracija

## Pregled

SEO GEM se integriše sa CMS sistemima novinskih portala putem REST API-ja. CMS šalje URL članka, a SEO GEM vraća optimizovane naslove, meta opis i ključne reči.

---

## Portali

| Portal | portal_id | API ključ env | Jezik | Domen |
|---|---|---|---|---|
| 🇷🇸 Newsmax Balkans SR | `newsmax` | `CMS_API_KEY_NEWSMAX` | Srpski | newsmaxbalkans.com |
| 🇦🇱 Newsmax Balkans AL | `newsmax_al` | `CMS_API_KEY_NEWSMAX_AL` | Albanski | newsmaxbalkans.al |
| 🇵🇱 Newsmax Polska | `newsmax_pl` | `CMS_API_KEY_NEWSMAX_PL` | Poljski | newsmaxpolska.pl |
| 🇬🇧 Newsmax EN | `newsmax_en` | `CMS_API_KEY_NEWSMAX_EN` | Engleski | (nedefinisan) |

---

## API Endpoints

### 1. Generisanje naslova: `POST /api/cms/titles`

**Autentifikacija:** `x-api-key` header

**Request:**
```json
{
  "url": "https://newsmaxbalkans.com/svet/vesti/51543/lek-za-dijabetes...",
  "text": "(opciono) tekst članka ako URL ekstrakcija ne radi"
}
```

**Response:**
```json
{
  "success": true,
  "portal_id": "newsmax",
  "titles": [
    { "text": "Dijabetes tip 2: Lek Retatrutid efikasno topi kilograme", "style": "informativni", "length": 56 },
    { "text": "Dijabetes: Novi lek smanjuje težinu efikasnije od operacije", "style": "informativni", "length": 59 },
    { "text": "Da li je Retatrutid lek koji će promeniti lečenje dijabetesa?", "style": "geo_pitanje", "length": 61 },
    { "text": "Kako novi lek za dijabetes pomaže u mršavljenju?", "style": "geo_pitanje", "length": 49 },
    { "text": "Lek koji topi kilograme: Naučnici tvrde da menja pravila igre", "style": "discover_hook", "length": 61 },
    { "text": "Pacijenti sa dijabetesom smršali 24% — evo kako", "style": "discover_hook", "length": 48 }
  ],
  "meta_description": "...",
  "keywords": "dijabetes, retatrutid, mršavljenje...",
  "analysis": { ... }
}
```

### 2. SEO generisanje: `POST /api/cms/generate`

**Autentifikacija:** `x-api-key` header

**Request:**
```json
{
  "url": "https://newsmaxbalkans.com/...",
  "selected_title": "Dijabetes tip 2: Lek Retatrutid efikasno topi kilograme",
  "selection_type": "ai_selected"
}
```

**Response:**
```json
{
  "success": true,
  "seo": {
    "title": "Dijabetes tip 2: Lek Retatrutid efikasno topi kilograme",
    "meta_description": "...",
    "keywords": "...",
    "schema_markup": "..."
  },
  "history_id": 1234
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
1. Kada CMS pozove `/api/cms/titles`, sistem traži **5 sličnih primera** iz prethodnih izbora novinara
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
- Header: `x-api-key: <CMS_API_KEY>`
- Mapiranje: ključ → portal_id (iz env varijabli)
- Ako ključ ne odgovara nijednom portalu → 401

### Admin Dashboard (`src/lib/admin-auth.ts`):
- Query param: `admin_key=<ADMIN_PASSWORD>`
- Jednostavna string provera protiv env varijable

---

## Embed u CMS

CMS integracija funkcioniše kao iframe/widget koji se embeduje u CMS admin panel:

1. CMS admin panel prikazuje SEO GEM widget pored editora članka
2. Novinar klikne "Generiši SEO naslov"
3. Widget poziva `/api/cms/titles` sa URL-om članka
4. Prikazuje 6 varijanti naslova sa stilovima
5. Novinar bira naslov → widget poziva `/api/cms/generate`
6. Meta opis i ključne reči se automatski popunjavaju u CMS
