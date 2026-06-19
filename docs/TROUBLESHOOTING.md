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
