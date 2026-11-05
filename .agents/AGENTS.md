# SEO GEM — Pravila za AI agenta

## 📝 Obavezno ažuriranje dokumentacije

Posle SVAKE promene koda, konfiguracije, ili arhitekture, agent MORA da ažurira odgovarajući fajl u `seo-gem-app/docs/`:

### Kada ažurirati šta:

| Promena | Ažuriraj |
|---|---|
| Nova funkcionalnost ili izmena postojeće | `docs/FEATURES.md` — opis, kako radi, gde je kod |
| Novi API endpoint ili izmena postojećeg | `docs/API-REFERENCE.md` — endpoint, parametri, primer |
| CMS integracija, portal, API ključ | `docs/CMS-INTEGRATION.md` — portali, autentifikacija |
| Analytics (GA4, GSC, sync, dashboard) | `docs/ANALYTICS.md` — pipeline, metrike, matching |
| Bug fix ili rešen problem | `docs/TROUBLESHOOTING.md` — problem, uzrok, rešenje |
| Arhitekturalna odluka ili promena | `docs/ARCHITECTURE.md` — dijagram, tabele, baza |
| Bilo koja promena | `docs/CHANGELOG.md` — datum, kratki opis promene |

### Pravila za dokumentaciju:
1. **Jezik:** Srpski (latinica)
2. **Format:** Markdown sa tabelama i primerima koda
3. **Ne brisati** postojeći sadržaj — samo dodavati ili ažurirati
4. **CHANGELOG.md** — uvek dodati red na vrh sa datumom i kratkim opisom
5. Ako se menja nešto u `docs/`, agent dodaje commit poruku sa `docs:` prefiksom

### Primer CHANGELOG unosa:
```markdown
| 2026-06-19 | feat | Dodat Organic+Direct prikaz u admin dashboard |
```

## 🔧 Kodne konvencije

- Koristiti Supabase paginaciju (1000 redova po stranici) za SVE analitičke upite
- Article matching: koristiti numerički ID iz URL-a (`/(\d{4,})/`), NIKADA pun URL path
- Admin API: uvek zahtevati `admin_key` parametar
- CMS API: autentifikacija je `Authorization: Bearer <API_KEY>` (vidi `src/lib/cms-auth.ts`); `x-api-key` NE postoji
- Sve metrike zaokružiti na 1 decimalu
- Commit poruke na engleskom sa prefixom: `feat:`, `fix:`, `docs:`, `refactor:`

## 🧪 Pre deploy-a — OBAVEZNO

Agent NIKADA ne sme da commituje ili pushuje pre nego što:

1. **Build:** `npx next build` — mora proći bez grešaka
2. **Local server:** `npx next dev -p 3099` — pokrenuti lokalni server
3. **Testirati promenu:** Pozvati relevantne API endpoint-e ili otvoriti stranicu lokalno i VERIFIKOVATI da promena radi
4. **Prikazati rezultat:** Pokazati korisniku output testa pre deploy-a
5. **Tek onda:** `git add`, `git commit`, `git push`

### Redosled rada:
```
Kodiranje → Build → Local test → Potvrda da radi → Deploy
```

### NE raditi:
- ❌ Deploy pa testiranje na produkciji
- ❌ Commit bez lokalnog testa
- ❌ Svaka mala promena = novi deploy (grupirati povezane promene)

## 🔍 Izveštaj o radu SEO GEM-a — Prioriteti

Kada korisnik traži izveštaj da li SEO GEM radi, redosled provere je:

### Prioritet 1: Da li SEO GEM radi za novinare i portale
- ✅ Da li sva generisanja prolaze bez grešaka (generation_log)
- ✅ Da li se SVE beleži u bazu (title_history + generation_log moraju biti konzistentni)
- ✅ Da li embed radi na svim portalima (SR, PL, AL)
- ✅ Da li model odgovara (latency, error rate)
- ✅ Da li RAG i Google Suggest rade
- ⚠️ Ako ima BILO KAKAV jaz između tabela — istražiti ODMAH

### Prioritet 2: Analitika i praćenje
- GA4/GSC sync status
- Article ID pokrivenost
- Kumulativni obračun, dashboard
- Tabele i izveštaji

**NIKADA ne preskakati diskrepancije u podacima.** Ako title_history ima više zapisa nego generation_log, to je potencijalni bug koji se mora istražiti.

## 🛟 Vraćanje na stabilno stanje

**Stabilna tačka:** git tag `stable-2026-11-02` → commit `bd8d816` (`main`, 30.10.2026, produkcija radi ispravno). Na nju se vraćamo ako bilo šta pođe naopako.

- **a)** Svaka izmena koda radi se na posebnoj grani (`fix/...` ili `feat/...`), nikad direktno na `main`.
- **b)** Pre početka rada na grani: zabeležiti commit sa kog se kreće.
- **c)** Lokalni test je obavezan (build + `npx next dev` + test relevantne funkcije na `scripts/test-pages/cms-test.html` / `scripts/test-pages/cms-test-mpanel.html` preko `npx serve scripts/test-pages -l 8080` ili API pozivom). Ako test ne prođe: grana se NE spaja u `main`, produkcija ostaje netaknuta; prijaviti rezultat i stati.
- **d)** Spajanje u `main` (= deploy na produkciju) SAMO posle izričitog odobrenja Nebojše, nikad samostalno.
- **e)** Posle deploya: proveriti `/api/health` i jedno realno generisanje naslova. Ako produkcija ne radi ispravno: odmah `git revert` spornog commita + push (Vercel automatski deployuje vraćeno stanje), ili Vercel Instant Rollback na prethodni deployment. Prijaviti šta je urađeno.
- **f)** Env varijable na Vercelu i šema/podaci u Supabase-u se NE menjaju bez izričitog odobrenja; svaka izmena podataka ima rezervnu kopiju pre izmene.
- **g)** Svaki završen zadatak ima izveštaj: šta je rađeno, šta je urađeno, rezultat testa (stvarni output), gde smo sada, šta je sledeće.
- **h)** Ova dva fajla (`c:\SEO Asistent\.agents\AGENTS.md` i `seo-gem-app\.agents\AGENTS.md`) moraju biti identični; svaka izmena jednog odmah se prepisuje u drugi, u istom koraku.
