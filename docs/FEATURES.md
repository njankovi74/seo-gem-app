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
| `geo_pitanje` | 2 | GEO naslovi za AI Overviews / ChatGPT / voice search | **SR (od 30.10.2026):** opcija 3 = pitanje sa "?", opcija 4 = izjavna rečenica-odgovor. Ostali jezici: oba pitanja |
| `discover_hook` | 2 | E-E-A-T za Google Discover | Za poznate: "Ime: tvrdnja"; ostali: opis koristi |

> Naziv stila `geo_pitanje` ostaje zbog baze i admin panela. U SR embed-u labela je sada „🌍 GEO".

### Pravila za srpski (od 30.10.2026, `titles-prompt.ts`)
| Pravilo | Kako radi |
|---|---|
| Ključna činjenica | Svaki naslov nosi KO + ŠTA iz teksta, ne samo temu |
| Mesto | JEDNA odluka za ceo članak („da li bi čitalac u Srbiji bez mesta pogrešno razumeo vest?"). DA → mesto u svih 6, NE → ni u jednom. Odluka se upisuje u `reasoning` 1. naslova („MESTO: DA/NE — razlog") |
| Ime osobe | Samo ako je čitalac u Srbiji prepoznaje; ako model nije siguran → funkcija + zemlja („jermenski poslanik"). Važi za sva 3 stila |
| Bez preterivanja | „revolucija", „istorijski", „prvi u svetu"… samo ako tekst to doslovno tvrdi |
| Bez praznih fraza | „važne odluke", „detalji o", „šta se dešava", „evo kako"… zabranjeno |
| Bez imperativa | „Saznajte", „Otkrijte", „Smršajte", „Evo…" zabranjeno |
| Jezik | Jednostavan i jasan, ali ne banalan; bez tačke na kraju |
| Dvotačka | Dozvoljena SAMO u opciji 6. Kod proverava opcije 1–5 i, ako nađe dvotačku, traži od modela prepravku samo tih naslova (`COLON GUARD` u `cms/titles`) |
| Preciznost mesta (30.10.) | Poznat grad (Firenca, Rim, Beč…) → grad, ne država; manje poznato mesto → država. Domaće vesti: bez „u Srbiji" |
| Brendovi (30.10.) | Isto pravilo kao za imena: naziv proizvoda/brenda samo ako ga čitalac u Srbiji zna; nikada kao „X:" u opciji 6 |
| GEO pitanje (30.10.) | Pitanje mora već da sadrži vest (ko, šta, gde) i da pita „kako/zašto"; zabranjena pitanja-kvizovi („Koliko je…?") |
| Najjača informacija (30.10.) | Rekord/„najveći"/„prvi put" iz teksta mora biti u bar jednom naslovu; tvrdnja izvora formuliše se oprezno |
| Logika i izrazi (30.10.) | Kradu se predmeti, ne vrednost; „u vrednosti od X" umesto „vrednih X"; precizni glagoli („ukrali") umesto kolokvijalnih („odneli") |
| Raznovrsnost (30.10.) | 6 različitih formulacija; isti podatak ne mora u svaki naslov |
| Završna provera (30.10.) | KORAK 3: model proverava padeže/slaganje, logiku i „da li bi urednik objavio bez ispravke" |
| Političari i stranke (30.10.) | Uz ime političara stranka skraćenicom u zagradi („Miloš Jovanović (NDSS)"); „nosilac liste" nikad bez naziva liste |
| Pripisivanje (30.10.) | Izjave, obećanja i najave uvek se pripisuju („Jovanović obećava…"), nikad kao činjenica |
| TITLE GUARD (30.10.) | Kod (ne model) prvo uklanja tačku na kraju i dodaje „?" pitanjima koja počinju upitnom reči; zatim proverava dvotačku u opcijama 1–5 i dužinu > 70 znakova; prekršioce šalje na prepravku („BEZ DVOTAČKE" / „SKRATI" uz inteligentno skraćivanje). Prepravka se prihvata samo ako ispunjava pravila. Log: `📈 [Usage/titles-guard]` |
| Skraćenice (30.10.) | Kad je naslov predug: skraćenica organizacije/stranke (NPS, RIK) umesto okrnjenog ključnog pojma („birački spisak", ne „spisak") |

### Ograničenja naslova:
- Dužina: max **70 karaktera** (truncation u `seo-output.ts`)
- Dvotačka: max **1 od 6** naslova sme koristiti "X: Y" format
- Imena: poznate ličnosti DA, eksperti/blogeri NE (u discover_hook stilu)

### LLM konfiguracija:
- Model: **srpski naslovi: `gemini-3.8-flash`** (od 30.10.2026, posle uporednog testa 5 tekstova; env `TITLES_MODEL_SR` za promenu). Ostali jezici i meta/schema (`generate`): `GEMINI_MODEL` (trenutno `gemini-2.5-flash`)
- **Provera činjenica (SR):** posle generisanja `src/lib/title-factcheck.ts` šalje 6 naslova + tekst modelu `gemini-3.8-flash` (env `FACTCHECK_MODEL`, isključenje `FACTCHECK_DISABLED=true`). Označava samo jasne činjenične greške (izmišljeno, izvrnuto, nepripisana tvrdnja, značajno preterivanje); stil nije razlog. Ispravka se prihvata samo ako je ≤ 70 znakova, bez dvotačke u 1–5, a #3 ostaje pitanje. Ispravljeni naslov dobija napomenu u `reasoning`. Log: `🔎 [FactCheck]`, `📈 [Usage/titles-factcheck]`. Trajanje ~2–4 s, ≈ \$0.002 po članku
- Ulazni tekst se normalizuje u Unicode NFC (deo tekstova ima „rastavljena" slova č/ć/š/ž)
- Temperature: `0.6`
- Thinking budget: `4096` tokena (od 30.10.2026 važi i za `gemini-3*` modele, ne samo za 2.5)
- Max retries: `2` (na JSON parse failure)
- Response format: `application/json`
- Potrošnja tokena se loguje za svaki poziv: `📈 [Usage/titles]`, `📈 [Usage/generate]`, `📈 [Usage/titles-colonfix]`

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
| Selekcija | **3 custom + 2 AI-izabrana**, sa shuffle-om (od avg 2026) | custom = izabrani naslov se ne poklapa ni sa jednim ponuđenim |
| Embedding model | `text-embedding-3-small` | OpenAI |
| Embedding input limit | **8000** karaktera | `text.substring(0, 8000)` |
| Analiza stila — pool | poslednjih **500** izbora | `STYLE_LOOKBACK` u `title-history.ts` |
| Analiza stila — izbor | prvo **custom** (do 50); ako ih je < 10, dopuna AI-izabranim naslovima do 50 | `pickStyleTitles()` |
| Min za analizu | **10** naslova ukupno | `if (customTitles.length < 10) return ''` |
| `selection_type` | Server ga određuje sam: tačno poklapanje sa ponuđenim #N → `ai_option_N` (1–6), inače `custom` | `classifySelection()` u `cms/generate` |

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
Interaktivni dashboard za praćenje performansi SEO GEM članaka sa 4 taba.

### Autentifikacija:
- Password-based login (`admin_key` parametar)
- Auto-refresh podataka svakih 30 sekundi
- Visibility API — pauzira refresh kad tab nije aktivan

### Tabovi:

#### 🔄 Operacije (Tab 1):
- **Metrike:** Ukupno generacija, Uspešnost (%), Greške, Avg Latency
- **Stilovi generisanja:** Procenat po stilu (informativni, geo_pitanje, itd.) sa bar chartom
- **RAG & Sugestije:** Procenat korišćenja RAG-a i Google Suggest-a
- **Modeli:** Korišćeni LLM modeli sa brojem poziva
- **Greške:** Lista nedavnih grešaka sa detaljima (tip, endpoint, poruka, URL)

#### 📊 Analitika (Tab 2):
- **GSC metrike:** Impressions, Clicks, CTR, Web Impressions, Discover — sa uporednim prikazom ceo sajt vs SEO GEM
- **GA4 metrike:** Pregledi, Sesije, Angažman, Str/Sesija — ceo sajt vs GEM
- **Traffic atribucija:** Organic, Direct, Social, Other — bar chart sa procentima

#### 📝 Članci (Tab 3):
- Samo SEO GEM članci (iz `title_history`)
- **Sticky zaglavlja** — kolone ostaju vidljive pri skrolovanju
- **Grupni headeri:** "GOOGLE SEARCH CONSOLE" (žuto) i "GOOGLE ANALYTICS 4" (ljubičasto)
- **Kolone:** Status, Objavljeno, SEO Naslov, Starost, Impr.(GSC), Klikovi(GSC), CTR(GSC), Pozicija(GSC), Discover(GSC), Pregledi(GA4), Organic%(GA4), Direct%(GA4), Angažman(GA4), Str/Sesija(GA4)
- **Period indikator:** "Podaci za period: X → Y" u headeru i legendi
- **Source tagovi:** GSC/GA4/GEM oznake na svakoj koloni
- **Tooltip-ovi:** Hover objašnjenje svake kolone na srpskom
- **Sortiranje:** Klik na zaglavlje za sortiranje (asc/desc)
- **Status ikonice:** 🕐 Rani (<7d), ✅ OK, ⚠️ Nizak CTR, 🔥 Top performer

#### ⚙️ Status (Tab 4):
- **Sistemski servisi:** GSC, GA4, CMS API, LLM (Gemini) — sa statusom (Povezan/Nepovezan), detaljima ("3/3 portala povezano"), i opisom funkcije
- **Konekcije po portalu:** Za svaki portal prikazuje GSC/GA4 status i vreme poslednjeg sync-a
- **Osveži status:** Dugme za ručno osvežavanje

### Period selekcija:

#### Preseti:
| Dugme | Ponašanje |
|---|---|
| Danas | `startDate = endDate = danas` |
| Juče | `startDate = juče, endDate = danas` |
| 7 dana | `startDate = pre 7 dana, endDate = danas` |
| 14 dana | `startDate = pre 14 dana, endDate = danas` |
| 30 dana | `startDate = pre 30 dana, endDate = danas` |

#### Vizuelni kalendar (📅 dugme):
- Mesečni grid sa klikabilnim danima
- ◀ ▶ navigacija mesecima
- Srpski lokalizovan (Pon-Ned, Januar-Decembar)
- Range selekcija: klik za start, klik za end
- Ljubičasto obojeni start/end sa range highlighting
- Budući datumi onemogućeni (sivi)
- Danas obeležen okvirom
- "Primeni"/"Otkaži" dugmad

### Landing Page:
- Grid svih portala sa zastavicama (🇷🇸, 🇵🇱, 🇦🇱)
- Kartice: Ukupno članaka, Uspešnost, Danas generacija, Danas greške
- Footer: Danas ukupno generacija, Današnje greške, Ukupna uspešnost (7d)

### Fajlovi:
- Frontend: `src/app/admin/page.tsx` (~1750 linija, sve-u-jednom React komponenta)
- API Overview: `src/app/api/admin/analytics/overview/route.ts`
- API Articles: `src/app/api/admin/analytics/articles/route.ts`
- API Operations: `src/app/api/admin/analytics/operations/route.ts`
- API Status: `src/app/api/admin/analytics/status/route.ts`

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
Sistem prikuplja Google Autocomplete predloge (stvarne pretrage korisnika) i koristi ih kao kontekst za generisanje naslova.

### Srpski — „pametna" autodopuna (od 30.10.2026): `src/lib/suggest-queries.ts`
| Korak | Pravilo |
|---|---|
| 1. Upiti | Samo **višerečni** pojmovi iz teksta (mid-tail 2–3 reči, long-tail do 4). Fraza počinje i završava se sadržajnom reči, max 1 veznik unutra („vodič za lečenje"). Mora da se ponavlja u tekstu ili da bude u lidu/naslovu. Duža fraza ima prednost nad svojim delom ako se javlja podjednako često. Do 3 osnovna upita + 2-rečni rezervni upit za long-tail (max 5, paralelno) |
| 2. Google | `getGoogleSuggestions(q, 'sr', 10, includeQuery=true)` — zadržava i sam upit ako ga Google vrati (potvrda da ga ljudi kucaju); `ie/oe=utf-8` |
| 3. Filter | Zadržava samo predloge sa **2+ reči** čije SVE reči postoje u tekstu (tolerantno na padeže i dijakritike: „lecenje" = „lečenje"). Dozvoljene su samo funkcijske i upitne reči (za, u, kako, šta…). Kratke reči/skraćenice (≤3 slova, npr. „sns") i brojevi moraju postojati tačno. Max 6 predloga |
| 4. Prompt | Predlozi se koriste u opcijama 1–4 (informativni i GEO) **samo kada se prirodno uklapaju**; zabranjeno dodavanje informacija kojih nema u tekstu |

**Zašto:** stari tok je slao jednu „primarnu ključnu reč" (često pomoćnu reč: „nakon", „tokom", „prekid") i model je bio obavezan da ubaci predlog → šum u naslovima („nakon svih ovih godina", „prekidači", „hipertenzija"). Vidi `TROUBLESHOOTING.md`.

Ostali jezici (PL, AL, EN) i dalje koriste stari tok (jedna primarna ključna reč) — adaptacija kasnije.

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
