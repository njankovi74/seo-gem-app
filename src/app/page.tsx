'use client';

import { useState } from 'react';
import { Search, FileText, Brain, BarChart3, ExternalLink, Copy, Check } from 'lucide-react';

interface AnalysisResult {
  tfidfAnalysis: any;
  lsaAnalysis: any;
  searchIntent: any;
  summary: {
    mainTopics: string[];
    keyTerms: string[];
    readabilityScore: number;
    conceptStrength: number;
    recommendedFocus: string;
  };
  seoOutputs?: {
    title: string;
    metaDescription: string;
    keywordsLine: string;
    markdown: string;
  };
  authorMetrics?: {
    wordCount: number;
    readingTimeMin: number;
    avgSentenceLength: number;
    typeTokenRatio: number;
    repetitionScore: number;
    primaryDensity: number;
    secondaryDensity: number;
    topicCoverage: number;
    keywordCoverage: number;
    longTailUsage: number;
  };
  authorRecommendations?: {
    categories: Array<{ category: string; items: string[] }>
  };
  prioritizedKeywords?: {
    items: Array<{ term: string; score: number; category: string; reasons: string[] }>;
    csv: string;
    commaList: string;
  };
}

interface ExtractedContent {
  title: string;
  content: string;
  metadata: any;
  wordCount: number;
  cleanText: string;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [extractedContent, setExtractedContent] = useState<ExtractedContent | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'url' | 'content' | 'analysis'>('url');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleExtractContent = async () => {
    if (!url.trim()) {
      setError('Molimo unesite URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/extract-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      // Prefer JSON when present, but gracefully handle empty/non-JSON error bodies (e.g. 405)
      const isJSON = response.headers.get('content-type')?.includes('application/json');
      const payload = isJSON ? await response.json() : await response.text();

      if (!response.ok) {
        const message = isJSON ? (payload as any)?.error : (typeof payload === 'string' && payload ? payload : 'Greška pri preuzimanju sadržaja');
        throw new Error(message);
      }

      setExtractedContent(payload as any);
      setStep('content');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neočekivana greška');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeContent = async () => {
    if (!extractedContent) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: extractedContent.cleanText,
          title: extractedContent.title,
        }),
      });

      const isJSON = response.headers.get('content-type')?.includes('application/json');
      const payload = isJSON ? await response.json() : await response.text();

      if (!response.ok) {
        const message = isJSON ? (payload as any)?.error : (typeof payload === 'string' && payload ? payload : 'Greška pri analizi');
        throw new Error(message);
      }

      setAnalysisResult((payload as any).data);
      setStep('analysis');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neočekivana greška');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const resetAnalysis = () => {
    setUrl('');
    setExtractedContent(null);
    setAnalysisResult(null);
    setError('');
    setStep('url');
  };

  // Helper za render polja sa kopiranjem unutar samog polja
  const CopyField = ({ label, value, fieldKey }: { label: string; value: string; fieldKey: string }) => (
    <div className="mb-4">
      <h4 className="font-medium">{label}</h4>
      <div className="relative">
        <pre className="mt-2 p-3 bg-gray-50 border rounded text-sm whitespace-pre-wrap pr-10">{value}</pre>
        <button
          onClick={() => copyToClipboard(value, fieldKey)}
          className="absolute top-2 right-2 p-1 rounded hover:bg-gray-200 text-gray-600"
          aria-label="Kopiraj"
          title="Kopiraj"
        >
          {copiedField === fieldKey ? <Check className="w-4 h-4 text-green-600"/> : <Copy className="w-4 h-4"/>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">SEO GEM</h1>
                <p className="text-sm text-gray-500">Inteligentni SEO Asistent</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              v1.0 - Serbian Language Optimized
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-8">
            <div className={`flex items-center space-x-2 ${step === 'url' ? 'text-blue-600' : step === 'content' || step === 'analysis' ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'url' ? 'bg-blue-600 text-white' : step === 'content' || step === 'analysis' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                <Search className="w-4 h-4" />
              </div>
              <span className="font-medium">Ekstrakcija Sadržaja</span>
            </div>
            <div className={`w-16 h-0.5 ${step === 'content' || step === 'analysis' ? 'bg-green-600' : 'bg-gray-200'}`}></div>
            <div className={`flex items-center space-x-2 ${step === 'content' ? 'text-blue-600' : step === 'analysis' ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'content' ? 'bg-blue-600 text-white' : step === 'analysis' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                <FileText className="w-4 h-4" />
              </div>
              <span className="font-medium">Pregled Teksta</span>
            </div>
            <div className={`w-16 h-0.5 ${step === 'analysis' ? 'bg-green-600' : 'bg-gray-200'}`}></div>
            <div className={`flex items-center space-x-2 ${step === 'analysis' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'analysis' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                <BarChart3 className="w-4 h-4" />
              </div>
              <span className="font-medium">SEO Analiza</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Greška</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: URL Input */}
        {step === 'url' && (
          <div className="bg-white rounded-xl shadow-sm border p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Analiziraj Članak za SEO Optimizaciju
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Unesite URL novinarskog članka da biste dobili detaljnu SEO analizu 
                optimizovanu za srpsko tržište prema "Long-Tail Prvo" strategiji.
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              <div className="flex space-x-3">
                <div className="flex-1">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://primer.rs/clanak-za-analizu"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
                <button
                  onClick={handleExtractContent}
                  disabled={loading || !url.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Analiziram...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Analiziraj</span>
                    </>
                  )}
                </button>
              </div>
              
              <div className="mt-4 text-sm text-gray-500">
                <p>💡 <strong>Tip:</strong> URL treba da bude članak sa .rs domenom za najbolje rezultate</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Content Preview */}
        {step === 'content' && extractedContent && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Izvučeni Sadržaj</h2>
                <button
                  onClick={resetAnalysis}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  ← Nazad na URL
                </button>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600">{extractedContent.wordCount}</div>
                  <div className="text-sm text-blue-800">Broj reči</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">{Math.round(extractedContent.wordCount / 200)}</div>
                  <div className="text-sm text-green-800">Minuta za čitanje</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600">{extractedContent.cleanText.length}</div>
                  <div className="text-sm text-purple-800">Karaktera</div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Naslov</label>
                  <div className="p-3 bg-gray-50 rounded-lg border">
                    <p className="font-medium">{extractedContent.title}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sadržaj (prikazano prvih 500 karaktera)
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg border max-h-48 overflow-y-auto">
                    <p className="text-sm text-gray-700">
                      {extractedContent.content.substring(0, 500)}
                      {extractedContent.content.length > 500 && '...'}
                    </p>
                  </div>
                </div>

                {extractedContent.metadata.description && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Meta opis</label>
                    <div className="p-3 bg-gray-50 rounded-lg border">
                      <p className="text-sm">{extractedContent.metadata.description}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleAnalyzeContent}
                  disabled={loading}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Analiziram semantiku...</span>
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4" />
                      <span>Pokreni SEO Analizu</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Analysis Results */}
        {step === 'analysis' && analysisResult && extractedContent && (
          <div className="space-y-6">
            {/* 1) SEO izlaz (na vrhu) */}
            {analysisResult.seoOutputs && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">SEO izlaz (Markdown za kopiranje)</h3>
                  <div className="flex gap-2">
                    <button onClick={() => copyToClipboard(analysisResult.seoOutputs!.title, 'seo-title-top')} className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border">Kopiraj Title</button>
                    <button onClick={() => copyToClipboard(analysisResult.seoOutputs!.metaDescription, 'seo-meta-top')} className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border">Kopiraj Meta</button>
                    <button onClick={() => copyToClipboard(analysisResult.seoOutputs!.keywordsLine, 'seo-kw-top')} className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border">Kopiraj Keywords</button>
                    <button onClick={() => copyToClipboard(analysisResult.seoOutputs!.markdown, 'seo-md-top')} className="px-3 py-1 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded">Kopiraj ceo Markdown</button>
                  </div>
                </div>
                <div className="prose max-w-none">
                  <CopyField label="1. SEO Naslov (Title Tag)" value={analysisResult.seoOutputs.title} fieldKey="seo-title-field" />
                  <CopyField label="2. Meta Opis (Meta Description)" value={analysisResult.seoOutputs.metaDescription} fieldKey="seo-meta-field" />
                  <CopyField label="3. Formatirana Lista Ključnih Reči" value={analysisResult.seoOutputs.keywordsLine} fieldKey="seo-kw-field" />
                </div>
              </div>
            )}

            {/* 2) SEO analiza (fokus na autoru) */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">SEO Analiza</h2>
                <button onClick={resetAnalysis} className="text-sm text-gray-500 hover:text-gray-700">← Nova analiza</button>
              </div>

              {/* Author-centric KPI kartice */}
              <div className="grid md:grid-cols-4 gap-4 mb-8">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600">{extractedContent.wordCount}</div>
                  <div className="text-sm text-blue-800">Reči</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">{analysisResult.authorMetrics ? analysisResult.authorMetrics.readingTimeMin : Math.round(extractedContent.wordCount/200)}</div>
                  <div className="text-sm text-green-800">Min čitanja</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600">{analysisResult.authorMetrics ? analysisResult.authorMetrics.avgSentenceLength.toFixed(1) : '-'}</div>
                  <div className="text-sm text-purple-800">Prosečna rečenica</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="text-xl font-bold text-orange-600 capitalize">{analysisResult.searchIntent.type}</div>
                  <div className="text-sm text-orange-800">Search intent</div>
                </div>
              </div>

              {/* Dodatne metrike za vrednost teksta */}
              {analysisResult.authorMetrics && (
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <Metric label="TTR (raznolikost)" value={(analysisResult.authorMetrics.typeTokenRatio*100).toFixed(0) + '%'} tone="blue" />
                  <Metric label="Repetitivnost" value={(analysisResult.authorMetrics.repetitionScore*100).toFixed(0) + '%'} tone="rose" />
                  <Metric label="Pokrivenost tema" value={(analysisResult.authorMetrics.topicCoverage*100).toFixed(0) + '%'} tone="indigo" />
                  <Metric label="Pokrivenost ključnih reči" value={(analysisResult.authorMetrics.keywordCoverage*100).toFixed(0) + '%'} tone="emerald" />
                  <Metric label="Primarna gustina" value={(analysisResult.authorMetrics.primaryDensity*100).toFixed(2) + '%'} tone="amber" />
                  <Metric label="Long-tail prisustvo" value={(analysisResult.authorMetrics.longTailUsage*100).toFixed(0) + '%'} tone="teal" />
                </div>
              )}

              {/* Identifikovane Teme (ostavljamo), ostale analitičke sekcije sklónjene */}
              {analysisResult.summary.mainTopics.length > 0 && (
                <div className="mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Identifikovane Teme</h3>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.summary.mainTopics.map((topic, index) => (
                      <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">{topic}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3) SEO preporuke (akcije za autora) */}
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">🎯 SEO Preporuke</h3>
              {analysisResult.authorRecommendations ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {analysisResult.authorRecommendations.categories.map((cat, idx) => (
                    <div key={idx} className="bg-white border rounded p-4">
                      <div className="font-semibold mb-2 text-gray-900">{cat.category}</div>
                      <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                        {cat.items.map((it, i) => (<li key={i}>{it}</li>))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-blue-800">
                  <p><strong>Preporučeni fokus:</strong> {analysisResult.summary.recommendedFocus}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-500">
            <p>SEO GEM v1.0 - Inteligentni SEO Asistent za srpsko tržište</p>
            <p className="mt-1">Implementira "Long-Tail Prvo" strategiju sa TF-IDF i LSA analizom</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Metric({ label, value, tone = 'gray' }: { label: string; value: string; tone?: string }) {
  const toneMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-800',
    rose: 'bg-rose-50 text-rose-800',
    indigo: 'bg-indigo-50 text-indigo-800',
    emerald: 'bg-emerald-50 text-emerald-800',
    amber: 'bg-amber-50 text-amber-800',
    teal: 'bg-teal-50 text-teal-800',
    gray: 'bg-gray-50 text-gray-800',
  };
  const cls = toneMap[tone] || toneMap.gray;
  return (
    <div className={`${cls} rounded-lg p-4`}>
      <div className="text-sm">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
