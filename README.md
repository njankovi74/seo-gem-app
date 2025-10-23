# SEO GEM (Serbian SEO Assistant)

Inteligentni SEO asistent optimizovan za srpski jezik. Aplikacija izvlači sadržaj sa URL‑a, vrši TF‑IDF semantičku analizu, LSA konceptualnu analizu i klasifikuje search intent.

## Stack
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Cheerio + Axios (ekstrakcija i čišćenje HTML‑a)
- Custom TF‑IDF i LSA (srpski jezik)

## Funkcionalnosti (MVP)
1) Ekstrakcija i čišćenje sadržaja sa zadatog URL‑a (.rs domen preporučen)
2) TF‑IDF analiza (semantičko jezgro, ključne fraze, čitljivost)
3) LSA analiza (koncepti, semantička sličnost, tematski klasteri) + Search Intent

## Pokretanje lokalno

Preuslovi: Node 18+ i npm

```powershell
cd "C:\SEO Asistent\seo-gem-app"
npm install
npm run dev
```

Otvori http://localhost:3000 i prati 3 koraka: URL → Pregled → SEO analiza.

## API rute

- POST `/api/extract-content`
	- Body: `{ "url": "https://primer.rs/vest" }`
	- Response: `{ title, content, metadata, wordCount, cleanText }`

- POST `/api/analyze-text`
	- Body: `{ "text": "...", "title": "(opciono)", "provider": "openai|gemini" (opciono), "model": "ime-modela" (opciono) }`
	- Response: `{ success, data: { tfidfAnalysis, lsaAnalysis, searchIntent, summary } }`

Primer (PowerShell):
```powershell
$body = '{"text":"Tehnologija AI u Srbiji brzo napreduje. Sve više kompanija ulaže u digitalnu transformaciju i automatizaciju.","title":"Digitalna transformacija i AI u Srbiji"}'
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/analyze-text -Headers @{"Content-Type"="application/json"} -Body $body | ConvertTo-Json -Depth 4
```

## Deploy (Vercel)
1) Inicijalizuj Git i napravi GitHub repo
2) Importuj repo u Vercel (framework: Next.js)
3) Deploy – podrazumevana podešavanja rade (nema posebnih env var)

## Troubleshooting
- Ako `/api/extract-content` vrati grešku, probaj drugi URL (neki sajtovi blokiraju scraping)
- Čitljivost i koncept snaga su heurističke metrike – služe za brzu procenu, ne kao apsolutni skor

## Licence
MIT

---

## (Opcionalno) Uključivanje LLM‑a i izbor modela

Aplikacija ima deterministički SEO generator i LLM poboljšanje. Podržani provajderi: OpenAI (primarno) i Gemini. Možeš birati model po zahtevu.

### 1) Zavisnosti
```powershell
cd "C:\SEO Asistent\seo-gem-app"
npm install openai @google/generative-ai
```

### 2) .env.local (primer)
```dotenv
# Biranje provajdera (opciono): openai | gemini
SEO_LLM_PROVIDER=openai
# Zahtevati LLM (ako true i LLM ne uspe, baca grešku; ako false, pada na deterministički)
SEO_LLM_REQUIRED=false

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-2025-08-07
# (opciono) kompatibilni endpoint (npr. Azure/OpenRouter)
OPENAI_BASE_URL=https://your-base-url

# Gemini
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-1.5-flash
```

### 3) Preko API‑ja: biranje modela po pozivu
- POST `/api/analyze-text` sada prihvata i `provider` i `model` (opciono) u body‑ju. Ako su prosleđeni, imaju prednost nad `.env` vrednostima za taj poziv.

Primer (PowerShell) – OpenAI, drugi model:
```powershell
$body = '{"text":"...tvoj tekst...","title":"(opciono)","provider":"openai","model":"gpt-4o-mini"}'
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/analyze-text -Headers @{"Content-Type"="application/json"} -Body $body | ConvertTo-Json -Depth 5
```

Primer (PowerShell) – Gemini:
```powershell
$body = '{"text":"...tvoj tekst...","title":"(opciono)","provider":"gemini","model":"gemini-1.5-flash"}'
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/analyze-text -Headers @{"Content-Type"="application/json"} -Body $body | ConvertTo-Json -Depth 5
```

Napomena: Ako `SEO_LLM_REQUIRED=true` i model/provajder nisu dostupni ili vrate grešku, API će vratiti grešku. Ako je `false`, rezultat će se vratiti iz determinističkog generatora.
