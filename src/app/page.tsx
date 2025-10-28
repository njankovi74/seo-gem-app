'use client';

import { useState } from 'react';
import { Search, FileText, Brain, BarChart3, ExternalLink, Copy, Check, Info, HelpCircle, X } from 'lucide-react';

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
  seoOutputsGemini?: {
    title: string;
    metaDescription: string;
    keywordsLine: string;
    markdown: string;
  };
  seoOutputsOpenAI?: {
    title: string;
    metaDescription: string;
    keywordsLine: string;
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
  style: 'faktografski' | 'kontekstualni' | 'detaljni';
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
          articleUrl: url
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
            <button
              onClick={resetAnalysis}
              className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
              title="Povratak na početak"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-xl font-bold text-gray-900">SEO GEM</h1>
                <p className="text-sm text-gray-500">Inteligentni SEO Asistent</p>
              </div>
            </button>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowHelp(true)}
                className="flex items-center space-x-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Uputstvo za korišćenje"
              >
                <HelpCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Uputstvo</span>
              </button>
              <div className="text-sm text-gray-500">
                v1.0 - Serbian Language Optimized
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            <div className={`flex items-center space-x-2 ${step === 'url' ? 'text-blue-600' : (step === 'content' || step === 'titleSelection' || step === 'analysis') ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'url' ? 'bg-blue-600 text-white' : (step === 'content' || step === 'titleSelection' || step === 'analysis') ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                <Search className="w-4 h-4" />
              </div>
              <span className="font-medium text-sm">Ekstrakcija</span>
            </div>
            <div className={`w-12 h-0.5 ${(step === 'content' || step === 'titleSelection' || step === 'analysis') ? 'bg-green-600' : 'bg-gray-200'}`}></div>
            <div className={`flex items-center space-x-2 ${step === 'content' ? 'text-blue-600' : (step === 'titleSelection' || step === 'analysis') ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'content' ? 'bg-blue-600 text-white' : (step === 'titleSelection' || step === 'analysis') ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                <FileText className="w-4 h-4" />
              </div>
              <span className="font-medium text-sm">Pregled</span>
            </div>
            <div className={`w-12 h-0.5 ${(step === 'titleSelection' || step === 'analysis') ? 'bg-green-600' : 'bg-gray-200'}`}></div>
            <div className={`flex items-center space-x-2 ${step === 'titleSelection' ? 'text-blue-600' : step === 'analysis' ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'titleSelection' ? 'bg-blue-600 text-white' : step === 'analysis' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                <Brain className="w-4 h-4" />
              </div>
              <span className="font-medium text-sm">Izbor Naslova</span>
            </div>
            <div className={`w-12 h-0.5 ${step === 'analysis' ? 'bg-green-600' : 'bg-gray-200'}`}></div>
            <div className={`flex items-center space-x-2 ${step === 'analysis' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'analysis' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
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
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm font-medium text-blue-900">{extractedContent.metadata.description}</p>
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
                        <span className="font-semibold text-blue-900">
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

        {/* Step 2.5: Title Selection */}
        {step === 'titleSelection' && titleOptions.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Odaberi SEO Naslov</h2>
                <p className="text-sm text-gray-600 mt-1">
                  AI je generisao 3 Newsmax-style naslova. Odaberi jedan ili unesi sopstveni.
                </p>
              </div>
              <button
                onClick={() => setStep('content')}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Nazad
              </button>
            </div>

            <div className="space-y-3 mb-6">
              {titleOptions.map((option, idx) => (
                <label
                  key={idx}
                  className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedTitleIndex === idx
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="title"
                    checked={selectedTitleIndex === idx}
                    onChange={() => setSelectedTitleIndex(idx)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 mb-1">{option.text}</div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
                      <span>{option.text.length} karaktera</span>
                      <span>•</span>
                      <span className="capitalize">{option.style}</span>
                    </div>
                    <div className="text-xs text-gray-400 italic">{option.reasoning}</div>
                  </div>
                </label>
              ))}

              {/* Custom Title Option */}
              <label
                className={`flex items-start gap-3 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                  selectedTitleIndex === 'custom'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-300 hover:border-purple-300 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="title"
                  checked={selectedTitleIndex === 'custom'}
                  onChange={() => setSelectedTitleIndex('custom')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 mb-2">✏️ Sopstveni naslov</div>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => {
                      setCustomTitle(e.target.value);
                      setSelectedTitleIndex('custom');
                    }}
                    maxLength={75}
                    placeholder="Unesite sopstveni SEO naslov..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <div className={`text-xs mt-1 ${customTitle.length > 75 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                    {customTitle.length}/75 karaktera
                    {customTitle.length > 75 && ' - PREDUGAČKO!'}
                  </div>
                </div>
              </label>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleGenerateMetaAndKeywords}
                disabled={loading || (selectedTitleIndex === 'custom' && !customTitle.trim())}
                className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Generišem Meta opis + Ključne reči...</span>
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-4 h-4" />
                    <span>Generiši Meta opis + Ključne reči</span>
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Analysis Results */}
        {step === 'analysis' && analysisResult && extractedContent && (
          <div className="space-y-6">
            {/* 1) SEO izlaz - Dual Mode or Single Mode */}
            {analysisResult.llm?.dualMode && (analysisResult.seoOutputsGemini || analysisResult.seoOutputsOpenAI) ? (
              <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl shadow-sm border p-6">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">🔬 A/B Test: Dual LLM Comparison</h3>
                  <p className="text-sm text-gray-600">Comparing outputs from both models side-by-side</p>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Gemini Output */}
                  <div className="bg-white rounded-lg border-2 border-blue-200 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-bold text-blue-600">🔷 Gemini</h4>
                        <p className="text-xs text-blue-500">{analysisResult.llm.geminiModel || 'gemini-2.5-flash'}</p>
                      </div>
                      {analysisResult.seoOutputsGemini && (
                        <div className="flex gap-1">
                          <button onClick={() => copyToClipboard(analysisResult.seoOutputsGemini!.markdown, 'gemini-md')} className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded border border-blue-300">Copy MD</button>
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
                          <div className="text-sm bg-blue-50 p-2 rounded border border-blue-100">{analysisResult.seoOutputsGemini.title}</div>
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
                          <div className="text-sm bg-blue-50 p-2 rounded border border-blue-100">{analysisResult.seoOutputsGemini.metaDescription}</div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-xs font-semibold text-gray-500">Keywords</div>
                            <div className="text-xs text-gray-400">
                              {analysisResult.seoOutputsGemini.keywordsLine.length} chars
                            </div>
                          </div>
                          <div className="text-xs bg-blue-50 p-2 rounded border border-blue-100 font-mono">{analysisResult.seoOutputsGemini.keywordsLine}</div>
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
            ) : null}

            {/* 2) SEO analiza (fokus na autoru) */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">SEO Analiza</h2>
                <button onClick={resetAnalysis} className="text-sm text-gray-500 hover:text-gray-700">← Nova analiza</button>
              </div>

              {/* Author-centric KPI kartice */}
              <div className="grid md:grid-cols-5 gap-4 mb-8">
                {/* Broj reči */}
                <div className="bg-blue-50 rounded-lg p-4 relative group">
                  <div className="absolute top-2 right-2 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-help">
                    <Info className="w-4 h-4" />
                  </div>
                  <div className="absolute top-8 right-0 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
                    <strong>Broj reči:</strong> Ukupan broj reči u članku (Lead + Body). Optimalno: 300-800 za vest, 800-2000 za feature članak.
                  </div>
                  <div className="text-2xl font-bold text-blue-600">{extractedContent.wordCount}</div>
                  <div className="text-sm text-blue-800">Reči</div>
                </div>

                {/* Broj karaktera */}
                <div className="bg-indigo-50 rounded-lg p-4 relative group">
                  <div className="absolute top-2 right-2 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-help">
                    <Info className="w-4 h-4" />
                  </div>
                  <div className="absolute top-8 right-0 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
                    <strong>Broj karaktera:</strong> Ukupan broj karaktera teksta (sa razmacima). Google indeksira na osnovu sadržaja, duži tekst = veća šansa za rangiranje.
                  </div>
                  <div className="text-2xl font-bold text-indigo-600">
                    {(extractedContent.metadata.description?.length || 0) + extractedContent.content.length}
                  </div>
                  <div className="text-sm text-indigo-800">Karaktera</div>
                </div>

                {/* Vreme čitanja */}
                <div className="bg-green-50 rounded-lg p-4 relative group">
                  <div className="absolute top-2 right-2 text-green-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-help">
                    <Info className="w-4 h-4" />
                  </div>
                  <div className="absolute top-8 right-0 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
                    <strong>Vreme čitanja:</strong> Procenjeno vreme čitanja (200 reči/min). Korisnicima pokazuje investiciju vremena, utiče na bounce rate.
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {analysisResult.authorMetrics ? analysisResult.authorMetrics.readingTimeMin : Math.round(extractedContent.wordCount/200)}
                  </div>
                  <div className="text-sm text-green-800">Min čitanja</div>
                </div>

                {/* Prosečna dužina rečenice */}
                <div className="bg-purple-50 rounded-lg p-4 relative group">
                  <div className="absolute top-2 right-2 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-help">
                    <Info className="w-4 h-4" />
                  </div>
                  <div className="absolute top-8 right-0 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
                    <strong>Prosečna rečenica:</strong> Broj reči po rečenici. Optimalno: 15-20 reči (čitljivost). Previše kratke ili duge rečenice umanjuju kvalitet.
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    {analysisResult.authorMetrics ? analysisResult.authorMetrics.avgSentenceLength.toFixed(1) : '-'}
                  </div>
                  <div className="text-sm text-purple-800">Reči/rečenica</div>
                </div>

                {/* Search Intent */}
                <div className="bg-orange-50 rounded-lg p-4 relative group">
                  <div className="absolute top-2 right-2 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-help">
                    <Info className="w-4 h-4" />
                  </div>
                  <div className="absolute top-8 right-0 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
                    <strong>Search Intent:</strong> Tip pretrage (Informational, Commercial, Navigational). Informational = user traži znanje, optimizuj sa detaljima.
                  </div>
                  <div className="text-xl font-bold text-orange-600 capitalize">
                    {analysisResult.searchIntent.type}
                  </div>
                  <div className="text-sm text-orange-800">Search intent</div>
                </div>
              </div>

              {/* Dodatne metrike za vrednost teksta */}
              {analysisResult.authorMetrics && (
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <Metric 
                    label="TTR (raznolikost)" 
                    value={(analysisResult.authorMetrics.typeTokenRatio*100).toFixed(0) + '%'} 
                    tone="blue"
                    tooltip="Type-Token Ratio: Odnos jedinstvenih reči prema ukupnom broju reči. Visok TTR (>50%) = bogat vokabular, nizak (<30%) = repetitivno. Optimalno: 40-60%."
                  />
                  <Metric 
                    label="Repetitivnost" 
                    value={(analysisResult.authorMetrics.repetitionScore*100).toFixed(0) + '%'} 
                    tone="rose"
                    tooltip="Stopa ponavljanja istih reči. Visoka repetitivnost (>50%) smanjuje kvalitet i čitljivost. Ciljaj <30% za profesionalan tekst."
                  />
                  <Metric 
                    label="Pokrivenost tema" 
                    value={(analysisResult.authorMetrics.topicCoverage*100).toFixed(0) + '%'} 
                    tone="indigo"
                    tooltip="Koliko detaljno tekst pokriva identifikovane teme. Visoka pokrivenost (>70%) = sveobuhvatan članak, Google rangira bolje."
                  />
                  <Metric 
                    label="Pokrivenost ključnih reči" 
                    value={(analysisResult.authorMetrics.keywordCoverage*100).toFixed(0) + '%'} 
                    tone="emerald"
                    tooltip="Koliko prirodno tekst koristi relevantne ključne reči. Optimalno: 60-80%. Ispod 40% = slaba SEO optimizacija, iznad 90% = keyword stuffing."
                  />
                  <Metric 
                    label="Primarna gustina" 
                    value={(analysisResult.authorMetrics.primaryDensity*100).toFixed(2) + '%'} 
                    tone="amber"
                    tooltip="Frekvencija primarne ključne reči u tekstu. Optimalno: 1-3%. Ispod 1% = premalo, iznad 3% = preopterećeno (Google penalizuje)."
                  />
                  <Metric 
                    label="Long-tail prisustvo" 
                    value={(analysisResult.authorMetrics.longTailUsage*100).toFixed(0) + '%'} 
                    tone="teal"
                    tooltip="Upotreba long-tail fraza (2-4 reči). Long-tail ključne reči imaju bolju konverziju i manju konkurenciju. Ciljaj >60%."
                  />
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

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Brain className="w-8 h-8" />
                  <div>
                    <h2 className="text-2xl font-bold">Uputstvo za korišćenje</h2>
                    <p className="text-blue-100 text-sm">SEO GEM - Inteligentni SEO Asistent</p>
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
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                    1
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Ekstrakcija sadržaja</h3>
                  <p className="text-gray-600 mb-2">
                    Unesite URL vesti i kliknite <strong>"Ekstraktuj sadržaj"</strong>
                  </p>
                  <div className="bg-blue-50 border-l-4 border-blue-600 p-3 rounded">
                    <p className="text-sm text-gray-700">
                      <strong>💡 Tip:</strong> Sistem automatski izvlači naslov, lead i glavni tekst članka
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                    2
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Izbor SEO naslova</h3>
                  <p className="text-gray-600 mb-2">
                    AI generiše <strong>3 različita stila naslova</strong>:
                  </p>
                  <ul className="space-y-2 mb-3">
                    <li className="flex items-start space-x-2">
                      <span className="text-blue-600 font-bold">•</span>
                      <span className="text-gray-700"><strong>Faktografski:</strong> Direktan, bez emotivnosti</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-green-600 font-bold">•</span>
                      <span className="text-gray-700"><strong>Kontekstualni:</strong> Sa dodatnim kontekstom</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-purple-600 font-bold">•</span>
                      <span className="text-gray-700"><strong>Detaljni:</strong> Optimizovan za Google</span>
                    </li>
                  </ul>
                  <div className="bg-green-50 border-l-4 border-green-600 p-3 rounded">
                    <p className="text-sm text-gray-700">
                      <strong>🎯 Važno:</strong> Odabir naslova pomaže sistemu da "nauči" vaš stil!
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
                    Nakon izbora naslova, kliknite <strong>"Pokreni SEO Analizu"</strong>
                  </p>
                  <p className="text-gray-600 mb-3">
                    Dobijate kompletne SEO elemente:
                  </p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-gray-50 p-2 rounded">
                      <span className="text-xs font-semibold text-gray-700">✓ SEO Naslov (optimizovan)</span>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <span className="text-xs font-semibold text-gray-700">✓ Meta Opis</span>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <span className="text-xs font-semibold text-gray-700">✓ Ključne reči</span>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <span className="text-xs font-semibold text-gray-700">✓ Analitika</span>
                    </div>
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
                      Svaki put kada odaberete naslov, sistem zapamti vašu preferenciju. 
                      Nakon 5-10 odabira, AI će automatski generisati naslove u stilu koji PREFERIRATE!
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
            <div className="bg-gray-50 p-4 rounded-b-lg border-t">
              <button
                onClick={() => setShowHelp(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Razumem, idemo!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone = 'gray', tooltip }: { label: string; value: string; tone?: string; tooltip?: string }) {
  const toneMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-800',
    rose: 'bg-rose-50 text-rose-800',
    indigo: 'bg-indigo-50 text-indigo-800',
    emerald: 'bg-emerald-50 text-emerald-800',
    amber: 'bg-amber-50 text-amber-800',
    teal: 'bg-teal-50 text-teal-800',
    gray: 'bg-gray-50 text-gray-800',
  };
  const iconToneMap: Record<string, string> = {
    blue: 'text-blue-400',
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

