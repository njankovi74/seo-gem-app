# SEO GEM — Funkcionalnosti

## 1. SEO Analiza teksta

### Opis:
Korisnik unosi URL ili tekst članka, a sistem vrši kompletnu SEO analizu.

### Komponente:

#### TF-IDF Analiza (`src/lib/tfidf-analyzer.ts`)
- Tokenizacija sa srpskim stop-rečima
- Ekstrakcija ključnih fraza (do 50 termova)
- Readability score (heuristički)
- Podrška za srpski, poljski, albanski, engleski

#### LSA Analiza (`src/lib/lsa-analyzer.ts`)
- Latent Semantic Analysis sa custom konceptnom mapom za srpski
- Tematski klasteri i semantička sličnost
- Search Intent klasifikacija (informational, navigational, transactional, commercial)
- Concept strength metrika

#### Keyword Prioritizacija (`src/lib/keyword-prioritizer.ts`)
- "Long-tail first" strategija
- Rangira do 50 termova sa razlozima
- Export u CSV i comma-list format

---

## 2. Generisanje SEO naslova

### Opis:
AI generiše 6 varijanti naslova u 3 stila za svaki članak.

### Stilovi:

| Stil | Br. | Opis | Format |
|---|---|---|---|
| `informativni` | 2 | Klasični SEO naslovi | Fluid rečenice, BEZ dvotačke |
| `geo_pitanje` | 2 | Pitanja za AI Overviews / voice search | Pitanja sa "?" |
| `discover_hook` | 2 | E-E-A-T za Google Discover | Za poznate: "Ime: tvrdnja"; ostali: opis koristi |

### Ograničenja naslova:
- Dužina: max **70 karaktera** (truncation u `seo-output.ts`)
- Dvotačka: max **1 od 6** naslova sme koristiti "X: Y" format
- Imena: poznate ličnosti DA, eksperti/blogeri NE (u discover_hook stilu)

### LLM konfiguracija:
- Model: `gemini-2.5-flash`
- Temperature: `0.6`
- Thinking budget: `4096` tokena
- Max retries: `2` (na JSON parse failure)
- Response format: `application/json`

### Jezička validacija:
- 3-slojna validacija: franc trigram → word/char markers → fail-open
- Ako naslov nije na očekivanom jeziku: retry sa pojačanim uputstvom
- Ako i retry ne uspe: blokira odgovor (422)

---

## 3. RAG sistem (učenje iz prethodnih izbora)

### Opis:
Sistem uči iz prethodnih izbora novinara i koristi te primere kao kontekst za buduće generisanje.

### Parametri:
| Parametar | Vrednost | Lokacija |
|---|---|---|
| Broj primera | **5** | `getSimilarTitleExamples(text, limit=5)` |
| Pool za selekciju | **120** zapisa | `.limit(120)` u Supabase query |
| Min validnih | **3** offered_titles sa style+text | filter u kodu |
| Selekcija | Round-robin po stilovima | informativni → geo_pitanje → discover_hook |
| Embedding model | `text-embedding-3-small` | OpenAI |
| Embedding input limit | **8000** karaktera | `text.substring(0, 8000)` |
| Pattern analiza | **50** custom naslova | `.slice(0, 50)` |
| Min za analizu | **10** custom naslova | `if (customs.length < 10) return ''` |

### Detektovani obrasci:
- Pitanja (?)
- Uzvici (!)
- Dvotačke (:)
- Numerisane liste
- Imperativi (jezički specifično)
- Direktno obraćanje (prag: ≥15%)

---

## 4. Meta opis i ključne reči

### Opis:
Posle izbora naslova, sistem generiše meta description, keywords i schema markup.

### Ograničenja:
| Element | Max dužina | Max broj |
|---|---|---|
| Meta description | **160** karaktera | 1 |
| Keywords line | **300** karaktera | Max **10** ključnih reči |
| Min keyword length | **3** karaktera | — |
| Schema markup | — | JSON-LD (Article) |

### Banned tokens:
- Clickbait reči
- Imena portala/publishera
- Uobičajene stop reči

---

## 5. CMS Integracija

### Opis:
REST API za integraciju sa CMS-ovima novinskih portala.

### Portali:
| Portal | ID | Jezik | CORS domeni |
|---|---|---|---|
| Newsmax SR | `newsmax` | Srpski | backoffice.newsmaxbalkans.com |
| Newsmax AL | `newsmax_al` | Albanski | backoffice.newsmaxbalkans.al |
| Newsmax PL | `newsmax_pl` | Poljski | backoffice.newsmaxpolska.pl |
| Newsmax EN | `newsmax_en` | Engleski | (backoffice.newsmaxbalkans.com) |

### Endpoint-i:
- `POST /api/cms/titles` — 6 predloga naslova
- `POST /api/cms/generate` — Meta opis, keywords, schema (maxDuration: 55s)

Detalji u [CMS-INTEGRATION.md](CMS-INTEGRATION.md).

---

## 6. Admin Analytics Dashboard

### Opis:
Interaktivni dashboard za praćenje performansi SEO GEM članaka.

### Tabovi:

#### Overview:
- **GSC metrike:** Impressions, Clicks, CTR, Discover
- **GA4 ceo sajt:** Pregledi, sesije, angažman
- **GA4 SEO GEM:** Pregledi samo GEM članaka + % sajta
- **Organic + Direct:** Saobraćaj pripisiv SEO naslovu

#### Članci:
- Samo SEO GEM članci (iz `title_history`)
- Kolone sa source oznakom (GSC/GA4/GEM)
- Organic% i Direct% po članku
- Status: 🕐 Rani / ✅ OK / ⚠️ Nizak CTR / 🔥 Top

### Period:
- Preseti: Juče, 7 dana, 14 dana, 30 dana
- Custom kalendar

Detalji u [ANALYTICS.md](ANALYTICS.md).

---

## 7. Automatska sinhronizacija podataka

### Opis:
Vercel Cron dnevno sinhronizuje GSC i GA4 podatke za sve portale.

### Konfiguracija:
- **Raspored:** Svaki dan u 3:00 UTC (5:00 CET)
- **GSC offset:** 3 dana (API kašnjenje)
- **GA4 offset:** 1 dan (API kašnjenje)
- **Max dana za catch-up:** 30

Detalji u [ANALYTICS.md](ANALYTICS.md).

---

## 8. Google Suggest integracija

### Opis:
Sistem prikuplja Google Autocomplete predloge za primarnu ključnu reč i koristi ih kao dodatni kontekst za generisanje naslova.

### Implementacija: `src/lib/google-suggest.ts`
- Šalje upit Google Suggest API-ju
- Parsira XML odgovor
- Vraća listu predloga

---

## 9. Dual LLM A/B testiranje

### Opis:
Opcionalna funkcionalnost za uporedne rezultate Gemini i OpenAI modela.

### Aktivacija:
- `SEO_DUAL_LLM=true` u `.env.local`
- Oba modela rade paralelno
- UI prikazuje oba rezultata uporedo

### Trenutno:
- **Isključeno** (`SEO_DUAL_LLM=false`)
- Gemini 2.5 Flash je jedini aktivan model

---

## 10. i18n (Internacionalizacija)

### Jezici:
| Kod | Jezik | Fajl | Kompletno |
|---|---|---|---|
| `sr` | Srpski (latinica) | `src/lib/i18n/sr.json` | ✅ |
| `pl` | Poljski | `src/lib/i18n/pl.json` | ✅ |
| `sq` | Albanski | `src/lib/i18n/sq.json` | ✅ |
| `en` | Engleski | `src/lib/i18n/en.json` | ✅ |

### Pokriveno:
- UI labele
- LLM prompts (kompletno prevedeni za sva 4 jezika)
- Analiza obrazaca (analyzePattern output)
- Imperativ detekcija (jezički specifični regex)
