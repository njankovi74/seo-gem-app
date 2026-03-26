'use client';

import { useState } from 'react';
import { Search, FileText, Brain, BarChart3, ExternalLink, Copy, Check, Info, HelpCircle, X, RefreshCw, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import InfoModal from '@/components/InfoModal';
import GemLogo from '@/components/GemLogo';

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
    schemaMarkup: string;
    markdown: string;
  };
  seoOutputsGemini?: {
    title: string;
    metaDescription: string;
    keywordsLine: string;
    schemaMarkup: string;
    markdown: string;
  };
  seoOutputsOpenAI?: {
    title: string;
    metaDescription: string;
    keywordsLine: string;
    schemaMarkup: string;
    markdown: string;
  };
  llm?: {
    dualMode?: boolean;
    geminiModel?: string;
    openaiModel?: string;
    geminiError?: string;
    openaiError?: string;
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

interface TitleOption {
  text: string;
  style: 'informativni' | 'geo_pitanje' | 'discover_hook';
  length: number;
  reasoning: string;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [extractedContent, setExtractedContent] = useState<ExtractedContent | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'url' | 'content' | 'titleSelection' | 'analysis'>('url');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  
  // Title selection state
  const [titleOptions, setTitleOptions] = useState<TitleOption[]>([]);
  const [selectedTitleIndex, setSelectedTitleIndex] = useState<number | 'custom'>('custom');
  const [customTitle, setCustomTitle] = useState('');

  const handleExtractContent = async () => {
    if (!url.trim()) {
      setError('Molimo unesite URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Use GET with query to avoid any platform issues with POST/JSON preflight
      const qs = new URLSearchParams({ url }).toString();
      const response = await fetch(`/api/extract-content?${qs}`, {
        method: 'GET',
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
      // First, generate title options
      // Combine title + lead + body for better context
      const fullContext = [
        extractedContent.title,
        extractedContent.metadata?.description || '',
        extractedContent.content
      ].filter(Boolean).join('\n\n');

      const titleResponse = await fetch('/api/generate-title-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleText: fullContext,
          primaryKeyword: '', // Will be extracted from content
          secondaryKeywords: [],
          mainTopics: [],
          searchIntent: 'informational'
        }),
      });

      const isJSON = titleResponse.headers.get('content-type')?.includes('application/json');
      const titlePayload = isJSON ? await titleResponse.json() : await titleResponse.text();

      if (!titleResponse.ok) {
        const message = isJSON ? (titlePayload as any)?.error : 'Greška pri generisanju naslova';
        throw new Error(message);
      }

      const titleData = titlePayload as any;
      if (titleData.success && titleData.titles) {
        setTitleOptions(titleData.titles);
        setStep('titleSelection');
      } else {
        throw new Error('Nema generisanih naslova');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neočekivana greška pri generisanju naslova');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMetaAndKeywords = async () => {
    if (!extractedContent) return;

    // GUARD: Ensure extracted content has actual article text (not just a slug)
    if (!extractedContent.content || extractedContent.content.trim().length < 50) {
      console.warn('⚠️ [frontend] extractedContent.content is empty or too short:', extractedContent.content?.length || 0);
      setError('Sadržaj članka nije učitan. Molimo pokušajte ponovo sa ekstrakcijom.');
      return;
    }

    // Determine selected title
    let selectedTitle = '';
    let selectionType: 'ai_option_1' | 'ai_option_2' | 'ai_option_3' | 'custom' = 'custom';
    
    if (selectedTitleIndex === 'custom') {
      selectedTitle = customTitle.trim();
      selectionType = 'custom';
    } else if (typeof selectedTitleIndex === 'number' && titleOptions[selectedTitleIndex]) {
      selectedTitle = titleOptions[selectedTitleIndex].text;
      selectionType = `ai_option_${selectedTitleIndex + 1}` as any;
    }

    if (!selectedTitle) {
      setError('Molimo odaberite ili unesite naslov');
      return;
    }

    if (selectedTitle.length > 75) {
      setError('Naslov mora biti kraći od 75 karaktera');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: extractedContent.content,
          title: extractedContent.title,
          selectedTitle,
          selectionType,
          offeredTitles: titleOptions,
          articleUrl: url,
          articleMetadata: {
            authorName: extractedContent.metadata?.author || '',
            publishedTime: extractedContent.metadata?.publishDate || '',
            dateModified: extractedContent.metadata?.dateModified || '',
            imageUrl: extractedContent.metadata?.imageUrl || '',
            publisherName: extractedContent.metadata?.publisherName || '',
            articleSection: extractedContent.metadata?.articleSection || '',
          }
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
    setTitleOptions([]);
    setSelectedTitleIndex('custom');
    setCustomTitle('');
  };

  // Helper za render polja sa kopiranjem unutar samog polja
  const CopyField = ({ label, value, fieldKey }: { label: string; value: string; fieldKey: string }) => (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <h4 className="font-medium">{label}</h4>
        <span className="text-xs text-gray-500">{value.length} karaktera</span>
      </div>
      <div className="relative">
        <pre className="mt-2 p-3 bg-gray-50 border rounded text-sm text-gray-900 whitespace-pre-wrap pr-10">{value}</pre>
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/30">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={resetAnalysis}
              className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
              title="Povratak na početak"
            >
              <GemLogo size={42} />
              <div className="text-left">
                <h1 className="text-xl font-bold text-gray-900">SEO GEM</h1>
                <p className="text-sm text-gray-500">Inteligentni SEO Asistent</p>
              </div>
            </button>
            <div className="flex items-center">
              <button
                onClick={() => setShowHelp(true)}
                className="flex items-center space-x-2 px-4 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                title="Uputstvo za korišćenje"
              >
                <HelpCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Uputstvo</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            <div className={`flex items-center space-x-2 ${step === 'url' ? 'text-emerald-600' : (step === 'content' || step === 'titleSelection' || step === 'analysis') ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'url' ? 'bg-emerald-600 text-white' : (step === 'content' || step === 'titleSelection' || step === 'analysis') ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                <Search className="w-4 h-4" />
              </div>
              <span className="font-medium text-sm">Ekstrakcija</span>
            </div>
            <div className={`w-12 h-0.5 ${(step === 'content' || step === 'titleSelection' || step === 'analysis') ? 'bg-green-600' : 'bg-gray-200'}`}></div>
            <div className={`flex items-center space-x-2 ${step === 'content' ? 'text-emerald-600' : (step === 'titleSelection' || step === 'analysis') ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'content' ? 'bg-emerald-600 text-white' : (step === 'titleSelection' || step === 'analysis') ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                <FileText className="w-4 h-4" />
              </div>
              <span className="font-medium text-sm">Pregled</span>
            </div>
            <div className={`w-12 h-0.5 ${(step === 'titleSelection' || step === 'analysis') ? 'bg-green-600' : 'bg-gray-200'}`}></div>
            <div className={`flex items-center space-x-2 ${step === 'titleSelection' ? 'text-emerald-600' : step === 'analysis' ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'titleSelection' ? 'bg-emerald-600 text-white' : step === 'analysis' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                <Brain className="w-4 h-4" />
              </div>
              <span className="font-medium text-sm">Izbor Naslova</span>
            </div>
            <div className={`w-12 h-0.5 ${step === 'analysis' ? 'bg-green-600' : 'bg-gray-200'}`}></div>
            <div className={`flex items-center space-x-2 ${step === 'analysis' ? 'text-emerald-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'analysis' ? 'bg-emerald-600 text-white' : 'bg-gray-200'}`}>
                <BarChart3 className="w-4 h-4" />
              </div>
              <span className="font-medium text-sm">SEO Analiza</span>
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
              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                Analiziraj Članak za SEO Optimizaciju
              </h2>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
                Pretvorite vaše vesti u primarni izvor za AI pretraživače i Google Discover.
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900"
                    disabled={loading}
                  />
                </div>
                <button
                  onClick={handleExtractContent}
                  disabled={loading || !url.trim()}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 font-semibold shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/50 transition-all duration-200"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Analiziram...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>[ Optimizuj vest ]</span>
                    </>
                  )}
                </button>
              </div>
              
              <div className="mt-3 text-center">
                <p className="text-sm text-gray-400 italic">(Rezultati gotovi za 3 sekunde)</p>
              </div>

              <div className="mt-6 flex items-center justify-center">
                <button
                  onClick={() => setShowInfo(true)}
                  className="inline-flex items-center space-x-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium hover:underline transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Šta je SEO GEM? — Saznajte više</span>
                </button>
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
                <div className="bg-emerald-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-emerald-600">{extractedContent.wordCount}</div>
                  <div className="text-sm text-emerald-800">Broj reči</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">{Math.round(extractedContent.wordCount / 200)}</div>
                  <div className="text-sm text-green-800">Minuta za čitanje</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600">{extractedContent.content.length}</div>
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

                {extractedContent.metadata.description && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Lead / Meta opis</label>
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <p className="text-sm font-medium text-emerald-900">{extractedContent.metadata.description}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preuzet sadržaj: Lead + Body ({
                      (extractedContent.metadata.description?.length || 0) + extractedContent.content.length
                    } karaktera)
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg border max-h-96 overflow-y-auto">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {extractedContent.metadata.description && (
                        <span className="font-semibold text-emerald-900">
                          {extractedContent.metadata.description}
                          {'\n\n'}
                        </span>
                      )}
                      {extractedContent.content}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleAnalyzeContent}
                  disabled={loading}
                  className="px-8 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 font-semibold shadow-lg shadow-emerald-600/25 transition-all duration-200"
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

        {/* Step 2.5: Title Selection */}
        {step === 'titleSelection' && titleOptions.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border pb-20">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Odaberi SEO Naslov</h2>
                  <p className="text-sm text-gray-500 mt-1">AI je generisao 6 naslova u 3 kategorije. Odaberi jedan ili unesi sopstveni.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={handleAnalyzeContent} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50 border border-emerald-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Generiši nove naslove">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Generiši ponovo
                  </button>
                  <button onClick={() => setStep('content')} className="text-sm text-gray-500 hover:text-gray-700">← Nazad</button>
                </div>
              </div>

              <div className="space-y-5">
                {(() => {
                  const catConfig: Record<string, { label: string; color: string; bg: string; border: string; activeBg: string; activeBorder: string }> = {
                    'informativni': { label: '📰 Informativni', color: 'text-blue-700', bg: 'bg-blue-50/50', border: 'border-blue-100', activeBg: 'bg-blue-50', activeBorder: 'border-blue-500' },
                    'geo_pitanje': { label: '🌍 GEO Pitanje', color: 'text-emerald-700', bg: 'bg-emerald-50/50', border: 'border-emerald-100', activeBg: 'bg-emerald-50', activeBorder: 'border-emerald-500' },
                    'discover_hook': { label: '🔮 Discover Hook', color: 'text-purple-700', bg: 'bg-purple-50/50', border: 'border-purple-100', activeBg: 'bg-purple-50', activeBorder: 'border-purple-500' },
                  };
                  const categories = ['informativni', 'geo_pitanje', 'discover_hook'];
                  return categories.map(cat => {
                    const cfg = catConfig[cat];
                    const catTitles = titleOptions.map((opt, idx) => ({ ...opt, originalIdx: idx })).filter(opt => opt.style === cat);
                    if (catTitles.length === 0) return null;
                    return (
                      <div key={cat} className={`rounded-xl ${cfg.bg} ${cfg.border} border p-4`}>
                        <h3 className={`text-sm font-bold ${cfg.color} mb-3 uppercase tracking-wide`}>{cfg.label}</h3>
                        <div className="space-y-2">
                          {catTitles.map((option) => (
                            <label key={option.originalIdx} className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all bg-white ${selectedTitleIndex === option.originalIdx ? `${cfg.activeBorder} ${cfg.activeBg}` : 'border-transparent hover:border-gray-200'}`}>
                              <input type="radio" name="title" checked={selectedTitleIndex === option.originalIdx} onChange={() => setSelectedTitleIndex(option.originalIdx)} className="mt-1 accent-emerald-600" />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 text-base">{option.text}</div>
                                <div className="flex items-center gap-2 mt-1"><span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{option.text.length} kar.</span></div>
                                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{option.reasoning}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}

                <div className={`rounded-xl border-2 border-dashed p-4 transition-all ${selectedTitleIndex === 'custom' ? 'border-purple-400 bg-purple-50/30' : 'border-gray-200'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" name="title" checked={selectedTitleIndex === 'custom'} onChange={() => setSelectedTitleIndex('custom')} className="accent-emerald-600" />
                    <span className="font-semibold text-gray-900 text-sm">✏️ Sopstveni naslov</span>
                  </label>
                  {selectedTitleIndex === 'custom' && (
                    <div className="mt-3 ml-7">
                      <input type="text" value={customTitle} onChange={(e) => { setCustomTitle(e.target.value); setSelectedTitleIndex('custom'); }} maxLength={75} placeholder="Unesite sopstveni SEO naslov..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-900" />
                      <div className={`text-xs mt-1 ${customTitle.length > 70 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>{customTitle.length}/75 karaktera</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t shadow-[0_-4px_12px_rgba(0,0,0,0.05)] p-4 z-40">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  {selectedTitleIndex !== 'custom' && typeof selectedTitleIndex === 'number' && titleOptions[selectedTitleIndex]
                    ? <span>Izabrano: <strong className="text-gray-900">{titleOptions[selectedTitleIndex].text.slice(0, 50)}...</strong></span>
                    : selectedTitleIndex === 'custom' && customTitle
                    ? <span>Sopstveni: <strong className="text-gray-900">{customTitle.slice(0, 50)}...</strong></span>
                    : <span className="italic">Izaberite naslov iznad</span>
                  }
                </div>
                <button onClick={handleGenerateMetaAndKeywords} disabled={loading || (selectedTitleIndex === 'custom' && !customTitle.trim())} className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 font-semibold shadow-lg shadow-emerald-600/25 transition-all duration-200">
                  {loading ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div><span>Generišem...</span></>) : (<><Sparkles className="w-4 h-4" /><span>Generiši Meta opis + Ključne reči</span></>)}
                </button>
              </div>
            </div>

            {error && (<div className="mx-6 mb-4 bg-red-50 border border-red-200 rounded-lg p-3"><div className="text-sm text-red-700">{error}</div></div>)}
          </div>
        )}


        {/* Step 3: Analysis Results */}
        {step === 'analysis' && analysisResult && extractedContent && (
          <div className="space-y-6">
            {/* 1) SEO izlaz - Dual Mode or Single Mode */}
            {analysisResult.llm?.dualMode && (analysisResult.seoOutputsGemini || analysisResult.seoOutputsOpenAI) ? (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl shadow-sm border p-6">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">🔬 A/B Test: Dual LLM Comparison</h3>
                  <p className="text-sm text-gray-600">Comparing outputs from both models side-by-side</p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Gemini Output */}
                  <div className="bg-white rounded-lg border-2 border-emerald-200 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-bold text-emerald-600">🔷 Gemini</h4>
                        <p className="text-xs text-emerald-500">{analysisResult.llm.geminiModel || 'gemini-2.5-flash'}</p>
                      </div>
                      {analysisResult.seoOutputsGemini && (
                        <div className="flex gap-1">
                          <button onClick={() => copyToClipboard(analysisResult.seoOutputsGemini!.markdown, 'gemini-md')} className="px-2 py-1 text-xs bg-emerald-100 hover:bg-emerald-200 rounded border border-emerald-300">Copy MD</button>
                        </div>
                      )}
                    </div>
                    
                    {analysisResult.llm.geminiError ? (
                      <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                        ❌ Error: {analysisResult.llm.geminiError}
                      </div>
                    ) : analysisResult.seoOutputsGemini ? (
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-xs font-semibold text-gray-500">Title Tag</div>
                            <div className="text-xs text-gray-400">
                              {analysisResult.seoOutputsGemini.title.length} chars
                            </div>
                          </div>
                          <div className="text-sm bg-emerald-50 p-2 rounded border border-emerald-100">{analysisResult.seoOutputsGemini.title}</div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-xs font-semibold text-gray-500">Meta Description</div>
                            <div className="text-xs text-gray-400 flex items-center gap-1">
                              {analysisResult.seoOutputsGemini.metaDescription.length} chars
                              {!analysisResult.seoOutputsGemini.metaDescription.trim().match(/[.!?]$/) && (
                                <span className="text-red-500 font-bold" title="Meta opis nije završen sa tačkom!">⚠️</span>
                              )}
                            </div>
                          </div>
                          <div className="text-sm bg-emerald-50 p-2 rounded border border-emerald-100">{analysisResult.seoOutputsGemini.metaDescription}</div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-xs font-semibold text-gray-500">Keywords</div>
                            <div className="text-xs text-gray-400">
                              {analysisResult.seoOutputsGemini.keywordsLine.length} chars
                            </div>
                          </div>
                          <div className="text-xs bg-emerald-50 p-2 rounded border border-emerald-100 font-mono">{analysisResult.seoOutputsGemini.keywordsLine}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400 italic">No output generated</div>
                    )}
                  </div>

                  {/* OpenAI Output */}
                  <div className="bg-white rounded-lg border-2 border-green-200 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-bold text-green-600">🟢 OpenAI</h4>
                        <p className="text-xs text-green-500">{analysisResult.llm.openaiModel || 'gpt-4o-mini'}</p>
                      </div>
                      {analysisResult.seoOutputsOpenAI && (
                        <div className="flex gap-1">
                          <button onClick={() => copyToClipboard(analysisResult.seoOutputsOpenAI!.markdown, 'openai-md')} className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 rounded border border-green-300">Copy MD</button>
                        </div>
                      )}
                    </div>
                    
                    {analysisResult.llm.openaiError ? (
                      <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                        ❌ Error: {analysisResult.llm.openaiError}
                      </div>
                    ) : analysisResult.seoOutputsOpenAI ? (
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-xs font-semibold text-gray-500">Title Tag</div>
                            <div className="text-xs text-gray-400">
                              {analysisResult.seoOutputsOpenAI.title.length} chars
                            </div>
                          </div>
                          <div className="text-sm bg-green-50 p-2 rounded border border-green-100">{analysisResult.seoOutputsOpenAI.title}</div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-xs font-semibold text-gray-500">Meta Description</div>
                            <div className="text-xs text-gray-400 flex items-center gap-1">
                              {analysisResult.seoOutputsOpenAI.metaDescription.length} chars
                              {!analysisResult.seoOutputsOpenAI.metaDescription.trim().match(/[.!?]$/) && (
                                <span className="text-red-500 font-bold" title="Meta opis nije završen sa tačkom!">⚠️</span>
                              )}
                            </div>
                          </div>
                          <div className="text-sm bg-green-50 p-2 rounded border border-green-100">{analysisResult.seoOutputsOpenAI.metaDescription}</div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-xs font-semibold text-gray-500">Keywords</div>
                            <div className="text-xs text-gray-400">
                              {analysisResult.seoOutputsOpenAI.keywordsLine.length} chars
                            </div>
                          </div>
                          <div className="text-xs bg-green-50 p-2 rounded border border-green-100 font-mono">{analysisResult.seoOutputsOpenAI.keywordsLine}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400 italic">No output generated</div>
                    )}
                  </div>
                </div>
              </div>
            ) : analysisResult.seoOutputs ? (
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">SEO izlaz</h3>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => copyToClipboard(analysisResult.seoOutputs!.title, 'seo-title-top')} className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg border text-gray-700 font-medium">Title</button>
                      <button onClick={() => copyToClipboard(analysisResult.seoOutputs!.metaDescription, 'seo-meta-top')} className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg border text-gray-700 font-medium">Meta</button>
                      <button onClick={() => copyToClipboard(analysisResult.seoOutputs!.keywordsLine, 'seo-kw-top')} className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg border text-gray-700 font-medium">Keywords</button>
                      {analysisResult.seoOutputs!.schemaMarkup && (<button onClick={() => copyToClipboard(analysisResult.seoOutputs!.schemaMarkup, 'seo-schema-top')} className="px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg border text-gray-700 font-medium">Schema</button>)}
                      <button onClick={() => copyToClipboard(analysisResult.seoOutputs!.markdown, 'seo-md-top')} className="px-2.5 py-1 text-xs bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg font-medium">Kopiraj sve</button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <CopyField label="1. SEO Naslov (Title Tag)" value={analysisResult.seoOutputs.title} fieldKey="seo-title-field" />
                    <CopyField label="2. Meta Opis (Answer Nugget)" value={analysisResult.seoOutputs.metaDescription} fieldKey="seo-meta-field" />
                    <CopyField label="3. Ključne reči (Long-Tail First)" value={analysisResult.seoOutputs.keywordsLine} fieldKey="seo-kw-field" />
                    {analysisResult.seoOutputs.schemaMarkup && (<CopyField label="4. Schema Markup (JSON-LD)" value={analysisResult.seoOutputs.schemaMarkup} fieldKey="seo-schema-field" />)}
                  </div>
                </div>

                <div className="lg:col-span-1 space-y-3">
                  {/* Quick Stats - compact 4-col */}
                  <div className="bg-white rounded-xl shadow-sm border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Pregled teksta</h4>
                      <button onClick={resetAnalysis} className="text-xs text-gray-400 hover:text-gray-600">← Nova</button>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      <div className="bg-gray-50 rounded-lg p-2 text-center"><div className="text-base font-bold text-gray-900">{extractedContent.wordCount}</div><div className="text-[10px] text-gray-500">Reči</div></div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center"><div className="text-base font-bold text-gray-900">{(extractedContent.metadata.description?.length || 0) + extractedContent.content.length}</div><div className="text-[10px] text-gray-500">Karaktera</div></div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center"><div className="text-base font-bold text-gray-900">{analysisResult.authorMetrics ? analysisResult.authorMetrics.readingTimeMin : Math.round(extractedContent.wordCount/200)}</div><div className="text-[10px] text-gray-500">Min čitanja</div></div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center"><div className="text-sm font-bold text-gray-900 capitalize">{analysisResult.searchIntent.type === 'informational' ? 'Info' : analysisResult.searchIntent.type}</div><div className="text-[10px] text-gray-500">Intent</div></div>
                    </div>
                  </div>

                  {/* Traffic Light Scorecard */}
                  {analysisResult.authorMetrics && (() => {
                    const m = analysisResult.authorMetrics;
                    const gc = (v: number, t: number[]) => v <= t[0] ? 'red' : v <= t[1] ? 'amber' : v <= t[2] ? 'yellow' : v <= t[3] ? 'green' : 'emerald';
                    const gi = (v: number, t: number[]) => v >= t[0] ? 'red' : v >= t[1] ? 'amber' : v >= t[2] ? 'yellow' : v >= t[3] ? 'green' : 'emerald';
                    const cs: Record<string, { bg: string; text: string; border: string; dot: string }> = {
                      red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
                      amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
                      yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
                      green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
                      emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-600' },
                    };
                    const pd = m.primaryDensity * 100;
                    const pdColor = (pd < 0.5 || pd > 3) ? 'red' : pd > 2.5 ? 'yellow' : pd >= 1 ? 'emerald' : 'amber';
                    const metrics = [
                      { label: 'Raznolikost reči', value: (m.typeTokenRatio*100).toFixed(0)+'%', color: gc(m.typeTokenRatio*100, [30, 40, 55, 70]), tip: 'Type-Token Ratio (TTR) — meri koliko različitih reči koristite u tekstu. Viši procenat znači bogatiji rečnik, što pozitivno utiče na SEO. Optimalno: 40–60%.' },
                      { label: 'Ponavljanje reči', value: (m.repetitionScore*100).toFixed(0)+'%', color: gi(m.repetitionScore*100, [50, 30, 20, 10]), tip: 'Meri koliko često ponavljate iste reči. Visok procenat može ukazivati na keyword stuffing. Ciljajte ispod 10% za prirodan tekst.' },
                      { label: 'Pokrivenost tema', value: (m.topicCoverage*100).toFixed(0)+'%', color: gc(m.topicCoverage*100, [10, 30, 50, 70]), tip: 'Koliko temeljno vaš tekst pokriva identifikovane teme. Viša pokrivenost poboljšava E-E-A-T signal za Google. Ciljajte >50%.' },
                      { label: 'Ključne reči', value: (m.keywordCoverage*100).toFixed(0)+'%', color: gc(m.keywordCoverage*100, [40, 60, 75, 90]), tip: 'Procenat relevantnih ključnih reči prisutnih u tekstu. Pomaže pretraživačima da razumeju temu članka. Optimalno: >75%.' },
                      { label: 'Gustina ključne reči', value: pd.toFixed(2)+'%', color: pdColor, tip: 'Frekvencija primarne ključne reči. Premalo (<0.5%) — Google ne prepoznaje temu. Previše (>3%) — keyword stuffing. Optimalno: 1–2.5%.' },
                      { label: 'Long-tail fraze', value: (m.longTailUsage*100).toFixed(0)+'%', color: gc(m.longTailUsage*100, [20, 35, 50, 70]), tip: 'Korišćenje višerečnih fraza (2–4 reči). Ključne za Google Discover i AI pretraživače jer odgovaraju na specifična pitanja. Ciljajte >60%.' },
                    ];

                    const ttrScore = Math.min(100, Math.max(0, m.typeTokenRatio*100 >= 40 && m.typeTokenRatio*100 <= 60 ? 100 : m.typeTokenRatio*100 < 40 ? m.typeTokenRatio*100/40*100 : Math.max(0, 100 - (m.typeTokenRatio*100 - 60)*2)));
                    const repScore = Math.min(100, Math.max(0, m.repetitionScore*100 <= 10 ? 100 : m.repetitionScore*100 >= 50 ? 0 : (50 - m.repetitionScore*100)/40*100));
                    const topicScore = Math.min(100, m.topicCoverage*100/70*100);
                    const kwScore = Math.min(100, m.keywordCoverage*100/90*100);
                    const pdScore = pd >= 1 && pd <= 2.5 ? 100 : pd < 0.5 || pd > 3 ? 20 : pd < 1 ? (pd/1)*100 : Math.max(20, 100 - (pd - 2.5)*160);
                    const ltScore = Math.min(100, m.longTailUsage*100/70*100);
                    const composite = parseFloat((ttrScore * 0.15 + repScore * 0.10 + topicScore * 0.20 + kwScore * 0.20 + pdScore * 0.15 + ltScore * 0.20).toFixed(1));
                    const scoreColor = composite >= 80 ? 'emerald' : composite >= 60 ? 'green' : composite >= 40 ? 'yellow' : composite >= 20 ? 'amber' : 'red';
                    const scoreLabel = composite >= 80 ? 'Odlično' : composite >= 60 ? 'Dobro' : composite >= 40 ? 'Prosečan' : composite >= 20 ? 'Slabo' : 'Kritično';

                    return (
                      <div className="bg-white rounded-xl shadow-sm border p-4">
                        <div className="mb-2.5">
                          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">SEO Scorecard</h4>
                          <p className="text-[11px] text-gray-500 mt-0.5">Trenutna optimizovanost vašeg teksta</p>
                        </div>
                        <div className="space-y-1.5">
                          {metrics.map((met, i) => {
                            const c = cs[met.color];
                            return (
                              <div key={i} className={`flex items-center justify-between p-2 rounded-lg border ${c.bg} ${c.border} group relative`}>
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-2 h-2 rounded-full ${c.dot}`}></div>
                                  <span className="text-xs font-medium text-gray-700">{met.label}</span>
                                  <div className="relative">
                                    <Info className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-64 bg-gray-900 text-white text-[11px] leading-relaxed rounded-lg p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 shadow-xl">{met.tip}</div>
                                  </div>
                                </div>
                                <span className={`text-sm font-bold ${c.text}`}>{met.value}</span>
                              </div>
                            );
                          })}
                        </div>
                        {/* Composite Score */}
                        <div className={`mt-3 p-3 rounded-xl border-2 ${cs[scoreColor].border} ${cs[scoreColor].bg} flex items-center justify-between`}>
                          <div>
                            <div className="text-xs font-bold text-gray-700 uppercase tracking-wide">Ukupni SEO Score</div>
                            <div className={`text-xs font-medium ${cs[scoreColor].text} mt-0.5`}>{scoreLabel}</div>
                          </div>
                          <div className="relative w-[72px] h-[72px]">
                            <svg className="w-[72px] h-[72px] -rotate-90" viewBox="0 0 72 72">
                              <circle cx="36" cy="36" r="30" fill="none" stroke="currentColor" strokeWidth="5" className="text-gray-200" />
                              <circle cx="36" cy="36" r="30" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray={`${composite * 1.885} 188.5`} strokeLinecap="round" className={cs[scoreColor].text} />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className={`text-sm font-black ${cs[scoreColor].text} text-center leading-none`}>{composite.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Topics */}
                  {analysisResult.summary.mainTopics.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border p-3">
                      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-2">Teme</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {analysisResult.summary.mainTopics.map((topic: string, index: number) => (
                          <span key={index} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-medium border border-emerald-100">{topic}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SEO Preporuke - integrated into sidebar */}
                  <div className="bg-white rounded-xl shadow-sm border p-4">
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">🎯 SEO Preporuke</h4>
                    {analysisResult.authorRecommendations ? (
                      <div className="space-y-3">
                        {analysisResult.authorRecommendations.categories.map((cat: { category: string; items: string[]; type?: string }, idx: number) => {
                          const typeColors: Record<string, { header: string; dot: string; bg: string }> = {
                            critical: { header: 'text-red-700', dot: 'text-red-500', bg: 'bg-red-50/50' },
                            missing: { header: 'text-amber-700', dot: 'text-amber-500', bg: 'bg-amber-50/30' },
                            positive: { header: 'text-emerald-700', dot: 'text-emerald-500', bg: 'bg-emerald-50/30' },
                          };
                          const colors = typeColors[cat.type || 'missing'] || typeColors.missing;
                          return (
                            <div key={idx} className={`rounded-lg p-2.5 ${colors.bg}`}>
                              <div className={`font-semibold text-xs mb-1.5 ${colors.header}`}>{cat.category}</div>
                              <ul className="space-y-1">
                                {cat.items.map((it: string, i: number) => (
                                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700 leading-relaxed">
                                    <span className={`mt-0.5 text-[10px] ${colors.dot}`}>●</span>
                                    <span>{it}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-600">
                        <p><strong>Preporučeni fokus:</strong> {analysisResult.summary.recommendedFocus}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-500">
            <p>SEO GEM  - Inteligentni SEO Asistent</p>
            <p className="mt-1">TF-IDF i LSA analiza sadržaja</p>
          </div>
        </div>
      </footer>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white px-8 py-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Brain className="w-8 h-8" />
                  <div>
                    <h2 className="text-2xl font-bold">Uputstvo za korišćenje</h2>
                    <p className="text-emerald-100 text-sm">SEO GEM - Inteligentni SEO Asistent</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHelp(false)}
                  className="hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Step 1 */}
              <div className="flex space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                    1
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Ekstrakcija sadržaja</h3>
                  <p className="text-gray-600 mb-2">
                    Unesite URL vesti i kliknite <strong>&quot;Ekstraktuj sadržaj&quot;</strong>
                  </p>
                  <div className="bg-emerald-50 border-l-4 border-emerald-600 p-3 rounded">
                    <p className="text-sm text-gray-700">
                      <strong>💡 Tip:</strong> Sistem automatski izvlači naslov, lead, tekst članka i tehničke metapodatke (autor, datum objave, izdavač, sliku) direktno iz JSON-LD i meta tagova.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                    2
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Izbor SEO naslova</h3>
                  <p className="text-gray-600 mb-2">
                    AI generiše <strong>6 naslova u 3 kategorije</strong> (po 2 naslova):
                  </p>
                  <ul className="space-y-2 mb-3">
                    <li className="flex items-start space-x-2">
                      <span className="text-emerald-600 font-bold">•</span>
                      <span className="text-gray-700"><strong>Informativni:</strong> Faktografski, neutralan ton za hard news</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-emerald-600 font-bold">•</span>
                      <span className="text-gray-700"><strong>GEO Pitanje:</strong> Optimizovan za AI odgovore (Gemini, ChatGPT)</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-purple-600 font-bold">•</span>
                      <span className="text-gray-700"><strong>Discover Hook:</strong> Stvara radoznalost za Google Discover</span>
                    </li>
                  </ul>
                  <div className="bg-emerald-50 border-l-4 border-emerald-600 p-3 rounded">
                    <p className="text-sm text-gray-700">
                      <strong>🎯 Važno:</strong> Svi naslovi poštuju limit od 70 karaktera. Odabir pomaže sistemu da nauči vaš stil!
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                    3
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">SEO analiza i preporuke</h3>
                  <p className="text-gray-600 mb-2">
                    Nakon izbora naslova, kliknite <strong>&quot;Generiši Meta opis + Ključne reči&quot;</strong>
                  </p>
                  <p className="text-gray-600 mb-3">
                    Dobijate kompletne SEO elemente:
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-gray-50 p-2 rounded">
                      <span className="text-xs font-semibold text-gray-700">✓ SEO Naslov (do 70 karaktera)</span>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <span className="text-xs font-semibold text-gray-700">✓ Meta Opis (Answer Nugget)</span>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <span className="text-xs font-semibold text-gray-700">✓ Ključne reči (3 nivoa)</span>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <span className="text-xs font-semibold text-gray-700">✓ Schema Markup (JSON-LD)</span>
                    </div>
                    <div className="bg-gray-50 p-2 rounded col-span-2">
                      <span className="text-xs font-semibold text-gray-700">✓ Analitika (TF-IDF, LSA, Search Intent)</span>
                    </div>
                  </div>
                  <div className="bg-emerald-50 border-l-4 border-emerald-600 p-3 rounded">
                    <p className="text-sm text-gray-700">
                      <strong>🔧 Schema Markup:</strong> Automatski popunjava 16+ polja (author, publisher, datePublished, image, about, mentions...) koristeći realne podatke sa originalnog linka.
                    </p>
                  </div>
                </div>
              </div>

              {/* RAG Learning */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Brain className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-amber-900 mb-2">🧠 Sistem učenja (RAG)</h4>
                    <p className="text-sm text-amber-800">
                      Svaki put kada odaberete naslov, sistem zapamti vašu preferenciju i koristi semantičku pretragu za personalizaciju. 
                      Nakon 5-10 odabira, AI automatski generiše naslove prilagođene vašem stilu!
                    </p>
                  </div>
                </div>
              </div>

              {/* Copy funkcija */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">📋 Kopiranje rezultata</h4>
                <p className="text-sm text-gray-700">
                  Kliknite na ikonicu <Copy className="w-4 h-4 inline" /> pored bilo kog rezultata da kopirate u clipboard.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-2xl border-t">
              <button
                onClick={() => setShowHelp(false)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 hover:shadow-lg"
              >
                Razumem, idemo!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      <InfoModal isOpen={showInfo} onClose={() => setShowInfo(false)} />
    </div>
  );
}

function Metric({ label, value, tone = 'gray', tooltip }: { label: string; value: string; tone?: string; tooltip?: string }) {
  const toneMap: Record<string, string> = {
    blue: 'bg-emerald-50 text-emerald-800',
    rose: 'bg-rose-50 text-rose-800',
    indigo: 'bg-indigo-50 text-indigo-800',
    emerald: 'bg-emerald-50 text-emerald-800',
    amber: 'bg-amber-50 text-amber-800',
    teal: 'bg-teal-50 text-teal-800',
    gray: 'bg-gray-50 text-gray-800',
  };
  const iconToneMap: Record<string, string> = {
    blue: 'text-emerald-400',
    rose: 'text-rose-400',
    indigo: 'text-indigo-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    teal: 'text-teal-400',
    gray: 'text-gray-400',
  };
  const cls = toneMap[tone] || toneMap.gray;
  const iconCls = iconToneMap[tone] || iconToneMap.gray;
  return (
    <div className={`${cls} rounded-lg p-4 relative group`}>
      {tooltip && (
        <>
          <div className={`absolute top-2 right-2 ${iconCls} opacity-0 group-hover:opacity-100 transition-opacity cursor-help`}>
            <Info className="w-4 h-4" />
          </div>
          <div className="absolute top-8 right-0 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
            {tooltip}
          </div>
        </>
      )}
      <div className="text-sm">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

