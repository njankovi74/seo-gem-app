# SEO GEM — CMS Integracija

> **Ažurirano 3.11.2026** — raniji opis „embed link" modela bio je netačan; stvarna integracija je script tag.

## Pregled

SEO GEM se integriše sa CMS sistemima novinskih portala ugradnjom **jednog `<script>` taga** (`https://seo-gem-app.vercel.app/cms-embed.js`) sa `data-*` atributima u stranicu za uređivanje članka. Nema „embed linka ka widgetu", nema `iframe`-a i nema callback mehanizma koji CMS developer mora da piše. Kompletnu logiku (prikaz dugmeta i panela, čitanje teksta članka iz editora, analiza teksta, generisanje 6 naslova, generisanje i direktan upis SEO naslova, meta opisa, ključnih reči i Schema.org markupa u CMS polja, kao i naknadno hvatanje `article_id`-a za nove članke) obavlja sama skripta `public/cms-embed.js`.

> **Za kompletnu proceduru ubacivanja novog portala videti: [PORTAL-ONBOARDING.md](PORTAL-ONBOARDING.md)**

---

## Portali

| Portal | portal_id | API ključ env | Jezik | Domen | Status | CMS Developer |
|---|---|---|---|---|---|---|
| 🇷🇸 Newsmax Balkans SR | `newsmax` | `CMS_API_KEY_NEWSMAX` | Srpski | newsmaxbalkans.com | ✅ Produkcija (`<script>` tag od maja 2026) | Cubes d.o.o. |
| 🇦🇱 Newsmax Balkans AL | `newsmax_al` | `CMS_API_KEY_NEWSMAX_AL` | Albanski | newsmaxbalkans.al | ✅ Produkcija (`<script>` tag od maja 2026) | Cubes d.o.o. |
| 🇵🇱 Newsmax Polska | `newsmax_pl` | `CMS_API_KEY_NEWSMAX_PL` | Poljski | newsmaxpolska.pl | ✅ Produkcija (`<script>` tag od maja 2026) | Cubes d.o.o. |
| 🇷🇸 Insajder.net | `insajder` | `CMS_API_KEY_INSAJDER` | Srpski | insajder.net | ⏳ Čeka se odgovor klijenta | Appworks |

---

## Kako radi integracija (`<script>` tag model)

*(Zastarelo: ranija verzija ovog dokumenta pominjala je „embed link ka widgetu" i „callback za prihvat povratnih podataka" — to se ne koristi.)*

```
CMS stranica za uređivanje članka (<script src="https://seo-gem-app.vercel.app/cms-embed.js" data-*>)
        │
        ▼ cms-embed.js ubacuje dugme „✨ Generiši SEO sa SEO GEM" i panel u stranicu
        │
        ▼ novinar klikne dugme → skripta čita naslov, lead i body iz editora (CKEditor 4/5, TinyMCE ili textarea)
        │
        ▼ POST /api/cms/titles (Authorization: Bearer <API_KEY>) → vraća 6 predloga naslova
        │
        ▼ novinar bira jedan od 6 naslova ili upisuje sopstveni i klikne „Potvrdi izbor"
        │
        ▼ POST /api/cms/generate → vraća seoTitle, metaDescription, keywords, schemaMarkup, titleHistoryId
        │
        ▼ skripta direktno upisuje vrednosti u CMS polja i okida 'input' i 'change' događaje
        │
        ▼ ako je članak nov (nema article_id): čuva { th, seoTitle, ts } u localStorage ("seoGemPending")
          i po čuvanju članka šalje PATCH /api/cms/update-article-id
```

**Ključno:** Skripta `cms-embed.js` radi SVE. CMS developer samo:
1. Obezbeđuje 4 SEO polja u editoru i njihovo renderovanje u `<head>` objavljenog članka
2. Ubacuje jedan `<script src="https://seo-gem-app.vercel.app/cms-embed.js" ...>` tag sa `data-*` selektorima polja
3. Dostavlja nam tačne domene svog backoffice-a (radi CORS whitelist-a u `src/lib/cms-auth.ts`)

### Primer `<script>` taga:
```html
<script
  src="https://seo-gem-app.vercel.app/cms-embed.js"
  data-api-key="sk_cms_newsmax_xxx"
  data-language="sr"
  data-field-seo-title='[name="og_title"]'
  data-field-meta-desc='[name="meta_description"]'
  data-field-keywords='[name="keywords"]'
  data-field-schema='[name="schema_org"]'
  data-field-title='[name="heading"]'
  data-field-lead='[name="lead"]'
  data-editor-type="ckeditor"
></script>
```

### Tabela `data-*` atributa (`public/cms-embed.js`):

| Atribut | Obavezan | Podrazumevana vrednost | Opis |
|---|---|---|---|
| `data-api-key` | ✅ Da | `''` | API ključ portala (`CMS_API_KEY_*`) za `Authorization: Bearer` |
| `data-api-base` | Ne | Izvodi se iz `script.src` | Bazni URL SEO GEM servisa (npr. `https://seo-gem-app.vercel.app`) |
| `data-language` | Ne | `sr` | Jezik interfejsa i generisanja (`sr`, `pl`, `sq`, `en`) |
| `data-title-max` | Ne | `75` | Maksimalan broj karaktera za polje sopstvenog naslova u boksu |
| `data-editor-type` | Ne | `ckeditor` | Tip editora za telo članka (`ckeditor`, `tinymce`, `textarea`) |
| `data-editor-id` | Ne | `''` | ID TinyMCE instance (npr. `content` → `tinymce.get('content')` pre `activeEditor`) |
| `data-save-selector` | Ne | `''` | CSS selektor dugmeta za AJAX čuvanje (npr. `#save`) na čiji `click` u capture fazi radi čuvar sheme |
| `data-site-domain` | Ne | `''` | Javni domen portala za rešavanje relativnih putanja slika u čuvaru sheme ako nisu poznati javni URL ili `publisher.logo.url` |
| `data-field-seo-title` | Ne | `[name="og_title"]` | CSS selektor polja u koje se upisuje SEO naslov |
| `data-field-meta-desc` | Ne | `[name="meta_description"]` | CSS selektor polja u koje se upisuje Meta Description |
| `data-field-keywords` | Ne | `[name="keywords"]` | CSS selektor polja u koje se upisuju ključne reči |
| `data-field-schema` | Ne | `[name="schema_org"]` | CSS selektor polja u koje se upisuje Schema.org JSON-LD markup |
| `data-field-title` | Ne | `[name="heading"]` | CSS selektor postojećeg naslova članka u CMS-u |
| `data-field-lead` | Ne | `[name="lead"]` | CSS selektor lead/uvodnog teksta članka |
| `data-field-published` | Ne | `[name="publish_at"], [name="published_at"], [name="time_created"]` | CSS selektor polja sa datumom objave (`YYYY-MM-DD HH:mm` u lokalnom vremenu → ISO; prolazi redom kroz listu) |
| `data-field-image` | Ne | `[name="image_og"], [name="og_image"], [name="image_orig"]` | CSS selektor polja sa putanjom glavne slike (relativna ili apsolutna; prolazi redom kroz listu) |
| `data-field-author` | Ne | `select[name="author_id"], [name="author"], select[name="authors[]"]` | CSS selektor polja sa imenom autora (za `<select>` čita tekst opcije; kod višestrukog izbora šalje spojeno sa `, `) |
| `data-field-section` | Ne | `select[name="category_id"], [name="article_section"], select[name="categories[]"]` | CSS selektor polja sa rubrikom/kategorijom (kod `select[multiple]` uzima samo prvu izabranu opciju) |
| `data-field-article-url` | Ne | `''` | CSS selektor polja/elementa sa javnim URL-om članka (podržava `input`, `META[content]`, `A[href]`, `LINK[href]`) |

### Podržani editori za čitanje teksta članka (`getBodyText()`):
- **CKEditor 4:** čita HTML iz najveće `CKEDITOR.instances` instance i izvlači čist tekst.
- **CKEditor 5:** čita `textContent` iz `.ck-editor__editable` elementa (`ClassicEditor` / `InlineEditor`).
- **TinyMCE:** čita `editor.getContent({ format: 'text' })` iz `tinymce.activeEditor` ili `tinymce.editors[0]`.
- **Textarea (i automatski fallback):** pronalazi `<textarea>` sa najdužim tekstom (> 100 znakova).

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
  "language": "(opciono) 'sr'|'en'|'pl'|'sq' — ako je izostavljeno, određuje se iz portala (portalLangMap)"
}
```

**Response:**
```json
{
  "success": true,
  "titles": [
    { "text": "Dijabetes tip 2: Lek Retatrutid efikasno topi kilograme", "style": "informativni", "length": 56, "reasoning": "...", "hint": "..." },
    { "text": "Dijabetes: Novi lek smanjuje težinu efikasnije od operacije", "style": "informativni", "length": 59, "reasoning": "..." },
    { "text": "Da li je Retatrutid lek koji će promeniti lečenje dijabetesa?", "style": "geo_pitanje", "length": 61, "reasoning": "..." },
    { "text": "Kako novi lek za dijabetes pomaže u mršavljenju?", "style": "geo_pitanje", "length": 49, "reasoning": "..." },
    { "text": "Lek koji topi kilograme: Naučnici tvrde da menja pravila igre", "style": "discover_hook", "length": 61, "reasoning": "..." },
    { "text": "Pacijenti sa dijabetesom smršali 24% — evo kako", "style": "discover_hook", "length": 48, "reasoning": "..." }
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
  "offeredTitles": "(opciono) niz od 6 ponuđenih naslova — server iz njega sam određuje selection_type (ai_option_1..6 ili custom)",
  "articleId": "(opciono) numerički ID članka (4+ cifre) iz backoffice URL-a ili DOM-a",
  "articleUrl": "(opciono) javni URL objavljenog članka — za metadata scraping (backoffice URL se odbacuje)",
  "authorName": "(opciono) ime autora — za schema markup",
  "articleSection": "(opciono) kategorija — za schema markup",
  "language": "(opciono) 'sr'|'en'|'pl'|'sq'"
}
```
> **Napomena za `selection_type`:** Embed skripta **ne šalje** `selection_type` — server ga automatski određuje funkcijom `classifySelection(selectedTitle, offeredTitles)` (`ai_option_1..6` ili `custom`).

**Response:**
```json
{
  "success": true,
  "llmFailed": false,
  "seoTitle": "Dijabetes tip 2: Lek Retatrutid efikasno topi kilograme",
  "metaDescription": "Klinička studija pokazala da lek Retatrutid pomaže pacijentima sa dijabetesom tip 2 da smršaju do 24 procenta telesne mase za godinu dana.",
  "keywords": "dijabetes, retatrutid, mršavljenje, lek za dijabetes, tip 2, klinička studija",
  "schemaMarkup": "<script type=\"application/ld+json\">{ ... Article schema ... }</script>",
  "titleHistoryId": 12345
}
```

### 3. Naknadno povezivanje ID-a članka: `PATCH /api/cms/update-article-id`

Kada novinar generiše SEO na novom, još nesačuvanom članku (`/articles/new`), `cms-embed.js` čuva `{ th: titleHistoryId, seoTitle, ts }` u `localStorage` (`seoGemPending`). Kada novinar sačuva članak i CMS učita stranicu sa brojem članka (`/articles/{id}/edit`), skripta poredi SEO Title polje sa sačuvanim naslovom i pri poklapanju šalje `PATCH` zahtev:

**Autentifikacija:** `Authorization: Bearer <API_KEY>` header (obavezno; ažurira se samo zapis koji pripada portalu tog ključa i čiji je `article_id` još uvek `null`).

**Request:**
```json
{
  "title_history_id": 12345,
  "article_id": "57081",
  "article_url": "https://newsmaxbalkans.com/vesti/..." // opciono; čuva se samo javni http(s) URL bez 'backoffice'/'cubesdev', inače null
}
```

**Response (200):**
```json
{
  "success": true,
  "updated": true
}
```

**Greške:** `401` (neispravan/nedostajući API ključ), `400` (nedostaje parametar ili `article_id` nema 4+ cifre), `404` (`not found or already linked` — zapis ne pripada portalu ili već ima `article_id`).

---

## Stilovi naslova

SEO GEM generiše **6 varijanti** — 2 varijacije za svaki od 3 stila:

| Stil | Opis | Primer |
|---|---|---|
| **informativni** | Klasični SEO naslovi. Fokus na glavnom problemu. Fluid, prirodne rečenice — BEZ dvotačke. | "Novi lek za dijabetes efikasno smanjuje telesnu težinu" |
| **geo_pitanje** | Konverzacijska pitanja i izjavni odgovori za AI Overviews i voice search (na SR labela u embedu je „🌍 GEO"). | "Da li novi lek za dijabetes može zameniti operaciju?" |
| **discover_hook** | E-E-A-T naslovi za Google Discover. Za poznate ličnosti koristi "Ime: tvrdnja" format. | "Lek koji topi kilograme: Naučnici tvrde da menja pravila igre" |

**Pravilo dvotačke:** Od 6 naslova, maksimum 1 (opcija 6 na SR) sme koristiti format "X: Y". Ostalih 5 moraju biti fluid rečenice ili pitanja.

**Pravilo poznatih ličnosti:** Discover hook koristi ime osobe SAMO ako je javno poznata ličnost (političar, sportista, ministar). Za eksperte/blogere — koristi se opis koristi bez imena.

---

## RAG (Retrieval Augmented Generation)

### Kako radi:
1. Kada skripta pozove `/api/cms/titles`, sistem traži **5 sličnih primera** iz prethodnih izbora novinara
2. Primeri prioritizuju custom (novinarove) naslove, uz dopunu AI-izabranim naslovima po stilovima za taj portal
3. Ovi primeri se šalju Gemini-ju kao few-shot kontekst
4. Kada novinar izabere naslov, čuva se u `title_history` sa OpenAI embedding-om

### Analiza obrazaca:
- `analyzePattern()` i `analyzeStylePatterns()` analiziraju prethodne izbore za portal
- Detektuju preferirane obrasce: pitanja, dvotačke, brojevi, dužina, struktura
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
- Mapiranje: ključ → `portal_id` (dinamički iz env varijabli `CMS_API_KEY_*`)
- Ako ključ ne odgovara nijednom portalu → `401`
- **CORS (`corsHeaders()`):** proverava `Origin` prema whitelist-i dozvoljenih backoffice domena portala; `Access-Control-Allow-Methods` uključuje `GET, POST, PATCH, OPTIONS`

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

---

## Testiranje embeda (`scripts/test-pages/`)

Test stranice se nalaze van `public/` direktorijuma (u `scripts/test-pages/cms-test.html` — „CMS test A" i `scripts/test-pages/cms-test-mpanel.html` — „CMS test B") i ne serviraju se sa Vercela:
1. Pokrenuti lokalni Next.js server na portu `3000` (`npx next dev -p 3000`) i statički server za test stranice na portu `8080`: `npx serve scripts/test-pages -l 8080`.
2. Otvoriti `http://localhost:8080/cms-test.html` („CMS test A") ili `http://localhost:8080/cms-test-mpanel.html` („CMS test B").
3. U `cms-test.html` u panelu **„Test podešavanja"** uneti odgovarajući CMS API ključ (`type="password"`), izabrati jezik (`sr`, `pl`, `sq` ili `en`, podrazumevano `sr`) i kliknuti **„Učitaj SEO GEM"**. Ključ se privremeno pamti samo u `sessionStorage` pregledača i nikada se ne čuva na serveru.
