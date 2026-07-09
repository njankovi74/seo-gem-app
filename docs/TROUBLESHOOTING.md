# SEO GEM — Poznati problemi i rešenja

## Aktivni problemi

### A1. Gemini 2.5 Flash — Povremeni 404 errori (jul 2026)

**Problem:** Model `gemini-2.5-flash` povremeno vraća `404 Not Found` sa porukom "This model is no longer available". Na dashboardu se prikazuje kao `server_error` na `titles` endpointu.

**Uticaj:** 8 grešaka od 384 poziva (2.1%) u periodu 3-9. jul. Sve greške na 1 dan (9. jul), u prozoru od 27 minuta (19:11-19:38 UTC). Uspešnost: 97.1%.

**Uzrok:** Google je objavio deprecation `gemini-2.5-flash` modela — potpuno gašenje zakazano za **16. oktobar 2026**. Tokom tranzicije, model ima intermitentne 404 greške.

**Status:** Model i dalje radi u 97%+ slučajeva. Nema hitnosti, ali migracija je obavezna pre oktobra.

**Opcije za migraciju:**

| Model | Input cena | Output cena | Mesečni trošak (~1,650 gen) | Razlika |
|---|---|---|---|---|
| gemini-2.5-flash (trenutni) | $0.30/1M | $2.50/1M | ~$2.70 | baseline |
| gemini-3.5-flash | $1.50/1M | $9.00/1M | ~$12.40 | **+360%** |
| gemini-3.1-flash-lite | $0.25/1M | $1.50/1M | ~$2.10 | **-22%** |

**Pre migracije OBAVEZNO:**
1. Testirati kvalitet naslova na istom tekstu sa oba modela
2. Proveriti da li prompt, thinking budget i temperature rade
3. Uporediti latency
4. Dobiti odobrenje za promenu

---

### A2. Vercel Cron — Zaustavljanje posle deploy-a (jul 2026)

**Problem:** Vercel cron (`0 3 * * *`) je prestao da radi posle deploy-a 6. jula. Sync nije radio 3.4 dana (7-10. jul).

**Uticaj:** Nedostajali GSC/GA4 podaci za jul 4-9. Manuelno popunjeni putem backfill-a.

**Uzrok:** Vercel ponekad ne restartuje cron schedule posle novog deploy-a. Dokumentovano u Vercel community forumima.

**Rešenje:** Dodat `date` parametar u sync route za manualni backfill:
```
GET /api/admin/analytics/sync?admin_key=***&date=2026-07-04
```

**Preventiva:** Potreban monitoring — proveriti u Vercel Dashboard → Cron Jobs → poslednje pokretanje.

---

### A3. newsmax_pl — article_id ne radi na 81% zapisa (jul 2026)

**Problem:** Samo 19% zapisa sa newsmax_pl portala ima `article_id`. Polje `article_url` je takođe prazno.

**Uzrok:** Mogući razlozi:
- PL backoffice URL ima drugačiji format od SR portala
- Novinari koriste cache-iranu verziju embed skripte
- `cms-embed.js` regex `/\/articles\/(\d{4,})\//` ne odgovara PL URL formatu

**Status:** Za istraživanje — potrebno proveriti PL backoffice URL format.

---

## Rešeni problemi

### 0. Article URL ↔ Title Mismatch u admin dashboardu (jul 2026)

**Problem:** U admin dashboardu, SEO naslov članka se ne poklapa sa URL-om. Npr. naslov kaže "Odbor Skupštine ocenio uskladenost..." ali URL vodi na potpuno drugi članak. Mismatch rate bio 45%.

**Uzrok:** `cms-embed.js` je koristio heuristiku koja pretražuje SVE linkove na CMS backoffice stranici i hvata prvi koji sadrži `/vest` pattern. U backoffice-u postoje linkovi ka drugim člancima (sidebar, lista nedavnih, related), pa widget hvata pogrešan link.

**Rešenje (3 faze):**

**Faza 1 — Sprečavanje budućih pogrešnih URL-ova:**
1. **`public/cms-embed.js`** — Prepisana URL detekcija:
   - Izvlači article ID iz backoffice URL-a (`/articles/57081/edit` → `57081`)
   - Traži link na stranici koji sadrži TAJ ISTI ID i nije backoffice
   - Ako nema — šalje prazan string umesto pogrešnog URL-a
2. **`src/app/api/cms/generate/route.ts`** — Server-side sanitizacija URL-a

**Faza 2 — Slug-based matching za stare zapise:**
3. **`src/app/api/admin/analytics/articles/route.ts`** — Inverted index slug matching:
   - Normalizuje naslove i URL slugove (uklanja dijakritike, stop-words)
   - Poredi ključne reči iz naslova sa slug-om u URL-u
   - Zahteva minimum 2 poklapanja reči i score ≥ 0.25
   - Smanjuje mismatch sa 45% na ~15%

**Faza 3 — Direktno ID matching (konačno rešenje):**
4. **`cms-embed.js`** — Šalje `articleId` kao zasebno polje u API
5. **`title-history.ts`** — Čuva `article_id` u novu kolonu u Supabase
6. **`articles/route.ts`** — Tri strategije po prioritetu:
   - Strategy 0: `article_id` kolona (novi zapisi) → **100% tačno**
   - Strategy 1: Slug match stored URL-a (stari zapisi) → ~75%
   - Strategy 2: Inverted index pretraga svih slugova → ~70%

**Supabase migracija:**
```sql
ALTER TABLE public.title_history ADD COLUMN IF NOT EXISTS article_id TEXT;
CREATE INDEX IF NOT EXISTS idx_title_history_article_id ON public.title_history (article_id);
```

**Fajlovi:** `public/cms-embed.js`, `src/app/api/cms/generate/route.ts`, `src/lib/title-history.ts`, `src/app/api/admin/analytics/articles/route.ts`

### 1. Supabase vraća samo 1000 redova (jun 2026)

**Problem:** Dashboard je prikazivao netačne podatke — samo 422 pregleda za 502 članaka. Supabase `select()` ima server-side limit od 1000 redova po zahtevu.

**Uzrok:** Korišćen je `.limit(5000)` i `.range(0, 4999)`, ali Supabase ignoriše ovo i vraća max 1000.

**Rešenje:** Implementirana paginacija sa `pageSize = 1000`:
```typescript
async function fetchAll(sb, table, select, filters, pageSize = 1000) {
  const all = [];
  let from = 0;
  while (true) {
    const { data } = await sb.from(table).select(select).range(from, from + pageSize - 1);
    if (!data || !data.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
```

**Fajl:** `src/app/api/admin/analytics/overview/route.ts`, `src/app/api/admin/analytics/articles/route.ts`

---

### 2. URL matching — pun path ne radi (jun 2026)

**Problem:** 0% poklapanja između `title_history` i `article_ga4_metrics` URL-ova. Title history čuva URL u formatu `https://domain.com/kategorija/vesti/12345/slug`, dok GA4 čuva pathname `/kategorija/vesti/12345/slug/vest`.

**Uzrok:** Korišćen je `new URL(url).pathname` za matching, ali putanje se razlikuju (sa/bez `/vest` sufiksa, sa/bez domena).

**Rešenje:** Izvlačenje numeričkog article ID-a (4+ cifara) iz URL-a:
```typescript
function extractArticleId(url: string): string | null {
  const match = url.match(/\/(\d{4,})\//);
  return match ? match[1] : null;
}
```

**Rezultat:** 92% match rate (695 od 756 članaka).

**Fajl:** `src/app/api/admin/analytics/overview/route.ts`, `src/app/api/admin/analytics/articles/route.ts`

---

### 3. Period filter ne menja podatke (jun 2026)

**Problem:** Korisnik je primetio da su podaci isti za svaki odabrani period (Juče, 7 dana, 14 dana).

**Uzrok:** State management bug — `startDate` i `endDate` nisu bili pravilno ažurirani u `useEffect` dependency array.

**Rešenje:** Refaktorisana logika perioda sa Custom kalendarom i pravilnim callback-ovima.

---

### 4. Članci tab prikazuje sve URL-ove umesto samo SEO GEM (jun 2026)

**Problem:** Tab "Članci" je prikazivao sve URL-ove sa analitikom, uključujući one koji nisu prošli kroz SEO GEM. Većina je bila "(bez naslova)".

**Uzrok:** API je koristio union svih URL-ova iz GSC + GA4, a ne filtrirao po `title_history`.

**Rešenje:** Kompletno prepisan `articles/route.ts` — sada je `title_history` primarni izvor, pa se za svaki SEO GEM članak traže GSC i GA4 podaci po article ID-u.

---

### 5. Status tab prikazuje "Nepovezan" za sve servise (jun 2026)

**Problem:** Na Status tabu svi servisi (GSC, GA4, CMS, LLM) prikazani kao "○ Nepovezan" iako dashboard koristi podatke sa svih servisa normalno.

**Uzrok:** Frontend StatusTab tražio `data.gsc`, `data.ga4`, `data.cms`, `data.llm` u API odgovoru, ali API `/api/admin/analytics/status` vraća potpuno drugačiju strukturu: `{ success: true, portals: [{ portal_id, gsc_connected, ga4_connected, ... }], summary: { total, gsc_connected, ga4_connected } }`. Ovi ključevi nikad nisu postojali u odgovoru.

**Rešenje:** Kompletno prepisan `StatusTab` da čita `data.portals[]` i `data.summary`. Dodata sekcija "Konekcije po portalu" sa GSC/GA4 statusom i vremenima poslednjeg sync-a po portalu.

**Fajl:** `src/app/admin/page.tsx` (StatusTab komponenta)

---

### 6. Pogrešni nazivi portala i domen (jun 2026)

**Problem:** Dashboard prikazivao pogrešne nazive portala: "Newsmax.rs", "Newsmax.pl", "Newsmax.al". Korisnik primetio da su domeni pogrešni. Takođe, embed link domen za Poljsku bio `newsmaxpolska.com` umesto `newsmaxpolska.pl`.

**Uzrok:** Hardkodirani pogrešni nazivi u `PORTAL_DISPLAY` konstantama. Domen u `generate/route.ts` kopiran pogrešno.

**Rešenje:**
- `PORTAL_DISPLAY`: newsmax → "Newsmax Balkans SR", newsmax_pl → "Newsmax Polska", newsmax_al → "Newsmax Balkans AL"
- `generate/route.ts`: `newsmaxpolska.com` → `newsmaxpolska.pl`

**Fajlovi:** `src/app/admin/page.tsx`, `src/app/api/cms/generate/route.ts`

---

### 7. Date picker zahteva ručno kucanje datuma (jun 2026)

**Problem:** Custom date picker koristio nativne `<input type="date">` elemente koji izgledaju kao obično tekstualno polje. Korisnici morali ručno da upisuju datum u format MM/DD/YYYY.

**Uzrok:** Nativni date input na nekim sistemima ne prikazuje kalendar popup na klik, samo mali ikonu.

**Rešenje:** Kreirana potpuno nova `CalendarPicker` komponenta sa vizuelnim mesečnim gridom. Klik na dan za selekciju, ◀ ▶ za mesece, range highlighting, srpski nazivi.

**Fajl:** `src/app/admin/page.tsx` (CalendarPicker komponenta)

---

### 8. Preset "7 dana" ostaje aktivno kad se izabere custom datum (jun 2026)

**Problem:** Korisnik je odabrao 12. jun ručno, ali dugme "7 dana" je i dalje prikazano kao aktivno (ljubičasto). Period je prikazivao tačan datum ali vizuelno zbunjuje jer preset ne odgovara.

**Uzrok:** `activePreset` state se nije resetovao na 0 kad se primeni custom datum.

**Rešenje:** `applyCustom()` i CalendarPicker `onApply()` postavljaju `setActivePreset(0)` što deaktivira sve preset dugmad.

**Fajl:** `src/app/admin/page.tsx`

---

### 9. Dokumentacija o integraciji bila netačna — embed link konfuzija (jun 2026)

**Problem:** Pri pripremi integracije za novi portal (Insajder.net), AI agent je 3 puta pogrešno opisao kako funkcioniše CMS integracija. Prvo tvrdio da CMS developer (Nikola/Appworks) treba da pravi dugme i piše fetch() pozive ka našem API-ju. Zatim pominjao iframe. Konačno, nakon pregleda `page.tsx` i `CMS-INTEGRATION.md`, utvrđeno je da mi isporučujemo embed link ka našem widgetu koji kompletno radi sve.

**Uzrok:** `CMS-INTEGRATION.md` imao neprecizan opis u sekciji "Embed u CMS" — navodio da "Widget poziva `/api/cms/titles`" bez da jasno kaže da je widget **naš**, hostan na **našem** domenu. Takođe, agent nije pregledao `page.tsx` (koji je SAM widget) i oslanjao se samo na API route fajlove.

**Rešenje:**
1. Kreiran **PORTAL-ONBOARDING.md** — definitivna procedura sa dijagramom arhitekture
2. Prepisan **CMS-INTEGRATION.md** — tačan opis embed link modela
3. Dokumentovano da CMS developer NE piše logiku za generisanje — samo ugrađuje naš link

**Pouka:** Uvek proveriti `page.tsx` (frontend widget) i `cms-auth.ts` (CORS + auth) pre opisivanja integracionog modela. Ne oslanjati se samo na API route fajlove.

**Fajlovi:** `docs/PORTAL-ONBOARDING.md` (nov), `docs/CMS-INTEGRATION.md` (prepisan)

---

### 10. Auth header u dokumentaciji pogrešan (jun 2026)

**Problem:** `CMS-INTEGRATION.md` navodio da je auth header `x-api-key`, ali kod u `cms-auth.ts` koristi `Authorization: Bearer <KEY>`.

**Uzrok:** Dokumentacija pisana ručno i nikad sinhronizovana sa kodom.

**Rešenje:** Ispravljen na `Authorization: Bearer <API_KEY>` u svim dokumentima. Dodata napomena u PORTAL-ONBOARDING.md.

**Referentni fajl:** `src/lib/cms-auth.ts`, linije 33-36

---

### 11. API request format u dokumentaciji pogrešan (jun 2026)

**Problem:** Dokumentacija navodila `url` kao primarni request parametar za `/api/cms/titles`, ali kod prima `body` (tekst članka) kao obavezno polje. URL je opcionalan parametar samo za logovanje.

**Uzrok:** Isti kao #10 — dokumentacija nikad sinhronizovana sa kodom.

**Rešenje:** Ispravljen request format u CMS-INTEGRATION.md sa tačnim obaveznim i opcionim parametrima.

**Referentni fajl:** `src/app/api/cms/titles/route.ts`, linije 40-55

---

## Poznata ograničenja

### 1. GSC podaci kasne 2-3 dana
Google Search Console API ne daje podatke za poslednja 2-3 dana. Ovo je ograničenje Google-a, ne naše.

### 2. GA4 podaci kasne 1 dan
Google Analytics 4 API ne daje podatke za danas. Poslednji dostupan datum je juče.

### 3. Organic/Direct procenat je prosečan, ne ponderisan
Procenat izvora saobraćaja (Organic, Direct) se izračunava kao aritmetički prosek po danima, a ne ponderisan prosek po broju pregleda. Za članke sa velikim varijacijama u dnevnom saobraćaju, ovo može dati blago neprecizne procente.

### 4. ~8% SEO GEM članaka nema match u GA4
Oko 61 od 756 (8%) SEO GEM članaka nema podatke u GA4. Mogući razlozi:
- Članak je objavljen ali nema saobraćaja
- URL format u GA4 se razlikuje (bez numeričkog ID-a)
- Članak je obrisan sa sajta ali ostao u `title_history`
