# SEO GEM — Changelog

Hronološki zapis svih promena u projektu.

---

## 2026-06-19 — Veliki refaktoring Admin Dashboarda

### Sesija 1 (jutro): Dokumentacija i Dashboard v3

| Commit | Tip | Opis |
|---|---|---|
| `675768c` | docs | Kreirana kompletna dokumentacija projekta — 7 fajlova u `docs/` (FEATURES, API-REFERENCE, CMS-INTEGRATION, ANALYTICS, ARCHITECTURE, TROUBLESHOOTING, CHANGELOG) + AGENTS.md pravila za automatsko ažuriranje |
| `70829a1` | feat | Info banner za kašnjenje podataka: kad korisnik odabere kratak period (1-3 dana), prikazuje se upozorenje "⚠️ GSC kasni ~3 dana, GA4 kasni ~1 dan" |
| `6933238` | docs | Dodat CHANGELOG unos za delay banner |
| `b7a38a3` | feat | **Dashboard v3** — kompletno nov dizajn sa 4 taba: Operacije, Analitika, Članci, Status. Operations API za praćenje generisanja naslova. Auto-refresh na 30s. Premium dark tema sa glassmorphism efektima |

### Sesija 2 (veče): Ispravke bagova i UX poboljšanja

| Commit | Tip | Detaljni opis |
|---|---|---|
| `731253e` | fix | **Pogrešni nazivi portala i domen** — Ispravljeni display nazivi: `Newsmax.rs` → `Newsmax Balkans SR`, `Newsmax.pl` → `Newsmax Polska`, `Newsmax.al` → `Newsmax Balkans AL`. Ispravljen poljski domen u `generate/route.ts`: `newsmaxpolska.com` → `newsmaxpolska.pl` |
| `514b8e9` | fix | **Date picker UX:** (1) Dodat "Danas" preset koji postavlja start=end=danas. (2) Kad se odabere custom datum, preset dugmad se pravilno deaktivira. **Članci tabela:** (3) Sticky thead — zaglavlja kolona ostaju vidljiva pri skrolovanju. (4) Dodati grupni headeri "GOOGLE SEARCH CONSOLE" (žuto) i "GOOGLE ANALYTICS 4" (ljubičasto) iznad odgovarajućih kolona. (5) Period indikator "📅 Podaci za period: X → Y" u headeru tabele i u legendi. **Status tab:** (6) Dodat info banner sa objašnjenjem čemu služi stranica. (7) Svaki servis ima opis funkcije (npr. GSC: "Prikuplja podatke o pozicijama, klikovima i impressions iz Google pretrage i Discover-a") |
| `bb3ae70` | docs | Ažuriran changelog sa UX ispravkama |
| `085a983` | fix | **Status tab potpuno prepisan** — Prethodni kod tražio `data.gsc`, `data.ga4`, `data.cms`, `data.llm` u API odgovoru, ali API (`/api/admin/analytics/status`) zapravo vraća `{ portals: [...], summary: { gsc_connected, ga4_connected } }`. Rezultat: svi servisi prikazivani kao "○ Nepovezan" iako su svi povezani. **Ispravka:** StatusTab sada čita pravi format — prikazuje `● Povezan` sa detaljima (`3/3 portala povezano`), opisima servisa, i novom sekcijom "📡 Konekcije po portalu" sa GSC/GA4 statusom i vremenima poslednjeg sync-a za svaki portal pojedinačno |
| `5b7de19` | feat | **Vizuelni kalendar** — Zamenjeni nativni `<input type="date">` (koji zahtevaju ručno kucanje) sa potpuno novom `CalendarPicker` komponentom: mesečni grid sa klikabilnim danima, ◀ ▶ navigacija mesecima, srpski nazivi (Jan-Dec, Pon-Ned), ljubičasto obojeni start/end sa range highlighting, budući datumi onemogućeni (sivi), danas obeležen okvirom, "Primeni"/"Otkaži" dugmad |
| `1d77da5` | docs | Ažuriran changelog |

---

### Problemi otkriveni i rešeni tokom sesije:

| # | Problem | Uzrok | Rešenje | Status |
|---|---|---|---|---|
| 1 | Pogrešni nazivi portala (Newsmax.rs, .pl, .al) | Hardkodirani pogrešni nazivi u PORTAL_DISPLAY konstantama | Ispravljeno na: Newsmax Balkans SR, Newsmax Polska, Newsmax Balkans AL | ✅ |
| 2 | Pogrešan PL domen za embed linkove | `newsmaxpolska.com` u `generate/route.ts` | Ispravljen na `newsmaxpolska.pl` | ✅ |
| 3 | "7 dana" ostaje aktivno kad se odabere custom datum | `activePreset` state se ne resetuje na custom izbor | `applyCustom()` postavlja `activePreset = 0` | ✅ |
| 4 | Nema "Danas" opcije u presetima | Samo Juče/7d/14d/30d | Dodat `{ label: 'Danas', days: 0 }` sa logikom `startDate=endDate=danas` | ✅ |
| 5 | Zaglavlja kolona nestaju pri skrolovanju Članci tabele | `<thead>` nema sticky pozicioniranje | Dodat `position: sticky, top: 0, zIndex: 10, background: '#0f172a'` | ✅ |
| 6 | Nejasno koja kolona pripada GSC a koja GA4 | Samo mali tagovi "GSC"/"GA4" pored imena | Dodati grupni headeri "GOOGLE SEARCH CONSOLE" i "GOOGLE ANALYTICS 4" | ✅ |
| 7 | Nejasno da li su podaci za period ili ukupni | Nema indikatora | Period info u headeru i legendi: "Podaci za period: X → Y" | ✅ |
| 8 | Status tab prikazuje "Nepovezan" za sve servise | Frontend traži `data.gsc`, `data.ga4` ali API vraća `data.portals[]` | Prepisan StatusTab da koristi pravi API format | ✅ |
| 9 | Date picker zahteva ručno kucanje datuma | Koristi nativni `<input type="date">` | Nova CalendarPicker komponenta sa vizuelnim kalendarom | ✅ |
| 10 | Status tab nema objašnjenje čemu služi | Samo 4 kartice bez konteksta | Dodat info banner + opisi servisa + sekcija po portalu | ✅ |

---

### Fajlovi izmenjeni 2026-06-19:

| Fajl | Tip promene |
|---|---|
| `src/app/admin/page.tsx` | Glavni dashboard — višestruke izmene (v3 dizajn, preseti, kalendar, tabela, status) |
| `src/app/api/cms/generate/route.ts` | Ispravljen PL domen |
| `docs/CHANGELOG.md` | Ovaj fajl |
| `docs/FEATURES.md` | Ažurirane funkcionalnosti dashboarda |
| `docs/TROUBLESHOOTING.md` | Dodati novi rešeni problemi |
| `.agents/AGENTS.md` | Novo — pravila za AI agenta |
| `docs/ANALYTICS.md` | Kreiran |
| `docs/API-REFERENCE.md` | Kreiran |
| `docs/ARCHITECTURE.md` | Kreiran |
| `docs/CMS-INTEGRATION.md` | Kreiran |

---

## Ranije promene

| Datum | Tip | Opis |
|---|---|---|
| 2026-06-15 | fix | Supabase paginacija (1000 redova/stranica) za analitičke upite |
| 2026-06-15 | fix | ID-based matching za SEO GEM članke (regex `/\d{4,}/`) |
| 2026-06-15 | feat | Organic + Direct atribucija za SEO GEM članke |
| 2026-06-15 | feat | Članci tab — samo SEO GEM članci sa source tooltipovima |
| 2026-06-15 | feat | GEM sekcija u Overview — ukupno + Organic+Direct |
| 2026-06-14 | feat | Admin Analytics Dashboard v2 — Overview + Članci tabovi |
| 2026-06-14 | feat | GA4 sinhronizacija sa traffic source breakdown |
| 2026-06-14 | feat | GSC sinhronizacija sa web + Discover podacima |
| 2026-06-14 | feat | Google OAuth integracija za GSC i GA4 |
| 2026-06-14 | feat | Vercel Cron — dnevni sync u 3h UTC |
| 2026-05-xx | feat | CMS API integracija — `/api/cms/titles` i `/api/cms/generate` |
| 2026-05-xx | feat | Multi-portal podrška (newsmax, newsmax_al, newsmax_pl) |
| 2026-05-xx | feat | RAG sistem sa OpenAI embeddings za učenje iz prethodnih izbora |
| 2026-05-xx | feat | Title prompt v2 — 6 varijanti (2×3 stila) |
| 2026-04-xx | feat | Dual LLM mode (Gemini + OpenAI A/B testiranje) |
| 2026-04-xx | feat | Gemini 2.5 Flash kao primarni LLM |
| 2026-03-xx | feat | LSA semantička analiza + Search Intent klasifikacija |
| 2026-03-xx | feat | TF-IDF analiza za srpski jezik |
| 2026-02-xx | init | MVP — URL ekstrakcija + osnovna SEO analiza |
