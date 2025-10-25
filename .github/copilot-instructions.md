# Copilot instructions for this repo

Purpose: Help AI coding agents quickly understand and work productively in this codebase.

Big picture
- Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS. Server-only API routes power a 3-step UI: URL → Preview → SEO analysis.
- Core flow:
  1) /api/extract-content scrapes and cleans article text (Axios + Cheerio; JSDOM + Readability fallback).
  2) /api/analyze-text runs TF‑IDF + LSA, classifies search intent, prioritizes keywords, and generates deterministic SEO. Optionally refines via LLM (OpenAI or Gemini) with safe fallbacks.
  3) UI (`src/app/page.tsx`) calls (1) via GET ?url=… then (2) via POST with extracted cleanText.
- Default language and heuristics are Serbian (latinica). See custom stop-words and concept associations in `src/lib`.

Key code and responsibilities
- API routes (Node runtime, dynamic):
  - `src/app/api/extract-content/route.ts` – robust content extraction; validates URL, removes boilerplate, tries JSON‑LD/articleBody, falls back to Readability or selector heuristics. Returns `{ title, content, metadata, wordCount, cleanText }`.
  - `src/app/api/analyze-text/route.ts` – orchestrates TF‑IDF (`tfidf-analyzer`), LSA (`lsa-analyzer`), search intent, keyword prioritization, deterministic SEO (`seo-output`), optional LLM enhancement, and author metrics/recommendations. Accepts optional `provider`, `model`, `strict` overrides.
  - Diagnostics: `health` (env flags), `models` (list available LLM models per provider), `llm-test` (minimal round‑trip), `self-check` (LLM probe using the same pipeline).
- Lib modules:
  - `tfidf-analyzer.ts` – Serbian stop words, TF‑IDF scoring, key‑phrase extraction, readability score.
  - `lsa-analyzer.ts` – lightweight LSA with Serbian concept map, topic clusters, search intent classifier.
  - `keyword-prioritizer.ts` – "long‑tail first": ranks up to 50 terms with reasons; exports CSV and comma‑list helpers.
  - `seo-output.ts` – deterministic SEO + LLM wrapper. Enforces limits (Title ≤60, Meta ≤160, keywords line ≤300 chars), JSON‑first parsing for Gemini/OpenAI, safe fallbacks, banned clickbait tokens.
  - `author-metrics.ts` and `author-recommendations.ts` – author‑centric KPIs and actionable suggestions.

LLM integration (project-specific conventions)
- Provider selection via env or per‑request: `SEO_LLM_PROVIDER=openai|gemini`. Request body/query can override `provider`, `model`, `strict`.
- Fallback policy: if `SEO_LLM_STRICT_MODEL=true`, do not fall back to alternates; otherwise try reasonable alternates (see `seo-output.ts`). If `SEO_LLM_REQUIRED=true`, throw on LLM failure; else return deterministic output and include diagnostics.
- Never echo API key values. Diagnostics expose only booleans (hasKeys) and error strings. Respect `SEO_DEBUG` when formatting error messages.
- Use literal dynamic imports for SDKs so bundlers/serverless tracing include packages: `await import('openai')`, `await import('@google/generative-ai')`.

Important patterns and gotchas
- All API routes set `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'` to avoid static optimization and enable Node libs (JSDOM, Cheerio).
- `next.config.ts` sets `serverExternalPackages` for heavy Node deps.
- Extraction prefers JSON‑LD `articleBody`, then Readability, then selector heuristics with Serbian stop tokens.
- When adding outputs that must fit UX constraints, reuse `truncate` and `joinWithCharLimit` patterns (see `seo-output.ts`) and keep Serbian tone/format rules.
- Logging: return JSON errors; map Axios/network errors to user‑friendly messages in `extract-content` and honor `SEO_DEBUG` in analysis.

Developer workflows
- Run locally (Windows PowerShell):
  - `npm install`
  - `npm run dev` (Next.js dev server)
  - Optional checks: `npm run lint`, `npm run build`, `npm start`
- API probes:
  - Extract: `GET /api/extract-content?url=<encoded>`
  - Analyze quick test: `GET /api/analyze-text?text=...&provider=gemini&model=gemini-2.5-pro` (use for light checks)
  - LLM status: `GET /api/health`, `GET /api/models?provider=openai|gemini`, `GET /api/llm-test?provider=...&model=...`, `GET /api/self-check`

When extending the system
- New API routes: copy the OPTIONS handler and `runtime/dynamic` exports; always return JSON. If calling LLMs, use the established `buildSEOWithLLM` pattern and diagnostics structure.
- New analyzers: compose from `tfidf-analyzer` and `lsa-analyzer` results; keep Serbian language assumptions and avoid leaking PII/secrets.
- Environment: reference only variable names; do not hardcode or log values. Expected vars: `SEO_LLM_PROVIDER`, `SEO_LLM_REQUIRED`, `SEO_LLM_STRICT_MODEL`, `SEO_DEBUG`, `SEO_NO_BASE_SEO`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`.

References in repo
- UI: `src/app/page.tsx` (3-step flow, calls APIs; Windows‑friendly fetch usage)
- APIs: `src/app/api/*/route.ts`
- Core logic: `src/lib/*.ts`
- Config: `next.config.ts`, `eslint.config.mjs`, `package.json` scripts
