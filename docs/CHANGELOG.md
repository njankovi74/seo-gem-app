# SEO GEM — Changelog

Hronološki zapis svih promena u projektu.

| Datum | Tip | Opis |
|---|---|---|
| 2026-06-19 | fix | Dashboard UX — dodat "Danas" preset, sticky zaglavlja tabele, grupne kolone GSC/GA4, indikator perioda, opisi servisa u Status tabu |
| 2026-06-19 | fix | Ispravljeni portal nazivi (Newsmax Balkans SR/AL, Newsmax Polska) i PL domen (.com → .pl) |
| 2026-06-19 | feat | Admin Dashboard v3 — multi-view arhitektura, 4 taba (Operacije, Analitika, Članci, Status), operations API, auto-refresh 30s, premium dark tema |
| 2026-06-19 | feat | Info banner za kašnjenje GSC/GA4 podataka na dashboardu |
| 2026-06-19 | docs | Kreirana kompletna dokumentacija projekta (docs/) |
| 2026-06-19 | docs | Dodat AGENTS.md — automatsko ažuriranje dokumentacije |
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
