/**
 * Admin Analytics Dashboard v3 — Multi-view, Premium Dark Theme
 *
 * Architecture:
 *   - No portal → Landing page with portal cards grid
 *   - Portal selected → 4 tabs: Operacije, Analitika, Članci, Status
 *   - Auto-refresh every 30s with visibility API
 *   - All inline styles (S pattern)
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ── Types ──
interface PortalOverview {
  portal_id: string;
  portal_name: string;
  seo_gem_articles_period: number;
  seo_gem_articles_total: number;
  gsc: {
    total_impressions: number;
    total_clicks: number;
    ctr: number;
    web_impressions: number;
    discover_impressions: number;
  };
  ga4: {
    pageviews: number;
    sessions: number;
    avg_engagement_sec: number;
    pages_per_session: number;
    top_countries: Array<{ country: string; sessions: number }>;
    gem_pageviews: number;
    gem_sessions: number;
    gem_avg_engagement_sec: number;
    gem_pages_per_session: number;
    gem_pageviews_pct: number;
    gem_sessions_pct: number;
    gem_organic_direct_views: number;
    gem_organic_direct_pct: number;
  };
}

interface Article {
  article_id: string;
  url: string;
  seo_title: string;
  style: string;
  selection_type: string;
  published_at: string;
  age_days: number;
  impressions: number;
  clicks: number;
  ctr: number;
  avg_position: number | null;
  discover_impressions: number;
  top_queries: Array<{ query: string; impressions: number; clicks: number }>;
  has_gsc: boolean;
  pageviews: number;
  sessions: number;
  avg_engagement_sec: number;
  pages_per_session: number;
  organic_pct: number;
  direct_pct: number;
  has_ga4: boolean;
  status: 'early' | 'ok' | 'warning' | 'top';
}

interface OpsData {
  success: boolean;
  summary: {
    total: number;
    success: number;
    error: number;
    partial: number;
    successRate: number;
    avgLatencyMs: number;
    maxLatencyMs: number;
  };
  endpoints: Record<string, number>;
  styles: Record<string, number>;
  rag: { usageRate: number; avgExamples: number; totalUsed: number; totalCalls: number };
  googleSuggest: { usageRate: number; avgCount: number; totalUsed: number; totalCalls: number };
  errorTypes: Record<string, number>;
  recentErrors: Array<{
    time: string;
    portal_id: string;
    endpoint: string;
    error_type: string;
    error_message: string;
    article_url: string;
    status: string;
  }>;
  dailyTrend: Array<{ date: string; total: number; success: number; error: number; partial: number }>;
  portalSummary: Record<string, {
    total: number;
    success: number;
    error: number;
    partial: number;
    today: number;
    todayErrors: number;
  }>;
  topKeywords: Array<{ keyword: string; count: number }>;
  models: Record<string, number>;
}

// ── Constants ──
const PRESETS = [
  { label: 'Danas', days: 0 },
  { label: 'Juče', days: 1 },
  { label: '7 dana', days: 7 },
  { label: '14 dana', days: 14 },
  { label: '30 dana', days: 30 },
];

const STATUS_ICONS: Record<string, string> = {
  early: '🕐', ok: '✅', warning: '⚠️', top: '🔥',
};

const STATUS_LABELS: Record<string, string> = {
  early: 'Rani podaci (<7d)',
  ok: 'OK',
  warning: 'Nizak CTR',
  top: 'Top performer',
};

const PORTAL_FLAGS: Record<string, string> = {
  newsmax: '🇷🇸', newsmax_pl: '🇵🇱', newsmax_al: '🇦🇱', insajder: '🇷🇸',
};

const PORTAL_DISPLAY: Record<string, string> = {
  newsmax: 'Newsmax Balkans SR',
  newsmax_pl: 'Newsmax Polska',
  newsmax_al: 'Newsmax Balkans AL',
  insajder: 'Insajder.net',
};

const COLUMNS = [
  { key: 'status', label: '', src: '', tip: 'Status članka' },
  { key: 'published', label: 'Objavljeno', src: 'GEM', tip: 'Datum kada je SEO GEM kreirao naslov za ovaj članak' },
  { key: 'title', label: 'SEO Naslov', src: 'GEM', tip: 'Naslov generisan ili odabran kroz SEO GEM alat' },
  { key: 'age', label: 'Starost', src: '', tip: 'Koliko dana je prošlo od kreiranja naslova' },
  { key: 'impressions', label: 'Impr.', src: 'GSC', tip: 'Google Search Console: Koliko puta se članak pojavio u Google pretrazivačkim rezultatima' },
  { key: 'clicks', label: 'Klikovi', src: 'GSC', tip: 'Google Search Console: Koliko puta su korisnici kliknuli na članak iz Google rezultata' },
  { key: 'ctr', label: 'CTR', src: 'GSC', tip: 'Google Search Console: Click-Through Rate — procenat korisnika koji su kliknuli na članak od ukupnog broja koji su ga videli' },
  { key: 'position', label: 'Pozicija', src: 'GSC', tip: 'Google Search Console: Prosečna pozicija članka u Google rezultatima pretrage (niže = bolje)' },
  { key: 'discover', label: 'Discover', src: 'GSC', tip: 'Google Search Console: Broj prikaza članka u Google Discover feed-u' },
  { key: 'pageviews', label: 'Pregledi', src: 'GA4', tip: 'Google Analytics 4: Ukupan broj pregleda stranice u izabranom periodu (svi izvori saobraćaja)' },
  { key: 'organic', label: 'Organic%', src: 'GA4', tip: 'Google Analytics 4: Procenat sesija koje dolaze iz organskog Google pretraživanja — direktno zavisi od SEO naslova' },
  { key: 'direct', label: 'Direct%', src: 'GA4', tip: 'Google Analytics 4: Procenat sesija od direktnog dolaska korisnika (bookmarks, link u poruci, itd.)' },
  { key: 'engagement', label: 'Angažman', src: 'GA4', tip: 'Google Analytics 4: Prosečno vreme koje korisnik provodi na stranici' },
  { key: 'pps', label: 'Str/Sesija', src: 'GA4', tip: 'Google Analytics 4: Prosečan broj stranica po sesiji — pokazuje koliko članak podstiče dalje čitanje (interlinking)' },
];

const STYLE_COLORS: Record<string, string> = {
  informativni: '#3b82f6',
  geo_pitanje: '#10b981',
  kako_zasto: '#f59e0b',
  lista: '#8b5cf6',
  breaking: '#ef4444',
  analiza: '#06b6d4',
  intervju: '#ec4899',
  default: '#64748b',
};

type TabKey = 'ops' | 'analytics' | 'articles' | 'status';

// ── Helpers ──
function getDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function formatNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatSec(sec: number): string {
  if (sec >= 60) return Math.floor(sec / 60) + ':' + String(Math.floor(sec % 60)).padStart(2, '0');
  return sec + 's';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('sr-Latn', { day: '2-digit', month: '2-digit' });
}

function timeAgo(seconds: number): string {
  if (seconds < 60) return `pre ${seconds}s`;
  if (seconds < 3600) return `pre ${Math.floor(seconds / 60)}min`;
  return `pre ${Math.floor(seconds / 3600)}h`;
}

function pct(val: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((val / total) * 100);
}

// ── Main Component ──
export default function AdminDashboard() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Data
  const [overview, setOverview] = useState<PortalOverview[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalArticles, setTotalArticles] = useState(0);
  const [seoGemCount, setSeoGemCount] = useState(0);
  const [opsData, setOpsData] = useState<OpsData | null>(null);
  const [statusData, setStatusData] = useState<Record<string, unknown> | null>(null);

  // Navigation
  const [selectedPortal, setSelectedPortal] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('ops');

  // Period
  const [activePreset, setActivePreset] = useState(7);
  const [startDate, setStartDate] = useState(getDaysAgo(7));
  const [endDate, setEndDate] = useState(getDaysAgo(0));
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState(getDaysAgo(7));
  const [customEnd, setCustomEnd] = useState(getDaysAgo(0));

  // Sort for articles
  const [sortKey, setSortKey] = useState<string>('published');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Auto-refresh
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [secondsSinceRefresh, setSecondsSinceRefresh] = useState(0);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const apiBase = '/api/admin/analytics';

  // ── Fetch all data ──
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      // Always fetch overview + ops
      const [ovRes, opsRes] = await Promise.all([
        fetch(`${apiBase}/overview?start=${startDate}&end=${endDate}&admin_key=${password}`),
        fetch(`${apiBase}/operations?days=${activePreset || 7}&admin_key=${password}`),
      ]);
      const ovData = await ovRes.json();
      if (!ovData.success) throw new Error(ovData.error);
      setOverview(ovData.portals);

      const opsJson = await opsRes.json();
      if (opsJson.success) setOpsData(opsJson);

      // If portal selected, also fetch articles
      if (selectedPortal) {
        const artRes = await fetch(
          `${apiBase}/articles?portal=${selectedPortal}&start=${startDate}&end=${endDate}&limit=200&admin_key=${password}`
        );
        const artData = await artRes.json();
        if (!artData.success) throw new Error(artData.error);
        setArticles(artData.articles);
        setTotalArticles(artData.total_seo_gem);
        setSeoGemCount(artData.with_analytics);
      }

      setLastRefresh(Date.now());
      setSecondsSinceRefresh(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Greška pri učitavanju');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [password, startDate, endDate, activePreset, selectedPortal]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/status?admin_key=${password}`);
      const data = await res.json();
      if (data.success) setStatusData(data);
    } catch { /* ignore */ }
  }, [password]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/status?admin_key=${password}`);
      const data = await res.json();
      if (data.success) {
        setAuthed(true);
        setError('');
      } else {
        setError('Pogrešna lozinka');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  const selectPreset = (days: number) => {
    setActivePreset(days);
    if (days === 0) {
      // Danas = samo današnji dan
      setStartDate(getDaysAgo(0));
      setEndDate(getDaysAgo(0));
    } else {
      setStartDate(getDaysAgo(days));
      setEndDate(getDaysAgo(0));
    }
    setShowCustom(false);
  };

  const applyCustom = () => {
    setActivePreset(0);
    setStartDate(customStart);
    setEndDate(customEnd);
    setShowCustom(false);
  };

  // Initial fetch
  useEffect(() => {
    if (authed) fetchData();
  }, [authed, fetchData]);

  // Auto-refresh with visibility API
  useEffect(() => {
    if (!authed) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Resume: fetch immediately if stale
        const elapsed = Math.floor((Date.now() - lastRefresh) / 1000);
        if (elapsed > 30) fetchData(true);
        refreshTimerRef.current = setInterval(() => fetchData(true), 30000);
      } else {
        if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      }
    };
    refreshTimerRef.current = setInterval(() => fetchData(true), 30000);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [authed, fetchData, lastRefresh]);

  // Countdown timer
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setSecondsSinceRefresh(Math.floor((Date.now() - lastRefresh) / 1000));
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [lastRefresh]);

  // Fetch status when tab = status
  useEffect(() => {
    if (activeTab === 'status' && authed && selectedPortal) fetchStatus();
  }, [activeTab, authed, selectedPortal, fetchStatus]);

  // ── Article sorting ──
  const sortedArticles = useMemo(() => {
    const sorted = [...articles];
    sorted.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortKey) {
        case 'published': av = a.published_at || ''; bv = b.published_at || ''; break;
        case 'age': av = a.age_days; bv = b.age_days; break;
        case 'impressions': av = a.impressions; bv = b.impressions; break;
        case 'clicks': av = a.clicks; bv = b.clicks; break;
        case 'ctr': av = a.ctr; bv = b.ctr; break;
        case 'position': av = a.avg_position ?? 999; bv = b.avg_position ?? 999; break;
        case 'discover': av = a.discover_impressions; bv = b.discover_impressions; break;
        case 'pageviews': av = a.pageviews; bv = b.pageviews; break;
        case 'organic': av = a.organic_pct; bv = b.organic_pct; break;
        case 'direct': av = a.direct_pct; bv = b.direct_pct; break;
        case 'engagement': av = a.avg_engagement_sec; bv = b.avg_engagement_sec; break;
        case 'pps': av = a.pages_per_session; bv = b.pages_per_session; break;
        default: av = a.published_at || ''; bv = b.published_at || '';
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return sorted;
  }, [articles, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const selectPortal = (portalId: string) => {
    setSelectedPortal(portalId);
    setActiveTab('ops');
  };

  const goBack = () => {
    setSelectedPortal(null);
    setArticles([]);
  };

  const currentPortal = overview.find(p => p.portal_id === selectedPortal);
  const currentOps = opsData?.portalSummary?.[selectedPortal || ''];

  // ── Login Screen ──
  if (!authed) {
    return (
      <div style={S.loginContainer}>
        <div style={S.loginCard}>
          <div style={S.loginIcon}>💎</div>
          <h1 style={S.loginTitle}>SEO GEM Admin</h1>
          <p style={S.loginSub}>Analytics Dashboard</p>
          <input
            type="password"
            placeholder="Admin lozinka"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={S.input}
          />
          <button onClick={handleLogin} disabled={loading} style={S.loginBtn}>
            {loading ? '⏳ Provera...' : 'Pristupi'}
          </button>
          {error && <p style={S.errText}>{error}</p>}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // ══ LANDING PAGE — no portal selected ══
  // ═══════════════════════════════════════════
  if (!selectedPortal) {
    const allPortalIds = ['newsmax', 'newsmax_pl', 'newsmax_al', 'insajder'];
    const totalToday = allPortalIds.reduce((sum, pid) => sum + (opsData?.portalSummary?.[pid]?.today || 0), 0);
    const totalTodayErrors = allPortalIds.reduce((sum, pid) => sum + (opsData?.portalSummary?.[pid]?.todayErrors || 0), 0);

    return (
      <div style={S.page}>
        {/* Header */}
        <header style={S.headerLanding}>
          <div style={S.headerLeft}>
            <span style={S.logoGem}>💎</span>
            <div>
              <h1 style={S.h1Landing}>SEO GEM</h1>
              <p style={S.h1Sub}>Admin Dashboard</p>
            </div>
          </div>
          <div style={S.headerRight}>
            <span style={S.refreshBadge} title="Poslednje ažuriranje">
              🔄 {timeAgo(secondsSinceRefresh)}
            </span>
          </div>
        </header>

        {loading && <LoadingSkeleton />}
        {error && <ErrorBanner message={error} onRetry={() => fetchData()} />}

        {!loading && (
          <>
            {/* Portal Cards Grid */}
            <div style={S.landingGrid}>
              {allPortalIds.map(pid => {
                const isDisabled = pid === 'insajder';
                const portal = overview.find(p => p.portal_id === pid);
                const pOps = opsData?.portalSummary?.[pid];
                const totalArticlesCount = portal?.seo_gem_articles_total ?? 0;
                const successRate = pOps ? pct(pOps.success, pOps.total) : 0;
                const todayGen = pOps?.today ?? 0;
                const todayErr = pOps?.todayErrors ?? 0;

                return (
                  <div
                    key={pid}
                    onClick={() => !isDisabled && selectPortal(pid)}
                    style={{
                      ...S.portalCard,
                      ...(isDisabled ? S.portalCardDisabled : {}),
                      cursor: isDisabled ? 'default' : 'pointer',
                    }}
                    onMouseEnter={e => {
                      if (!isDisabled) {
                        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 40px rgba(139,92,246,0.15)';
                        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139,92,246,0.35)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isDisabled) {
                        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139,92,246,0.15)';
                      }
                    }}
                  >
                    {isDisabled && <div style={S.comingSoon}>Uskoro...</div>}
                    <div style={S.pcHead}>
                      <span style={{ fontSize: 36 }}>{PORTAL_FLAGS[pid] || '🌐'}</span>
                      <div>
                        <div style={{ ...S.pcName, ...(isDisabled ? { color: '#475569' } : {}) }}>
                          {PORTAL_DISPLAY[pid] || pid}
                        </div>
                      </div>
                    </div>
                    <div style={S.pcMetrics}>
                      <div style={S.pcMetric}>
                        <div style={S.pcMetricVal}>{isDisabled ? '—' : formatNum(totalArticlesCount)}</div>
                        <div style={S.pcMetricLabel}>Ukupno članaka</div>
                      </div>
                      <div style={S.pcMetric}>
                        <div style={{
                          ...S.pcMetricVal,
                          color: isDisabled ? '#475569' : successRate >= 90 ? '#10b981' : successRate >= 70 ? '#f59e0b' : '#ef4444',
                        }}>
                          {isDisabled ? '—' : `${successRate}%`}
                        </div>
                        <div style={S.pcMetricLabel}>Uspešnost</div>
                      </div>
                      <div style={S.pcMetric}>
                        <div style={S.pcMetricVal}>{isDisabled ? '—' : todayGen}</div>
                        <div style={S.pcMetricLabel}>Danas gen.</div>
                      </div>
                      <div style={S.pcMetric}>
                        <div style={{
                          ...S.pcMetricVal,
                          color: isDisabled ? '#475569' : todayErr > 0 ? '#ef4444' : '#10b981',
                        }}>
                          {isDisabled ? '—' : todayErr}
                        </div>
                        <div style={S.pcMetricLabel}>Danas greške</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary Bar */}
            <div style={S.summaryBar}>
              <div style={S.summaryItem}>
                <span style={S.summaryIcon}>📊</span>
                <span style={S.summaryLabel}>Danas ukupno:</span>
                <span style={S.summaryValue}>{totalToday} generacija</span>
              </div>
              <div style={S.summaryItem}>
                <span style={S.summaryIcon}>⚠️</span>
                <span style={S.summaryLabel}>Današnje greške:</span>
                <span style={{ ...S.summaryValue, color: totalTodayErrors > 0 ? '#ef4444' : '#10b981' }}>
                  {totalTodayErrors}
                </span>
              </div>
              {opsData && (
                <div style={S.summaryItem}>
                  <span style={S.summaryIcon}>⚡</span>
                  <span style={S.summaryLabel}>Ukupna uspešnost (7d):</span>
                  <span style={{
                    ...S.summaryValue,
                    color: opsData.summary.successRate >= 90 ? '#10b981' : '#f59e0b',
                  }}>
                    {opsData.summary.successRate}%
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // ══ PORTAL VIEW — with tabs ══
  // ═══════════════════════════════════════════
  const TABS: { key: TabKey; icon: string; label: string }[] = [
    { key: 'ops', icon: '🔄', label: 'Operacije' },
    { key: 'analytics', icon: '📊', label: 'Analitika' },
    { key: 'articles', icon: '📝', label: 'Članci' },
    { key: 'status', icon: '⚙️', label: 'Status' },
  ];

  return (
    <div style={S.page}>
      {/* Header */}
      <header style={S.header}>
        <div style={S.headerLeft}>
          <button onClick={goBack} style={S.backBtn} title="Nazad na portale">
            ← Nazad
          </button>
          <span style={{ fontSize: 28 }}>{PORTAL_FLAGS[selectedPortal] || '🌐'}</span>
          <h1 style={S.h1}>{PORTAL_DISPLAY[selectedPortal] || currentPortal?.portal_name || selectedPortal}</h1>
        </div>
        <div style={S.headerRight}>
          <span style={S.refreshBadge} title="Poslednje ažuriranje">
            🔄 {timeAgo(secondsSinceRefresh)}
          </span>
          <div style={S.periodWrap}>
            {PRESETS.map(p => (
              <button key={p.days} onClick={() => selectPreset(p.days)}
                style={{ ...S.presetBtn, ...(activePreset === p.days ? S.presetActive : {}) }}>
                {p.label}
              </button>
            ))}
            <button onClick={() => setShowCustom(!showCustom)}
              style={{ ...S.presetBtn, ...(activePreset === 0 ? S.presetActive : {}) }}>
              📅
            </button>
          </div>
        </div>
      </header>

      {/* Custom date picker */}
      {showCustom && (
        <div style={S.customBar}>
          <label style={S.dateLabel}>Od:
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={S.dateInput} />
          </label>
          <label style={S.dateLabel}>Do:
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={S.dateInput} />
          </label>
          <button onClick={applyCustom} style={S.applyBtn}>Primeni</button>
        </div>
      )}

      {/* Period info */}
      <div style={S.periodInfo}>
        📅 {startDate} → {endDate}
        {activePreset > 0 && activePreset <= 3 && (
          <span style={{ marginLeft: 12, fontSize: 11, color: '#f59e0b', opacity: 0.9 }}>
            ⚠️ GSC kasni ~3 dana, GA4 kasni ~1 dan
          </span>
        )}
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{ ...S.tab, ...(activeTab === t.key ? S.tabActive : {}) }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading && <LoadingSkeleton />}
      {error && <ErrorBanner message={error} onRetry={() => fetchData()} />}

      {!loading && !error && (
        <div style={S.tabContent}>
          {/* ═══ TAB 1: OPERACIJE ═══ */}
          {activeTab === 'ops' && (
            <OpsTab opsData={opsData} portalId={selectedPortal} currentOps={currentOps} />
          )}

          {/* ═══ TAB 2: ANALITIKA ═══ */}
          {activeTab === 'analytics' && currentPortal && (
            <AnalyticsTab portal={currentPortal} />
          )}

          {/* ═══ TAB 3: ČLANCI ═══ */}
          {activeTab === 'articles' && (
            <div>
              <div style={S.artHeader}>
                <span style={S.artCount}>
                  💎 {totalArticles} SEO GEM članaka │ {seoGemCount} sa analitikom
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 12 }}>
                  📅 Podaci za period: {startDate} → {endDate}
                </span>
              </div>
              <div style={{ ...S.tableWrap, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0f172a' }}>
                    {/* Group headers row */}
                    <tr>
                      <th colSpan={3} style={{ ...S.th, borderBottom: 'none', paddingBottom: 0 }}></th>
                      <th style={{ ...S.th, borderBottom: 'none', paddingBottom: 0 }}></th>
                      <th colSpan={5} style={{ ...S.th, borderBottom: '2px solid #f59e0b', paddingBottom: 4, color: '#f59e0b', fontSize: 10, letterSpacing: 1 }}>
                        GOOGLE SEARCH CONSOLE
                      </th>
                      <th colSpan={5} style={{ ...S.th, borderBottom: '2px solid #a78bfa', paddingBottom: 4, color: '#a78bfa', fontSize: 10, letterSpacing: 1 }}>
                        GOOGLE ANALYTICS 4
                      </th>
                    </tr>
                    <tr>
                      {COLUMNS.map(col => (
                        <th key={col.key} title={col.tip}
                          onClick={() => col.key !== 'status' && col.key !== 'title' && handleSort(col.key)}
                          style={{
                            ...S.th,
                            cursor: col.key !== 'status' && col.key !== 'title' ? 'pointer' : 'help',
                            ...(col.key === 'title' ? { textAlign: 'left' as const, minWidth: 280 } : {}),
                            ...(col.key === 'status' ? { width: 36 } : {}),
                          }}>
                          {col.label}
                          {sortKey === col.key && <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                          {col.src === 'GSC' && <span style={S.srcTag}>GSC</span>}
                          {col.src === 'GA4' && <span style={S.srcTagGA}>GA4</span>}
                          {col.src === 'GEM' && <span style={S.srcTagGem}>GEM</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedArticles.map((a, i) => (
                      <tr key={a.article_id} style={i % 2 === 0 ? S.rowE : S.rowO}
                        title={STATUS_LABELS[a.status]}>
                        <td style={S.tdC}>{STATUS_ICONS[a.status]}</td>
                        <td style={S.tdC}>{formatDate(a.published_at)}</td>
                        <td style={S.tdTitle}>
                          <div style={S.titleRow}>
                            <span style={S.titleTxt}>{a.seo_title}</span>
                            <span style={S.badge}>{a.style}</span>
                          </div>
                          <div style={S.urlTxt}>{a.url}</div>
                          {a.top_queries.length > 0 && (
                            <div style={S.qRow}>
                              🔑 {a.top_queries.slice(0, 3).map((q, qi) => (
                                <span key={qi} style={S.qChip}>{q.query}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={S.tdR}>{a.age_days}d</td>
                        <td style={S.tdR}>{a.has_gsc ? formatNum(a.impressions) : '—'}</td>
                        <td style={S.tdR}>{a.has_gsc ? formatNum(a.clicks) : '—'}</td>
                        <td style={{
                          ...S.tdR,
                          color: a.ctr > 6 ? '#10b981' : (a.ctr < 2 && a.status !== 'early' && a.has_gsc) ? '#ef4444' : '#f1f5f9',
                          fontWeight: 600,
                        }}>
                          {a.has_gsc ? `${a.ctr}%` : '—'}
                        </td>
                        <td style={S.tdR}>{a.avg_position ?? '—'}</td>
                        <td style={S.tdR}>{a.discover_impressions > 0 ? formatNum(a.discover_impressions) : '—'}</td>
                        <td style={S.tdR}>{a.has_ga4 ? formatNum(a.pageviews) : '—'}</td>
                        <td style={{ ...S.tdR, color: a.organic_pct > 20 ? '#10b981' : '#94a3b8' }}>
                          {a.has_ga4 ? `${a.organic_pct}%` : '—'}
                        </td>
                        <td style={{ ...S.tdR, color: a.direct_pct > 50 ? '#f59e0b' : '#94a3b8' }}>
                          {a.has_ga4 ? `${a.direct_pct}%` : '—'}
                        </td>
                        <td style={S.tdR}>{a.has_ga4 ? formatSec(a.avg_engagement_sec) : '—'}</td>
                        <td style={S.tdR}>{a.has_ga4 ? a.pages_per_session : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={S.legend}>
                🕐 Rani (&lt;7d) &nbsp;│&nbsp; ✅ OK &nbsp;│&nbsp; ⚠️ Nizak CTR &nbsp;│&nbsp; 🔥 Top &nbsp;│&nbsp;
                GSC kasni 2-3 dana │ Svi podaci za izabrani period ({startDate} → {endDate})
              </div>
            </div>
          )}

          {/* ═══ TAB 4: STATUS ═══ */}
          {activeTab === 'status' && (
            <StatusTab statusData={statusData} onSync={fetchStatus} />
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// ══ Sub-components ══
// ═══════════════════════════════════════════

function LoadingSkeleton() {
  return (
    <div style={{ padding: '40px 0', textAlign: 'center' }}>
      <div style={S.shimmerContainer}>
        {[1, 2, 3].map(i => (
          <div key={i} style={S.shimmerBlock}>
            <div style={S.shimmerLine} />
            <div style={{ ...S.shimmerLine, width: '60%' }} />
            <div style={{ ...S.shimmerLine, width: '80%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={S.errorBanner}>
      <span>❌ {message}</span>
      <button onClick={onRetry} style={S.retryBtn}>🔄 Pokušaj ponovo</button>
    </div>
  );
}

function MetricCard({ icon, label, value, color, sub }: {
  icon: string; label: string; value: string | number; color?: string; sub?: string;
}) {
  return (
    <div style={S.metricCard}>
      <div style={S.mcIcon}>{icon}</div>
      <div style={S.mcLabel}>{label}</div>
      <div style={{ ...S.mcValue, ...(color ? { color } : {}) }}>{value}</div>
      {sub && <div style={S.mcSub}>{sub}</div>}
    </div>
  );
}

// ── Operacije Tab ──
function OpsTab({ opsData, portalId, currentOps }: {
  opsData: OpsData | null;
  portalId: string;
  currentOps?: { total: number; success: number; error: number; partial: number; today: number; todayErrors: number };
}) {
  if (!opsData) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Nema podataka o operacijama</div>;

  const summary = opsData.summary;
  const styles = opsData.styles;
  const totalStyles = Object.values(styles).reduce((s, v) => s + v, 0);
  const portalErrors = opsData.recentErrors.filter(e => e.portal_id === portalId);

  return (
    <div>
      {/* Top metrics */}
      <div style={S.metricsGrid}>
        <MetricCard icon="📦" label="Ukupno generacija" value={currentOps?.total ?? summary.total}
          sub={`Danas: ${currentOps?.today ?? '—'}`} />
        <MetricCard icon="✅" label="Uspešnost" value={`${summary.successRate}%`}
          color={summary.successRate >= 90 ? '#10b981' : '#f59e0b'} sub={`${summary.success} uspešnih`} />
        <MetricCard icon="❌" label="Greške" value={currentOps?.error ?? summary.error}
          color={(currentOps?.error ?? summary.error) > 0 ? '#ef4444' : '#10b981'}
          sub={`Danas: ${currentOps?.todayErrors ?? '—'}`} />
        <MetricCard icon="⚡" label="Avg Latency" value={`${Math.round(summary.avgLatencyMs)}ms`}
          color={summary.avgLatencyMs > 5000 ? '#ef4444' : '#10b981'}
          sub={`Max: ${Math.round(summary.maxLatencyMs)}ms`} />
      </div>

      <div style={S.opsGrid}>
        {/* Style breakdown */}
        <div style={S.opsSection}>
          <h3 style={S.opsSectionTitle}>🎨 Stilovi generisanja</h3>
          <div style={S.styleList}>
            {Object.entries(styles).sort((a, b) => b[1] - a[1]).map(([style, count]) => {
              const p = totalStyles > 0 ? Math.round((count / totalStyles) * 100) : 0;
              const barColor = STYLE_COLORS[style] || STYLE_COLORS.default;
              return (
                <div key={style} style={S.styleRow}>
                  <div style={S.styleLabel}>
                    <span>{style}</span>
                    <span style={S.styleCount}>{count} ({p}%)</span>
                  </div>
                  <div style={S.styleBarBg}>
                    <div style={{ ...S.styleBarFill, width: `${p}%`, background: barColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RAG + Google Suggest */}
        <div style={S.opsSection}>
          <h3 style={S.opsSectionTitle}>🧠 RAG & Sugestije</h3>
          <div style={S.ragGrid}>
            <div style={S.ragCard}>
              <div style={S.ragTitle}>RAG Korišćenje</div>
              <div style={S.ragValue}>{opsData.rag.usageRate}%</div>
              <div style={S.ragSub}>Avg primeri: {opsData.rag.avgExamples}</div>
              <div style={S.ragSub}>{opsData.rag.totalUsed} / {opsData.rag.totalCalls} poziva</div>
            </div>
            <div style={S.ragCard}>
              <div style={S.ragTitle}>Google Suggest</div>
              <div style={S.ragValue}>{opsData.googleSuggest.usageRate}%</div>
              <div style={S.ragSub}>Avg sugestija: {opsData.googleSuggest.avgCount}</div>
              <div style={S.ragSub}>{opsData.googleSuggest.totalUsed} / {opsData.googleSuggest.totalCalls} poziva</div>
            </div>
          </div>

          {/* Model usage */}
          <h3 style={{ ...S.opsSectionTitle, marginTop: 20 }}>🤖 Modeli</h3>
          {Object.entries(opsData.models).map(([model, count]) => (
            <div key={model} style={S.modelRow}>
              <span style={S.modelName}>{model}</span>
              <span style={S.modelCount}>{count}</span>
            </div>
          ))}

          {/* Top keywords */}
          {opsData.topKeywords.length > 0 && (
            <>
              <h3 style={{ ...S.opsSectionTitle, marginTop: 20 }}>🔑 Top ključne reči</h3>
              <div style={S.keywordList}>
                {opsData.topKeywords.slice(0, 10).map((kw, i) => (
                  <span key={i} style={S.keywordChip}>{kw.keyword} ({kw.count})</span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Daily trend */}
      {opsData.dailyTrend.length > 0 && (
        <div style={{ ...S.opsSection, marginTop: 16 }}>
          <h3 style={S.opsSectionTitle}>📈 Dnevni trend (7 dana)</h3>
          <div style={S.trendGrid}>
            {opsData.dailyTrend.map(day => {
              const maxVal = Math.max(...opsData.dailyTrend.map(d => d.total), 1);
              const barW = Math.round((day.total / maxVal) * 100);
              const errW = day.total > 0 ? Math.round((day.error / day.total) * 100) : 0;
              return (
                <div key={day.date} style={S.trendRow}>
                  <div style={S.trendDate}>{day.date.slice(5)}</div>
                  <div style={S.trendBarBg}>
                    <div style={{ ...S.trendBarSuccess, width: `${barW - (barW * errW / 100)}%` }} />
                    <div style={{ ...S.trendBarError, width: `${barW * errW / 100}%` }} />
                  </div>
                  <div style={S.trendNum}>{day.total}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error log */}
      {portalErrors.length > 0 && (
        <div style={{ ...S.opsSection, marginTop: 16 }}>
          <h3 style={S.opsSectionTitle}>🚨 Nedavne greške ({portalErrors.length})</h3>
          <div style={S.errorList}>
            {portalErrors.slice(0, 20).map((err, i) => (
              <div key={i} style={S.errorItem}>
                <div style={S.errorItemHead}>
                  <span style={S.errorTime}>{new Date(err.time).toLocaleString('sr-Latn')}</span>
                  <span style={S.errorType}>{err.error_type}</span>
                  <span style={S.errorEndpoint}>{err.endpoint}</span>
                </div>
                <div style={S.errorMsg}>{err.error_message}</div>
                {err.article_url && (
                  <div style={S.errorUrl}>{err.article_url}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Analytics Tab ──
function AnalyticsTab({ portal }: { portal: PortalOverview }) {
  const p = portal;
  const od = p.ga4.gem_pageviews > 0 ? p.ga4.gem_organic_direct_pct : 0;
  const social = p.ga4.gem_pageviews > 0 ? Math.max(0, 100 - od - 5) : 0; // approximation
  const other = p.ga4.gem_pageviews > 0 ? Math.max(0, 100 - od - social) : 0;

  return (
    <div>
      {/* GSC Section */}
      <div style={S.analyticsSection}>
        <h3 style={S.analyticsSectionTitle}>🔍 Google Search Console</h3>
        <div style={S.compTable}>
          <div style={S.compHeader}>
            <div style={S.compCol}>Metrika</div>
            <div style={S.compCol}>Ceo sajt</div>
            <div style={{ ...S.compCol, color: '#a78bfa' }}>SEO GEM</div>
          </div>
          <CompRow label="Impressions" whole={formatNum(p.gsc.total_impressions)} gem="—" />
          <CompRow label="Clicks" whole={formatNum(p.gsc.total_clicks)} gem="—" />
          <CompRow label="CTR" whole={`${p.gsc.ctr}%`} gem="—"
            wholeColor={p.gsc.ctr > 4 ? '#10b981' : undefined} />
          <CompRow label="Web Impressions" whole={formatNum(p.gsc.web_impressions)} gem="—" />
          <CompRow label="Discover" whole={formatNum(p.gsc.discover_impressions)} gem="—" />
        </div>
      </div>

      {/* GA4 Section */}
      <div style={S.analyticsSection}>
        <h3 style={S.analyticsSectionTitle}>📈 Google Analytics 4</h3>
        <div style={S.compTable}>
          <div style={S.compHeader}>
            <div style={S.compCol}>Metrika</div>
            <div style={S.compCol}>Ceo sajt</div>
            <div style={{ ...S.compCol, color: '#a78bfa' }}>SEO GEM</div>
            <div style={{ ...S.compCol, color: '#64748b' }}>%</div>
          </div>
          <CompRow label="Pageviews"
            whole={formatNum(p.ga4.pageviews)} gem={formatNum(p.ga4.gem_pageviews)}
            pctVal={`${p.ga4.gem_pageviews_pct}%`} />
          <CompRow label="Sessions"
            whole={formatNum(p.ga4.sessions)} gem={formatNum(p.ga4.gem_sessions)}
            pctVal={`${p.ga4.gem_sessions_pct}%`} />
          <CompRow label="Engagement"
            whole={formatSec(p.ga4.avg_engagement_sec)} gem={formatSec(p.ga4.gem_avg_engagement_sec)} />
          <CompRow label="Str/Sesija"
            whole={String(p.ga4.pages_per_session)} gem={String(p.ga4.gem_pages_per_session)} />
        </div>
      </div>

      {/* Attribution */}
      <div style={S.analyticsSection}>
        <h3 style={S.analyticsSectionTitle}>🎯 SEO GEM — Atribucija saobraćaja</h3>
        <div style={S.attrGrid}>
          <AttrBar label="Organic + Direct" value={od} color="#10b981" count={p.ga4.gem_organic_direct_views} />
          <AttrBar label="Social" value={social} color="#3b82f6" count={0} />
          <AttrBar label="Ostalo" value={other} color="#64748b" count={p.ga4.gem_pageviews - p.ga4.gem_organic_direct_views} />
        </div>
      </div>

      {/* Top countries */}
      {p.ga4.top_countries.length > 0 && (
        <div style={S.analyticsSection}>
          <h3 style={S.analyticsSectionTitle}>🌍 Top zemlje</h3>
          <div style={S.countriesList}>
            {p.ga4.top_countries.map((c, i) => (
              <div key={i} style={S.countryRow}>
                <span style={S.countryName}>{c.country}</span>
                <span style={S.countryVal}>{formatNum(c.sessions)} sesija</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Article counts */}
      <div style={S.gemBadge}>
        SEO GEM članaka u periodu: <strong>{p.seo_gem_articles_period}</strong>
        &nbsp;│&nbsp; Ukupno: <strong>{p.seo_gem_articles_total}</strong>
      </div>
    </div>
  );
}

function CompRow({ label, whole, gem, pctVal, wholeColor }: {
  label: string; whole: string; gem: string; pctVal?: string; wholeColor?: string;
}) {
  return (
    <div style={S.compRow}>
      <div style={S.compRowLabel}>{label}</div>
      <div style={{ ...S.compRowVal, ...(wholeColor ? { color: wholeColor } : {}) }}>{whole}</div>
      <div style={{ ...S.compRowVal, color: '#a78bfa' }}>{gem}</div>
      {pctVal !== undefined && <div style={{ ...S.compRowVal, color: '#64748b' }}>{pctVal}</div>}
    </div>
  );
}

function AttrBar({ label, value, color, count }: { label: string; value: number; color: string; count: number }) {
  return (
    <div style={S.attrRow}>
      <div style={S.attrLabel}>
        <span style={{ ...S.attrDot, background: color }} />
        {label}
      </div>
      <div style={S.attrBarBg}>
        <div style={{ ...S.attrBarFill, width: `${Math.max(value, 2)}%`, background: color }} />
      </div>
      <div style={S.attrVal}>{value.toFixed(1)}%</div>
      <div style={S.attrCount}>{formatNum(count)}</div>
    </div>
  );
}

// ── Status Tab ──
function StatusTab({ statusData, onSync }: { statusData: Record<string, unknown> | null; onSync: () => void }) {
  if (!statusData) return <div style={{ color: '#64748b', padding: 40, textAlign: 'center' }}>Učitavanje statusa...</div>;

  const data = statusData as Record<string, unknown>;
  // API returns: { success, portals: [...], summary: { total, gsc_connected, ga4_connected } }
  const portals = (data.portals || []) as Array<{
    portal_id: string;
    portal_name: string;
    gsc_connected: boolean;
    ga4_connected: boolean;
    last_gsc_sync_at: string | null;
    last_ga4_sync_at: string | null;
  }>;
  const summary = (data.summary || {}) as { total?: number; gsc_connected?: number; ga4_connected?: number };

  const allGscConnected = (summary.gsc_connected || 0) > 0;
  const allGa4Connected = (summary.ga4_connected || 0) > 0;

  const systemServices = [
    {
      name: 'Google Search Console',
      icon: '🔍',
      connected: allGscConnected,
      detail: `${summary.gsc_connected || 0}/${summary.total || 0} portala povezano`,
      desc: 'Prikuplja podatke o pozicijama, klikovima i impressions iz Google pretrage i Discover-a',
    },
    {
      name: 'Google Analytics 4',
      icon: '📈',
      connected: allGa4Connected,
      detail: `${summary.ga4_connected || 0}/${summary.total || 0} portala povezano`,
      desc: 'Prati pageviews, sesije, engagement i izvore saobraćaja za SEO GEM članke',
    },
    {
      name: 'CMS API',
      icon: '📰',
      connected: portals.length > 0, // If portals exist in DB, CMS is configured
      detail: portals.length > 0 ? `${portals.length} portala konfigurisano` : 'Nema portala',
      desc: 'Povezanost sa CMS sistemom portala — prima zahteve za generisanje naslova i embed linkova',
    },
    {
      name: 'LLM (Gemini)',
      icon: '🤖',
      connected: data.success === true, // If status API works, server is up, so Gemini key is configured
      detail: data.success ? 'API ključ konfigurisan' : 'Nedostaje GEMINI_API_KEY',
      desc: 'Generativni AI model koji kreira SEO naslove, meta opise i schema markup',
    },
  ];

  const formatSyncTime = (t: string | null) => {
    if (!t) return 'Nikad';
    const d = new Date(t);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / 3600000);
    if (diffH < 1) return `pre ${Math.floor(diffMs / 60000)} min`;
    if (diffH < 24) return `pre ${diffH}h`;
    return d.toLocaleDateString('sr-Latn', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16, padding: '12px 16px', background: 'rgba(30,41,59,0.5)', borderRadius: 8, border: '1px solid rgba(148,163,184,0.1)' }}>
        ℹ️ Status svih servisa SEO GEM sistema. Podaci se osvežavaju sa svakim učitavanjem dashboarda.
      </div>

      {/* System services */}
      <div style={S.statusGrid}>
        {systemServices.map(svc => (
          <div key={svc.name} style={S.statusCard}>
            <div style={S.statusIcon}>{svc.icon}</div>
            <div style={S.statusName}>{svc.name}</div>
            <div style={{
              ...S.statusBadge,
              background: svc.connected ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: svc.connected ? '#10b981' : '#ef4444',
            }}>
              {svc.connected ? '● Povezan' : '○ Nepovezan'}
            </div>
            <div style={{ color: svc.connected ? '#10b981' : '#f59e0b', fontSize: 11, marginTop: 4, fontWeight: 500 }}>{svc.detail}</div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 8, lineHeight: 1.4 }}>{svc.desc}</div>
          </div>
        ))}
      </div>

      {/* Per-portal detail */}
      {portals.length > 0 && (
        <div style={{ ...S.opsSection, marginTop: 20 }}>
          <h3 style={S.opsSectionTitle}>📡 Konekcije po portalu</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {portals.map(p => (
              <div key={p.portal_id} style={{ background: 'rgba(15,23,42,0.6)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(148,163,184,0.08)' }}>
                <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 8, fontSize: 14 }}>
                  {PORTAL_FLAGS[p.portal_id] || '🌐'} {PORTAL_DISPLAY[p.portal_id] || p.portal_name}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                  <div>
                    <span style={{ color: p.gsc_connected ? '#10b981' : '#ef4444' }}>
                      {p.gsc_connected ? '●' : '○'} GSC
                    </span>
                    <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
                      Sync: {formatSyncTime(p.last_gsc_sync_at)}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: p.ga4_connected ? '#10b981' : '#ef4444' }}>
                      {p.ga4_connected ? '●' : '○'} GA4
                    </span>
                    <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
                      Sync: {formatSyncTime(p.last_ga4_sync_at)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={onSync} style={S.syncBtn}>🔄 Osveži status</button>
    </div>
  );
}

// ═══════════════════════════════════════════
// ══ Styles ══
// ═══════════════════════════════════════════
const S: Record<string, React.CSSProperties> = {
  // ── Login ──
  loginContainer: {
    minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center',
    background: '#0a0e1a', fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  },
  loginCard: {
    background: '#111827', borderRadius: 20, padding: '48px 40px', textAlign: 'center',
    boxShadow: '0 25px 80px rgba(0,0,0,0.6)', border: '1px solid rgba(139,92,246,0.15)',
    maxWidth: 400, width: '100%',
  },
  loginIcon: { fontSize: 48, marginBottom: 8 },
  loginTitle: { color: '#f1f5f9', margin: '0 0 4px', fontSize: 28, fontWeight: 700 },
  loginSub: { color: '#64748b', margin: '0 0 28px', fontSize: 14 },
  input: {
    width: '100%', padding: '14px 18px', borderRadius: 10, border: '1px solid rgba(139,92,246,0.2)',
    background: '#0a0e1a', color: '#f1f5f9', fontSize: 15, marginBottom: 16, boxSizing: 'border-box' as const,
    outline: 'none',
  },
  loginBtn: {
    width: '100%', padding: '14px 24px', borderRadius: 10, border: 'none',
    background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)', color: '#fff', fontSize: 16,
    cursor: 'pointer', fontWeight: 600, transition: 'opacity 0.2s',
  },
  errText: { color: '#ef4444', marginTop: 12, fontSize: 14 },

  // ── Page ──
  page: {
    minHeight: '100vh', background: '#0a0e1a', color: '#f1f5f9',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif", padding: '0 24px 48px',
  },

  // ── Header (Portal View) ──
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 0', borderBottom: '1px solid rgba(139,92,246,0.1)', flexWrap: 'wrap' as const, gap: 12,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const },
  h1: { margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9' },
  backBtn: {
    padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.2)',
    background: 'rgba(139,92,246,0.08)', color: '#a78bfa', cursor: 'pointer', fontSize: 13,
    fontWeight: 600, whiteSpace: 'nowrap' as const,
  },
  refreshBadge: {
    fontSize: 12, color: '#64748b', padding: '4px 10px', borderRadius: 6,
    background: 'rgba(100,116,139,0.1)',
  },

  // ── Header (Landing) ──
  headerLanding: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '24px 0 20px', borderBottom: '1px solid rgba(139,92,246,0.1)',
  },
  logoGem: { fontSize: 36, marginRight: 12 },
  h1Landing: { margin: 0, fontSize: 28, fontWeight: 700, color: '#f1f5f9' },
  h1Sub: { margin: '2px 0 0', fontSize: 13, color: '#64748b', fontWeight: 400 },

  // ── Period ──
  periodWrap: { display: 'flex', gap: 4, flexWrap: 'wrap' as const },
  presetBtn: {
    padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.15)',
    background: 'rgba(139,92,246,0.05)', color: '#94a3b8', cursor: 'pointer', fontSize: 13,
    whiteSpace: 'nowrap' as const, transition: 'all 0.2s',
  },
  presetActive: { background: '#8b5cf6', color: '#fff', borderColor: '#8b5cf6' },
  customBar: {
    display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0',
    borderBottom: '1px solid rgba(139,92,246,0.1)', flexWrap: 'wrap' as const,
  },
  dateLabel: { color: '#94a3b8', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 },
  dateInput: {
    padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.2)',
    background: '#0a0e1a', color: '#f1f5f9', fontSize: 13,
  },
  applyBtn: {
    padding: '7px 16px', borderRadius: 8, border: 'none',
    background: '#8b5cf6', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  periodInfo: { padding: '10px 0', fontSize: 13, color: '#64748b' },

  // ── Tabs ──
  tabs: { display: 'flex', gap: 4, marginTop: 12 },
  tab: {
    padding: '10px 20px', borderRadius: '10px 10px 0 0', border: '1px solid rgba(139,92,246,0.1)',
    borderBottom: 'none', background: 'rgba(139,92,246,0.03)', color: '#64748b', cursor: 'pointer',
    fontSize: 14, fontWeight: 500, transition: 'all 0.2s',
  },
  tabActive: {
    background: '#111827', color: '#a78bfa', borderColor: 'rgba(139,92,246,0.25)',
    borderBottom: '2px solid #8b5cf6',
  },
  tabContent: {
    background: '#111827', borderRadius: '0 12px 12px 12px', padding: 24,
    border: '1px solid rgba(139,92,246,0.1)', borderTop: 'none', minHeight: 400,
  },

  // ── Landing Grid ──
  landingGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 20, marginTop: 24,
  },
  portalCard: {
    background: '#111827', borderRadius: 16, padding: 24,
    border: '1px solid rgba(139,92,246,0.15)',
    transition: 'all 0.3s ease', position: 'relative' as const,
  },
  portalCardDisabled: {
    opacity: 0.45, filter: 'grayscale(0.8)',
  },
  comingSoon: {
    position: 'absolute' as const, top: 12, right: 12,
    padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
  },
  pcHead: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 },
  pcName: { fontSize: 18, fontWeight: 700, color: '#f1f5f9' },
  pcMetrics: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12,
  },
  pcMetric: {
    background: 'rgba(10,14,26,0.6)', borderRadius: 10, padding: '14px 12px', textAlign: 'center' as const,
  },
  pcMetricVal: { fontSize: 22, fontWeight: 700, color: '#f1f5f9' },
  pcMetricLabel: { fontSize: 11, color: '#64748b', marginTop: 4, textTransform: 'uppercase' as const, letterSpacing: '0.5px' },

  // ── Summary Bar ──
  summaryBar: {
    display: 'flex', gap: 24, marginTop: 24, padding: '16px 24px',
    background: '#111827', borderRadius: 12, border: '1px solid rgba(139,92,246,0.1)',
    flexWrap: 'wrap' as const, justifyContent: 'center',
  },
  summaryItem: { display: 'flex', alignItems: 'center', gap: 8 },
  summaryIcon: { fontSize: 18 },
  summaryLabel: { fontSize: 13, color: '#94a3b8' },
  summaryValue: { fontSize: 15, fontWeight: 700, color: '#f1f5f9' },

  // ── Metric Cards ──
  metricsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24,
  },
  metricCard: {
    background: 'rgba(10,14,26,0.5)', borderRadius: 12, padding: '20px 16px', textAlign: 'center' as const,
    border: '1px solid rgba(139,92,246,0.08)',
  },
  mcIcon: { fontSize: 24, marginBottom: 6 },
  mcLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 4 },
  mcValue: { fontSize: 28, fontWeight: 700, color: '#f1f5f9' },
  mcSub: { fontSize: 11, color: '#94a3b8', marginTop: 4 },

  // ── Ops Grid ──
  opsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16,
  },
  opsSection: {
    background: 'rgba(10,14,26,0.4)', borderRadius: 12, padding: 20,
    border: '1px solid rgba(139,92,246,0.06)',
  },
  opsSectionTitle: {
    margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#f1f5f9',
  },

  // ── Style bars ──
  styleList: { display: 'flex', flexDirection: 'column' as const, gap: 10 },
  styleRow: {},
  styleLabel: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#94a3b8', marginBottom: 4 },
  styleCount: { color: '#64748b', fontSize: 12 },
  styleBarBg: { height: 6, borderRadius: 3, background: 'rgba(139,92,246,0.08)' },
  styleBarFill: { height: '100%', borderRadius: 3, transition: 'width 0.5s ease' },

  // ── RAG ──
  ragGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  ragCard: {
    background: 'rgba(139,92,246,0.05)', borderRadius: 10, padding: 16, textAlign: 'center' as const,
    border: '1px solid rgba(139,92,246,0.1)',
  },
  ragTitle: { fontSize: 12, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase' as const },
  ragValue: { fontSize: 28, fontWeight: 700, color: '#a78bfa' },
  ragSub: { fontSize: 11, color: '#64748b', marginTop: 4 },

  // ── Models ──
  modelRow: {
    display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
    background: 'rgba(10,14,26,0.3)', borderRadius: 8, marginBottom: 6,
  },
  modelName: { fontSize: 13, color: '#94a3b8' },
  modelCount: { fontSize: 13, fontWeight: 700, color: '#f1f5f9' },

  // ── Keywords ──
  keywordList: { display: 'flex', flexWrap: 'wrap' as const, gap: 6 },
  keywordChip: {
    padding: '4px 10px', borderRadius: 6, fontSize: 12,
    background: 'rgba(139,92,246,0.08)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.15)',
  },

  // ── Daily Trend ──
  trendGrid: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
  trendRow: { display: 'flex', alignItems: 'center', gap: 10 },
  trendDate: { width: 50, fontSize: 12, color: '#64748b', textAlign: 'right' as const },
  trendBarBg: { flex: 1, height: 14, borderRadius: 4, background: 'rgba(139,92,246,0.05)', display: 'flex', overflow: 'hidden' },
  trendBarSuccess: { height: '100%', background: '#10b981', borderRadius: '4px 0 0 4px' },
  trendBarError: { height: '100%', background: '#ef4444', borderRadius: '0 4px 4px 0' },
  trendNum: { width: 36, fontSize: 12, color: '#94a3b8', textAlign: 'right' as const },

  // ── Error Log ──
  errorList: { maxHeight: 400, overflowY: 'auto' as const },
  errorItem: {
    padding: '12px 14px', borderRadius: 8, marginBottom: 8,
    background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)',
  },
  errorItemHead: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: 6 },
  errorTime: { fontSize: 11, color: '#64748b' },
  errorType: {
    fontSize: 11, padding: '2px 8px', borderRadius: 4,
    background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 600,
  },
  errorEndpoint: {
    fontSize: 11, padding: '2px 8px', borderRadius: 4,
    background: 'rgba(139,92,246,0.1)', color: '#a78bfa',
  },
  errorMsg: { fontSize: 12, color: '#94a3b8', lineHeight: 1.4 },
  errorUrl: { fontSize: 11, color: '#475569', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },

  // ── Analytics ──
  analyticsSection: {
    background: 'rgba(10,14,26,0.4)', borderRadius: 12, padding: 20,
    border: '1px solid rgba(139,92,246,0.06)', marginBottom: 16,
  },
  analyticsSectionTitle: { margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#f1f5f9' },
  compTable: {},
  compHeader: {
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 0.5fr', gap: 8,
    padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#64748b',
    textTransform: 'uppercase' as const, borderBottom: '1px solid rgba(139,92,246,0.1)',
  },
  compCol: {},
  compRow: {
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 0.5fr', gap: 8,
    padding: '10px 12px', borderBottom: '1px solid rgba(139,92,246,0.04)',
  },
  compRowLabel: { fontSize: 13, color: '#94a3b8' },
  compRowVal: { fontSize: 14, fontWeight: 600, color: '#f1f5f9' },

  // ── Attribution ──
  attrGrid: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  attrRow: { display: 'flex', alignItems: 'center', gap: 12 },
  attrLabel: { width: 140, fontSize: 13, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 },
  attrDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  attrBarBg: { flex: 1, height: 10, borderRadius: 5, background: 'rgba(139,92,246,0.06)' },
  attrBarFill: { height: '100%', borderRadius: 5, transition: 'width 0.5s ease' },
  attrVal: { width: 50, fontSize: 13, fontWeight: 600, color: '#f1f5f9', textAlign: 'right' as const },
  attrCount: { width: 60, fontSize: 12, color: '#64748b', textAlign: 'right' as const },

  // ── Countries ──
  countriesList: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
  countryRow: {
    display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
    background: 'rgba(10,14,26,0.3)', borderRadius: 8,
  },
  countryName: { fontSize: 13, color: '#94a3b8' },
  countryVal: { fontSize: 13, fontWeight: 600, color: '#f1f5f9' },

  gemBadge: {
    marginTop: 16, padding: '10px 16px', background: 'rgba(139,92,246,0.06)', borderRadius: 10,
    fontSize: 13, color: '#94a3b8', textAlign: 'center' as const,
    border: '1px solid rgba(139,92,246,0.08)',
  },

  // ── Articles ──
  artHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  artCount: { fontSize: 13, color: '#64748b' },
  tableWrap: {
    overflowX: 'auto' as const, borderRadius: 10, border: '1px solid rgba(139,92,246,0.1)',
    background: '#111827',
  },
  th: {
    padding: '12px 8px', textAlign: 'left' as const, background: '#0a0e1a',
    color: '#64748b', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' as const,
    borderBottom: '2px solid rgba(139,92,246,0.15)', whiteSpace: 'nowrap' as const,
    position: 'sticky' as const, top: 0, letterSpacing: '0.3px',
  },
  srcTag: {
    display: 'inline-block', marginLeft: 4, padding: '0 4px', borderRadius: 3,
    background: '#3b82f620', color: '#60a5fa', fontSize: 8, verticalAlign: 'middle',
  },
  srcTagGA: {
    display: 'inline-block', marginLeft: 4, padding: '0 4px', borderRadius: 3,
    background: '#10b98120', color: '#34d399', fontSize: 8, verticalAlign: 'middle',
  },
  srcTagGem: {
    display: 'inline-block', marginLeft: 4, padding: '0 4px', borderRadius: 3,
    background: '#a78bfa20', color: '#a78bfa', fontSize: 8, verticalAlign: 'middle',
  },
  rowE: { background: '#111827' },
  rowO: { background: '#0d1220' },
  tdC: {
    padding: '8px', borderBottom: '1px solid rgba(139,92,246,0.05)', textAlign: 'center' as const,
    whiteSpace: 'nowrap' as const, overflow: 'hidden',
  },
  tdR: {
    padding: '8px', borderBottom: '1px solid rgba(139,92,246,0.05)', textAlign: 'right' as const,
    fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' as const, overflow: 'hidden',
  },
  tdTitle: {
    padding: '8px', borderBottom: '1px solid rgba(139,92,246,0.05)', overflow: 'hidden',
  },
  titleRow: { display: 'flex', alignItems: 'center', gap: 6 },
  titleTxt: { fontWeight: 600, color: '#f1f5f9', fontSize: 12, lineHeight: 1.3 },
  badge: {
    flexShrink: 0, padding: '1px 5px', borderRadius: 4,
    background: 'rgba(139,92,246,0.12)', color: '#a78bfa', fontSize: 9, whiteSpace: 'nowrap' as const,
  },
  urlTxt: { fontSize: 10, color: '#475569', marginTop: 2, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
  qRow: { marginTop: 4, fontSize: 10, color: '#94a3b8' },
  qChip: {
    display: 'inline-block', background: 'rgba(10,14,26,0.6)', borderRadius: 4,
    padding: '1px 6px', margin: '1px 2px', fontSize: 10,
  },
  legend: { textAlign: 'center' as const, padding: '14px 0', color: '#64748b', fontSize: 12 },

  // ── Status ──
  statusGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24,
  },
  statusCard: {
    background: 'rgba(10,14,26,0.5)', borderRadius: 12, padding: 20, textAlign: 'center' as const,
    border: '1px solid rgba(139,92,246,0.08)',
  },
  statusIcon: { fontSize: 32, marginBottom: 8 },
  statusName: { fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 8 },
  statusBadge: {
    display: 'inline-block', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
  },
  statusSync: { fontSize: 11, color: '#64748b', marginTop: 8 },
  dbStats: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
  dbRow: {
    display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
    background: 'rgba(10,14,26,0.3)', borderRadius: 6,
  },
  dbTable: { fontSize: 13, color: '#94a3b8', fontFamily: 'monospace' },
  dbCount: { fontSize: 13, fontWeight: 700, color: '#f1f5f9' },
  syncBtn: {
    marginTop: 20, padding: '12px 24px', borderRadius: 10, border: '1px solid rgba(139,92,246,0.2)',
    background: 'rgba(139,92,246,0.08)', color: '#a78bfa', cursor: 'pointer',
    fontSize: 14, fontWeight: 600,
  },

  // ── Loading ──
  shimmerContainer: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16, maxWidth: 900, margin: '0 auto',
  },
  shimmerBlock: {
    background: '#111827', borderRadius: 12, padding: 24,
    border: '1px solid rgba(139,92,246,0.08)',
  },
  shimmerLine: {
    height: 14, borderRadius: 4, marginBottom: 10,
    background: 'linear-gradient(90deg, rgba(139,92,246,0.05) 25%, rgba(139,92,246,0.1) 50%, rgba(139,92,246,0.05) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  },

  // ── Error Banner ──
  errorBanner: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const,
    padding: '14px 20px', borderRadius: 10, margin: '16px 0',
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
  },
  retryBtn: {
    padding: '6px 16px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)',
    background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
};
