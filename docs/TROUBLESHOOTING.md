# SEO GEM — Poznati problemi i rešenja

## Rešeni problemi

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
