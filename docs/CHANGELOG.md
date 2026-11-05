# SEO GEM — Changelog

Hronološki zapis svih promena u projektu.

---

## 2026-11-05 — Priprema SEO GEM-a za portal Insajder (CMS mPanel, embed v2.4)

| Datum | Tip | Opis |
|---|---|---|
| 2026-11-05 | feat | `src/lib/portal-config.ts`, `src/lib/cms-auth.ts`, `src/lib/seo-output.ts`, `src/app/api/cms/update-article-id/route.ts`, `public/cms-embed.js` (v2.4), `scripts/test-pages/cms-test.html`, `scripts/test-pages/cms-test-mpanel.html`: dodat portal `insajder` (`insajder.net`) u `PORTAL_DOMAINS` i `PUBLISHER_INFO` i mPanel CORS domeni (`insajder.mpanel.app`, `app.insajder.net`, `insajder-dev.mpanel.app`); `buildCanonicalUrlFromPublicUrl` i `buildCanonicalUrl` u embedu čuvaju javne URL-ove bez numeričkog ID-a kakvi jesu (bez prepisivanja sluga); `finalizeSchema` podržava više autora odvojenih zarezom kao niz `Person[]`; `update-article-id` prihvata numerički `article_id` bilo koje dužine (`/^\d+$/`); u `cms-embed.js` (v2.4) dodati atributi `data-editor-id` (TinyMCE `tinymce.get(editorId)`), `data-save-selector` (čuvar sheme na klik AJAX dugmeta) i `data-site-domain`, čitanje vrednosti iz `META`/`A`/`LINK` elemenata, obrasci za `article_id` (`/articles/edit/{id}` i `<meta name="article-id">`), jedinstveni `resolvePublicUrl(articleId)` sa generičkom proverom hostname-a (`window.location.hostname`), slanje samo prve izabrane rubrike kod `select[multiple]`, uklonjena sva imena klijenata i dobavljača iz `public/cms-embed.js`, a test stranice premeštene iz `public/` u `scripts/test-pages/` |

---

## 2026-11-05 — Schema.org učvršćivanje „srca" (deterministički kostur + čuvar sheme u embedu)

| Datum | Tip | Opis |
|---|---|---|
| 2026-11-05 | feat | `src/lib/portal-config.ts`, `src/lib/seo-output.ts` (`finalizeSchema`), `src/app/api/cms/generate/route.ts`, `src/lib/backfill-article-ids.ts`, `public/cms-embed.js` (v2.3), `public/cms-test.html`: deterministički kostur `NewsArticle` sheme posle `cleanSchemaMarkup` (`@context`, `@type`, `headline`, `inLanguage`, `articleSection` Title Case, `publisher+logo`, `author` Person ili Organization, nepromenljivi `datePublished` iz `publish_at` ili postojeće sheme, `image` sa apsolutnim URL-om iz `image_og`, `mainEntityOfPage`/`url` sa novim slugom iz `og_title` samo kada postoji javni link članka); u `cms-embed.js` dodati Cubes fallback selektori (`publish_at`, `image_og`, `author_id`, `category_id`) sa prolaskom redom po zarezu (prvi neprazan selektor pobeđuje), čitanje teksta iz `<select>` opcija, čuvar sheme na `submit` događaj forme sa `schema_org` (ažurira `headline`, `mainEntityOfPage`/`url`, `image` i `dateModified` osim kad je čekiran `dont_change_time`) i natpis dugmeta „Izaberi naslov ↓" tokom izbora naslova; u `fetchArticleMetadata` dodat `X-SEO-GEM-Token` header i logovanje statusa pri `!res.ok` |

---

## 2026-11-05 — Izgled SEO GEM boksa u CMS-u: `hint` iza ⓘ, obrazloženja van ekrana, bez skrola

| Datum | Tip | Opis |
|---|---|---|
| 2026-11-05 | feat | `src/lib/prompts/titles-prompt.ts`, `src/app/api/cms/titles/route.ts`, `src/lib/title-history.ts`, `public/cms-embed.js` (v2.2): u JSON format odgovora za `/api/cms/titles` dodato polje `hint` (≤ 90 znakova, na jeziku portala, bez internih termina) uz serverski lokalizovan fallback po stilu (`sr`/`pl`/`sq`/`en`); iz `cms-embed.js` uklonjen prikaz `reasoning` teksta i dodat prikaz `hint`-a na hover/klik ikonice `ⓘ`, lokalizovan opis iznad svake grupe stilova, kompaktni razmaci bez skrola (~460 px na 1366×768) i podrška za `data-title-max` (default 75) |

---

## 2026-11-04 — GSC pun pull stranica + dnevni zbir celog sajta (`site_gsc_daily`)

| Datum | Tip | Opis |
|---|---|---|
| 2026-11-04 | feat | `src/lib/gsc-pull.ts`, `src/lib/ga4-pull.ts`, `src/app/api/admin/analytics/sync/route.ts`: uklonjen limit od 500 GSC stranica (`rowLimit: 5000` za `web`, `2000` za `discover` uz `startRow` petlju do 25.000 i upsert chunk 500); dodat `fetchGSCSiteTotals` (upit bez `page` dimenzije za `web` i `discover`) i upsert u `site_gsc_daily` sa `pages_pulled`; GA4 `runReport` limit povećan sa `10000` na `50000`; u `sync/route.ts` dodat `maxDuration = 300`, opcioni parametar `?only=site_totals` i merenje trajanja po portalu (`duration_ms`) |

---

## 2026-11-03 — Bezbednost: uklonjen API ključ iz javne test-stranice

| Datum | Tip | Opis |
|---|---|---|
| 2026-11-03 | docs | Dokumentacija integracije usklađena sa kodom (script tag model, Bearer auth, update-article-id, tačan spisak ruta) |
| 2026-11-03 | fix | Bezbednost (`public/cms-test.html`): uklonjen statički `<script>` tag sa upisanim API ključem; dodat panel „Test podešavanja" gde se ključ (čuva se samo u `sessionStorage`) i jezik (`sr`/`pl`/`sq`/`en`) unose ručno, a `cms-embed.js` učitava tek na klik dugmeta „Učitaj SEO GEM" |

---

## 2026-11-02 — Pouzdano hvatanje article_id (embed + ruta + dnevno povezivanje)

| Datum | Tip | Opis |
|---|---|---|
| 2026-11-02 | fix | `public/cms-embed.js`: čekač za `article_id` kroz `localStorage` (`seoGemPending`) koji preživi ponovno učitavanje stranice po čuvanju članka; provera na 1,5 s i 5 s po učitavanju; šalje javni URL (`findPublicUrlForId`) ili `null` umesto backoffice adrese |
| 2026-11-02 | fix | `PATCH /api/cms/update-article-id` + `cms-auth.ts`: obavezna autentifikacija (`authenticateCmsRequest`, 401), standardni CORS (`corsHeaders`), provera pripadnosti portalu (`portal_id`) i 404 ako red ne postoji ili je već povezan, odbacivanje backoffice/cubesdev URL-ova |
| 2026-11-02 | fix | `src/lib/backfill-article-ids.ts`: dnevno povezivanje uzima do 500 najnovijih zapisa (poslednjih 14 dana), izdvaja slug iz segmenta odmah posle ID-a (`/\/(\d{4,})\/([^/]+)/`), indeksira po `${portal_id}\|${slug}`, proverava vremenski okvir `[created_at − 1d, created_at + 7d]`, preskače višeznačne slugove (`ambiguous`) i podržava `dryRun` |

---

## 2026-10-30 → 2026-11-02 — Ispravke van repoa (Supabase, Vercel)

| Datum | Tip | Opis |
|---|---|---|
| 2026-10-30 | fix | Supabase: constraint `title_history_selection_type_check` proširen na `ai_option_1..6` + `custom` (migracija `selection_type_allow_options_4_to_6`); istorija rekalkulisana iz `offered_titles` za 3.673 zapisa (837 → `ai_option_4`, 1.321 → 5, 1.515 → 6), backup u `title_history_selection_backup_20261030`; hotfix u `saveTitleChoice` više se ne aktivira (izvršio Claude (Cowork) direktno u Supabase/Vercel) |
| 2026-10-30 | fix | Vercel: dodata env varijabla `CRON_SECRET` (sensitive); rešen zastoj dnevnog crona `/api/admin/analytics/sync` od 11.7. do 30.10. zbog 401; cron radi od noći 31.10. (izvršio Claude (Cowork) direktno u Supabase/Vercel) |
| 2026-11-01 | data | Nadoknada analitike: ručni sync (`?date=YYYY-MM-DD`, dan po dan) za 9.7.–29.10.; GSC i GA4 kompletni za sva 3 portala za 14.6.–31.10. (`article_gsc_metrics` 38.418 → 219.105, `article_ga4_metrics` 78.432 → 407.263) (izvršio Claude (Cowork) direktno u Supabase/Vercel) |
| 2026-11-02 | data | Povezivanje unazad (`title_history`): 9.305 zapisa bez `article_id` dobilo `article_id` + `article_url` tačnim poklapanjem sluga izabranog naslova sa GA4 URL-om (backup u `title_history_articleid_backup_20261102`); pokrivenost `article_id` kroz celu istoriju 42% → 82,5% (izvršio Claude (Cowork) direktno u Supabase/Vercel) |

---

## 2026-11-02 — Procedura vraćanja na stabilno stanje

| Datum | Tip | Opis |
|---|---|---|
| 2026-11-02 | docs | Uvedena procedura vraćanja na stabilno stanje; tag stable-2026-11-02 na bd8d816 |

---

## 2026-10-30 — Srpski: nova pravila za naslove, pametna autodopuna, GEO opcija C

| Datum | Tip | Opis |
|---|---|---|
| 2026-10-30 | feat | SR prompt: ključna činjenica u svakom naslovu, jedna odluka o mestu za ceo članak, ime samo ako ga čitalac u Srbiji prepoznaje, bez preterivanja, bez praznih fraza i imperativa |
| 2026-10-30 | feat | SR: dvotačka dozvoljena samo u opciji 6; kod (COLON GUARD) prepravlja naslove 1–5 koji je imaju |
| 2026-10-30 | feat | SR GEO (opcija C): opcija 3 = pitanje, opcija 4 = izjavna rečenica-odgovor; labela u embed-u „🌍 GEO" |
| 2026-10-30 | fix | SR Google autodopuna: višerečni upiti iz teksta + filter relevantnosti (`suggest-queries.ts`) umesto jedne „primarne ključne reči" koja je donosila šum |
| 2026-10-30 | fix | Prompt više ne obavezuje model da ubaci frazu iz autodopune — samo kad se prirodno uklapa (opcije 1–4) |
| 2026-10-30 | fix | `sr.json`: dodate 44 stop reči (nakon, tokom, prema, rekao…) |
| 2026-10-30 | feat | Logovanje potrošnje tokena po pozivu (`📈 [Usage/...]`); thinking budget važi i za gemini-3* modele |
| 2026-10-30 | feat | SR dorada posle testa 1 (krađa vina): preciznost mesta (grad vs. država, bez „u Srbiji" za domaće), brendovi kao imena, GEO pitanje bez kviza, najjača informacija, logika rečenice, „u vrednosti od", precizni glagoli, raznovrsnost, KORAK 3 završna provera |
| 2026-10-30 | fix | `sr.json`: stop reči „ikada/ikad/nikada/nikad" (loši upiti za autodopunu) |
| 2026-10-30 | feat | SR dorada posle testa 2 (Jovanović): stranka uz ime političara (skraćenica u zagradi), zabrana „nosilac liste" bez naziva liste, obavezno pripisivanje izjava i obećanja |
| 2026-10-30 | feat | TITLE GUARD: kod proverava i dužinu > 70 znakova (pored dvotačke) i traži inteligentno skraćivanje; model ne broji karaktere pouzdano |
| 2026-10-30 | fix | `sr.json`: glagoli izveštavanja kao stop reči (poručio, izjavio, saopštio…) |
| 2026-10-30 | fix | SR (kod): uklanja tačku na kraju naslova i dodaje „?" pitanjima koja počinju upitnom reči; prompt: skraćenice (NPS, RIK…) umesto okrnjenih ključnih pojmova |
| 2026-10-30 | feat | **SR naslovi prelaze na `gemini-3.8-flash`** (odluka posle 5 uporednih testova); PL/AL i meta/schema ostaju na 2.5 Flash |
| 2026-10-30 | feat | **Automatska provera činjenica** naslova (SR) — `title-factcheck.ts`, model 3.8 Flash, samo jasne činjenične greške, minimalna ispravka |
| 2026-10-30 | feat | TITLE GUARD: informativni naslov (1–2) ne sme biti pitanje; prompt: vlastita imena velikim slovom („Celzijusa") |
| 2026-10-30 | fix | HOTFIX: DB check constraint dozvoljava samo `ai_option_1..3` + `custom`; `saveTitleChoice` opcije 4–6 ponovo upisuje kao `ai_option_3` (bez gubitka reda) dok se constraint ne proširi |
| 2026-10-30 | fix | NFC normalizacija ulaznog teksta u `cms/titles` i `suggest-queries` (≈3% SR tekstova ima rastavljena slova) |

---

## 2026-10-29 — selection_type: server određuje da li je naslov AI predlog ili custom

| Datum | Tip | Opis |
|---|---|---|
| 2026-10-29 | fix | `cms/generate`: `selection_type` se određuje na serveru poređenjem izabranog naslova sa ponuđenim (`ai_option_1..6` / `custom`). Embed ga nikad nije slao, pa je sve bilo `custom` |
| 2026-10-29 | feat | Analiza stila: prvo custom naslovi iz poslednjih 500 izbora; ako ih je < 10, dopuna AI-izabranim (AL portal) |
| 2026-10-29 | fix | Jednokratna ispravka istorijskih `selection_type` vrednosti u `title_history` |

---

## 2026-08-07 — RAG: Custom naslovi imaju prioritet

| Datum | Tip | Opis |
|---|---|---|
| 2026-08-07 | feat | RAG few-shot primeri sada prioritizuju custom (novinarov) naslove umesto round-robin po stilovima |
| 2026-08-07 | feat | Dodat shuffle za RAG primere — "Ponovi generisanje" sada daje raznovrsnije rezultate |

---

## 2026-07-12 — Generation log fix, URL monitor, Update endpoint

| Datum | Tip | Opis |
|---|---|---|
| 2026-07-12 | fix | **generation-logger.ts** — Prebačen sa fire-and-forget na `await`. Na Vercel serverless ~75% logova se gubilo jer se funkcija gasila pre inserata |
| 2026-07-12 | fix | **generate/route.ts, titles/route.ts** — Svi `logGeneration()` pozivi sada koriste `await` |
| 2026-07-12 | feat | **update-article-id endpoint** [NEW] — `PATCH /api/cms/update-article-id` prima `title_history_id` + `article_id`, ažurira title_history |
| 2026-07-12 | feat | **cms-embed.js — URL monitor** — Kad novinar koristi SEO GEM na `/articles/new`, posle čuvanja embed prati URL promenu i šalje PATCH sa article_id (svaki 5s, max 5 min) |
| 2026-07-12 | feat | **generate/route.ts** — Response sada vraća `titleHistoryId` embed-u za URL monitor |
| 2026-07-12 | feat | **title-history.ts** — `saveTitleChoice` sada vraća `id` insertovanog reda |
| 2026-07-12 | feat | **backfill-article-ids.ts** [NEW] — Modul za title→slug matching, transliteracija SR/PL, 15K+ slug indeks |
| 2026-07-12 | feat | **sync/route.ts** — Integrisao backfill u dnevni cron (pokreće se posle GSC/GA4 sync-a) |

---

## 2026-07-11 — GA4 verifikacija, Article ID backfill, Kumulativna analitika

### Sesija: Večernja (00:51 - 01:55)

| Datum | Tip | Opis |
|---|---|---|
| 2026-07-11 | fix | **cms-embed.js** — Robust article ID extraction sa 5 fallback paterna (URL varijante, DOM hidden fields, form action) |
| 2026-07-11 | fix | **Backfill article_id** — Retroaktivno povezivanje 2,993/3,402 zapisa u title_history (88%) putem title→slug matching sa transliteracijom srpskih slova |
| 2026-07-11 | feat | **Kumulativna analitika** — Umesto samo članaka tog dana, broje se SVI SEO GEM članci ikad generisani. Rezultat: ~60% sajta umesto ranijih ~10% |
| 2026-07-11 | fix | **GA4 re-sync jun+jul** — Svih 40 dana re-syncovano sa novim kodom koji popunjava `_pv` kolone |
| 2026-07-11 | diag | **GA4 verifikacija** — 3 članka ručno verifikovana sa GA4 UI: 57176, 55643, 53227 — svi 100% poklapanje |
| 2026-07-11 | diag | **Otkriven problem** — Pre 6. jula 0% članaka ima article_id. Uzrok: embed regex zahtevao trailing slash |

### Ključni nalaz:
- **~60% saobraćaja sajta** dolazi od članaka koji su prošli SEO GEM (kumulativno)
- **14.7%** Organic Search + **17.7%** Direct = **32.4%** Org+Dir udeo u sajtu (jul 1-9)
- **3,082** jedinstvenih članaka prošlo SEO GEM do 10. jula
- **67** novih tekstova dnevno prosečno

### TODO za sledeću sesiju:
1. Embed URL monitor (PATCH posle čuvanja članka u CMS-u)
2. Kumulativna junska tabela
3. Dashboard implementacija sa kumulativnom logikom
4. Dnevni cron za nepovezane zapise

---



### Sesija 1: Dijagnostika i backfill (00:52 - 01:05)

| Datum | Tip | Opis |
|---|---|---|
| 2026-07-10 | fix | **sync/route.ts** — Dodat `date` query parametar za manualni backfill specifičnog datuma (`?date=2026-07-04`) |
| 2026-07-10 | fix | **Cron sync** — Identifikovan 3.4-dnevni prekid sync-a (7-10 jul). Vercel cron nije radio posle deploy-a 6. jula |
| 2026-07-10 | fix | **Backfill** — Manuelno popunjeni podaci za 7 datuma: jun 13, jul 4-9. Svi uspešni (GSC: 7,643 stranica, GA4: 17,442 stranica) |
| 2026-07-10 | diag | **newsmax_pl** — 81% PL zapisa nema `article_id`. Uzrok: razlika u backoffice URL formatu |

### Sesija 2: Model incident i analiza (01:06 - 01:31)

| Datum | Tip | Opis |
|---|---|---|
| 2026-07-10 | diag | **Dashboard analiza** — Otkriveno 8 grešaka na dan 9. jul (19:11-19:38 UTC). Sve greške su Google API 404 za model `gemini-2.5-flash` |
| 2026-07-10 | diag | **Model status** — `gemini-2.5-flash` je u procesu deprecation-a (gašenje 16. okt 2026). Povremeni 404 errori, ne potpuni outage |
| 2026-07-10 | revert | **REVERT** — Pogrešno je urađena migracija na `gemini-3.5-flash` bez odobrenja i testiranja kvaliteta. Odmah vraćen `gemini-2.5-flash` |
| 2026-07-10 | diag | **Analiza troškova** — gemini-3.5-flash je 4.6× skuplji ($12.40/mesec vs $2.70). gemini-3.1-flash-lite je 22% jeftiniji ($2.10/mesec) |
| 2026-07-10 | diag | **Live test** — SEO GEM produkcija testirana: Health ✅, Generate ✅ (7.4s), model odgovara |
| 2026-07-10 | diag | **7-dnevna statistika** — 384 generacije, 373 uspešnih (97.1%), RAG 60.9%, Google Suggest 58.3% |

---

---

## 2026-07-06 — Fix: Article URL ↔ Title Mismatch

### Sesija: Rešavanje neslaganja URL-a i naslova u admin dashboardu

| Datum | Tip | Opis |
|---|---|---|
| 2026-07-06 | fix | **cms-embed.js** — Prepisana logika detekcije article URL-a. Uklonjena heuristika koja je hvatala prvi `/vest` link na CMS stranici (hvata pogrešan članak). Nova logika: izvlači article ID iz backoffice URL-a (`/articles/57081/edit` → `57081`), pa traži javni link sa tim istim ID-om |
| 2026-07-06 | fix | **cms/generate/route.ts** — Dodata server-side sanitizacija: odbacuje backoffice URL-ove, prepoznaje `article-id:` prefix |
| 2026-07-06 | fix | **analytics/articles/route.ts** — Slug-based matching sa inverted indexom za stare podatke (fallback), smanjuje mismatch sa 45% na ~15% |
| 2026-07-06 | feat | **article_id kolona** — cms-embed šalje `articleId` kao zasebno polje, čuva se u `title_history.article_id`, dashboard koristi za 100% tačan join. Slug matching ostaje kao fallback za stare zapise |
| 2026-07-06 | feat | Urađena kompletna analiza saobraćaja Newsmax SR (jun 19 - jul 5): pad uzrokovan Google Discover sezonalnošću (-72%), Web Search stabilan (+6%/dan), CTR porastao 24% |

### Root Cause:
- `cms-embed.js` je tražio BILO KOJI link na CMS stranici sa `/vest` patternom
- U backoffice-u postoje linkovi ka drugim člancima (sidebar, lista, related)
- Widget je hvatao **prvi nađeni link** — koji obično NIJE trenutni članak

---

## 2026-06-22 — Insajder.net integracija (početak) + Dokumentacija

### Sesija: Komunikacija sa Appworks timom + procedura za nove portale

| Datum | Tip | Opis |
|---|---|---|
| 2026-06-22 | docs | **Kreiran PORTAL-ONBOARDING.md** — kompletna procedura ubacivanja novih portala, korak po korak, sa checklist-om, dijagramom arhitekture, i referencom za sve postojeće portale |
| 2026-06-22 | docs | **Prepisan CMS-INTEGRATION.md** — ispravljeni netačni podaci: auth header (`Authorization: Bearer` umesto `x-api-key`), API request format (`body` umesto `url`), tačan opis embed link modela |
| 2026-06-22 | docs | **Priprema email drafta za Nikolu Jankovića (Appworks)** — objašnjenje SEO GEM sistema + zahtevi za mPanel integraciju (4 nova SEO polja + embed link) |
| 2026-06-22 | docs | Ažuriran CHANGELOG i TROUBLESHOOTING sa novim problemima |
| 2026-06-22 | status | **Mail poslat Nikoli Jankoviću (Appworks)** — čekamo odgovor sa CORS domenom i callback mehanizmom. Implementacija kreće čim stigne odgovor |

### Konstatovani problemi:

| # | Problem | Uzrok | Posledica | Status |
|---|---|---|---|---|
| 11 | AI agent nije znao kako funkcioniše embed link integracija | Dokumentacija (CMS-INTEGRATION.md) imala neprecizan opis: navodila "CMS poziva naš API" i "x-api-key", ali stvarni flow je da mi isporučujemo embed link ka našem widgetu koji radi sve | Draft maila za Appworks je 3 puta ispravljen pre nego što je tačno opisivao proces — prvo tvrdio da Nikola pravi dugme i API pozive, zatim da je iframe, konačno ispravno: mi dajemo embed link, naš widget radi kompletnu logiku | ✅ Ispravljen u PORTAL-ONBOARDING.md i CMS-INTEGRATION.md |
| 12 | Auth header u dokumentaciji pogrešan | CMS-INTEGRATION.md navodio `x-api-key` header, ali kod koristi `Authorization: Bearer <KEY>` (cms-auth.ts:33-36) | Mogla je izazvati neuspelu integraciju sa novim portalom | ✅ Ispravljen u CMS-INTEGRATION.md |
| 13 | API request format u dokumentaciji pogrešan | Dokumentacija navodila `url` kao primarni parametar, ali kod prima `body` (tekst članka) kao obavezan parametar | Mogla je izazvati neuspelu integraciju | ✅ Ispravljen u CMS-INTEGRATION.md |

---

## 2026-06-21 — Tooltip helperi za dashboard metrike

### Sesija: UX poboljšanja — laička objašnjenja metrika

| Datum | Tip | Opis |
|---|---|---|
| 2026-06-21 | feat | **Tooltip helperi (ⓘ)** — Dodati na SVE metrike u dashboardu: Landing page (4 metrike × 4 portala), Operacije tab (6 metrika), Analitika tab (GSC 5 + GA4 4 + Atribucija 3), sa laičkim objašnjenjima na srpskom |
| 2026-06-21 | feat | `tip` prop dodat na `MetricCard` i `CompRow` komponente za konzistentne tooltipove |

### Fajlovi izmenjeni 2026-06-21:

| Fajl | Tip promene |
|---|---|
| `src/app/admin/page.tsx` | Dodati tooltip helperi na sve metrike (55 insertions, 39 deletions) |

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
