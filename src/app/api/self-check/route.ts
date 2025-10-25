import { NextResponse } from 'next/server'
import { buildDeterministicSEO, buildSEOWithLLM } from '@/lib/seo-output'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function testLLM(provider: 'openai' | 'gemini', model: string) {
  try {
    // Lightweight probe using buildSEOWithLLM to reflect real behavior
    const sampleText = 'Ovo je kratak test sadržaj za proveru LLM generisanja naslova i meta opisa na srpskom jeziku.'
    const deterministic = buildDeterministicSEO({
      title: 'Test naslov',
      keyTerms: ['test sadržaj', 'srpski jezik', 'seo generisanje'],
      mainTopics: ['seo test'],
      searchIntentType: 'informational',
    }, sampleText)

    let used = false
    let error: string | undefined
    let title: string | undefined
    let meta: string | undefined
    let keywordsLine: string | undefined
    try {
      const out = await buildSEOWithLLM(deterministic, {
        documentTitle: 'Test naslov',
        keyTerms: ['test sadržaj', 'srpski jezik', 'seo generisanje'],
        mainTopics: ['seo test'],
        searchIntentType: 'informational',
        textSample: sampleText,
      }, { provider, model, strictModel: false })
      used = !!out && (
        out.title !== deterministic.title ||
        out.metaDescription !== deterministic.metaDescription ||
        out.keywordsLine !== deterministic.keywordsLine
      )
      title = out?.title
      meta = out?.metaDescription
      keywordsLine = out?.keywordsLine
    } catch (e: any) {
      error = e?.message || 'LLM failure'
    }
    return { ok: true, provider, model, used, error, title, meta, keywordsLine }
  } catch (e: any) {
    return { ok: false, provider, model, error: e?.message || 'unknown error' }
  }
}

export async function GET() {
  const results: any = { env: {
    provider: (process.env.SEO_LLM_PROVIDER || '').toLowerCase(),
    openaiModel: process.env.OPENAI_MODEL || '',
    geminiModel: process.env.GEMINI_MODEL || '',
    strict: (process.env.SEO_LLM_STRICT_MODEL || '').toLowerCase() === 'true',
    required: (process.env.SEO_LLM_REQUIRED || '').toLowerCase() === 'true',
    noBase: (process.env.SEO_NO_BASE_SEO || '').toLowerCase() === 'true',
  }}

  const checks: any[] = []
  // Probe Gemini if key exists
  if (process.env.GEMINI_API_KEY) {
    checks.push(await testLLM('gemini', process.env.GEMINI_MODEL || 'gemini-1.5-flash'))
  } else {
    checks.push({ ok: false, provider: 'gemini', model: process.env.GEMINI_MODEL || '', error: 'GEMINI_API_KEY missing' })
  }
  // Probe OpenAI if key exists
  if (process.env.OPENAI_API_KEY) {
    checks.push(await testLLM('openai', process.env.OPENAI_MODEL || 'gpt-4o-mini'))
  } else {
    checks.push({ ok: false, provider: 'openai', model: process.env.OPENAI_MODEL || '', error: 'OPENAI_API_KEY missing' })
  }

  results.checks = checks
  return NextResponse.json(results)
}

export async function OPTIONS() {
  return NextResponse.json({ allow: ['GET'] }, { status: 204, headers: { 'Allow': 'GET, OPTIONS' } })
}
