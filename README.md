# SEO GEM

AI-powered SEO asistent za novinarske portale. Generiše optimizovane naslove, meta opise i ključne reči koristeći NLP analizu (TF-IDF + LSA) i LLM (Gemini 2.5 Flash), a zatim prati performanse članaka kroz Google Search Console i Google Analytics 4.

## Stack
- **Framework:** Next.js 16 (App Router) + TypeScript
- **LLM:** Google Gemini 2.5 Flash (primarni) + OpenAI (embeddings)
- **NLP:** TF-IDF, LSA, franc (detekcija jezika)
- **Baza:** Supabase (PostgreSQL)
- **Deploy:** Vercel + Cron
- **Analytics:** Google Search Console + Google Analytics 4

## Portali
| Portal | Jezik | Domen |
|---|---|---|
| 🇷🇸 Newsmax Balkans SR | Srpski | newsmaxbalkans.com |
| 🇦🇱 Newsmax Balkans AL | Albanski | newsmaxbalkans.al |
| 🇵🇱 Newsmax Polska | Poljski | newsmaxpolska.pl |

## Dokumentacija

| Dokument | Opis |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arhitektura sistema, tech stack, dijagrami, env varijable |
| [FEATURES.md](docs/FEATURES.md) | Sve funkcionalnosti sa parametrima i ograničenjima |
| [API-REFERENCE.md](docs/API-REFERENCE.md) | Kompletna API dokumentacija (13 endpoint-a) |
| [CMS-INTEGRATION.md](docs/CMS-INTEGRATION.md) | CMS integracija, portali, embed, RAG sistem |
| [ANALYTICS.md](docs/ANALYTICS.md) | GA4/GSC pipeline, dashboard, matching, DB šema |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Poznati problemi i rešenja |
| [CHANGELOG.md](docs/CHANGELOG.md) | Hronološki zapis svih promena |

## Pokretanje lokalno

```powershell
cd "C:\SEO Asistent\seo-gem-app"
npm install
npm run dev
```

Otvori http://localhost:3000

## Deploy (Vercel)
```bash
git add -A
git commit -m "feat: opis promene"
git push origin main
```
Vercel automatski deployuje iz `main` branch-a.

## Licence
MIT
